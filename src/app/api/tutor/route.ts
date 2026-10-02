import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { buildUserMessage, parseTutorBody, SYSTEM_PROMPT } from "@/lib/tutor-prompt";

// AWS SDK needs the Node.js runtime (not Edge). On Amplify compute, the
// default credential chain picks up the attached compute role automatically.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL_ID =
  process.env.BEDROCK_MODEL_ID ?? "eu.anthropic.claude-haiku-4-5-20251001-v1:0";
const REGION = process.env.BEDROCK_REGION ?? process.env.AWS_REGION ?? "eu-west-1";
const MAX_BODY_BYTES = 16 * 1024;
const MAX_TOKENS = 400;

// Simple in-memory token bucket per IP. Fine for a single Amplify compute
// instance; a shared store (DynamoDB/Upstash) would be the production upgrade.
const RATE_LIMIT = 10; // requests
const RATE_WINDOW_MS = 60_000; // per minute
const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now > b.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  b.count += 1;
  return b.count > RATE_LIMIT;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

const bedrock = new BedrockRuntimeClient({ region: REGION });

export async function POST(req: Request): Promise<Response> {
  if (rateLimited(clientIp(req))) {
    return Response.json(
      { error: "Too many requests. Give it a moment and try again." },
      { status: 429 }
    );
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return Response.json({ error: "Request too large." }, { status: 413 });
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const ctx = parseTutorBody(parsed);
  if (!ctx) {
    return Response.json({ error: "Not enough context to help with." }, { status: 400 });
  }

  const body = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: MAX_TOKENS,
    temperature: 0.2,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(ctx) }],
  };

  let bedrockStream;
  try {
    const resp = await bedrock.send(
      new InvokeModelWithResponseStreamCommand({
        modelId: MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(body),
      })
    );
    bedrockStream = resp.body;
  } catch (err) {
    console.error("Bedrock invoke failed:", err);
    return Response.json(
      { error: "The tutor is unavailable right now. Try the hints below." },
      { status: 503 }
    );
  }

  if (!bedrockStream) {
    return Response.json({ error: "The tutor returned no response." }, { status: 503 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Relay Anthropic streaming deltas as plain UTF-8 text chunks.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of bedrockStream) {
          const bytes = event.chunk?.bytes;
          if (!bytes) continue;
          const payload = JSON.parse(decoder.decode(bytes));
          if (
            payload.type === "content_block_delta" &&
            payload.delta?.type === "text_delta" &&
            typeof payload.delta.text === "string"
          ) {
            controller.enqueue(encoder.encode(payload.delta.text));
          }
        }
      } catch (err) {
        console.error("Bedrock stream error:", err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
