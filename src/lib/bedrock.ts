import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";

// AWS SDK needs the Node.js runtime (not Edge). On Amplify compute, the default
// credential chain picks up the attached compute role automatically (no keys).
export const MODEL_ID =
  process.env.BEDROCK_MODEL_ID ?? "eu.anthropic.claude-haiku-4-5-20251001-v1:0";
export const REGION =
  process.env.BEDROCK_REGION ?? process.env.AWS_REGION ?? "eu-west-1";
export const MAX_BODY_BYTES = 16 * 1024;

const client = new BedrockRuntimeClient({ region: REGION });

// ── Per-IP rate limit (in-memory token bucket) ───────────────────────────────
// Fine for a single Amplify compute instance; a shared store (DynamoDB/Upstash)
// would be the production upgrade.
const RATE_LIMIT = 10; // requests
const RATE_WINDOW_MS = 60_000; // per minute
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimited(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now > b.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  b.count += 1;
  return b.count > RATE_LIMIT;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export interface StreamOptions {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  /** Optional transform applied to each text delta before it's sent (e.g. strip fences). */
  transform?: (text: string) => string;
}

/**
 * Invokes the model with streaming and returns a plain-text Response that relays
 * Claude's token deltas. Returns a 503 Response on invoke failure. Shared by all
 * AI routes (tutor, generator, review) so the Bedrock wiring lives in one place.
 */
export async function streamCompletion(opts: StreamOptions): Promise<Response> {
  const body = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: opts.maxTokens ?? 400,
    temperature: opts.temperature ?? 0.2,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  };

  let bedrockStream;
  try {
    const resp = await client.send(
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
      { error: "The AI is unavailable right now. Please try again shortly." },
      { status: 503 }
    );
  }

  if (!bedrockStream) {
    return Response.json({ error: "The AI returned no response." }, { status: 503 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const transform = opts.transform;

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
            const text = transform ? transform(payload.delta.text) : payload.delta.text;
            if (text) controller.enqueue(encoder.encode(text));
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
