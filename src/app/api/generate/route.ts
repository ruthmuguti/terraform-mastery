import {
  buildGenerateUser,
  GENERATE_SYSTEM_PROMPT,
  parseGenerateBody,
  stripFences,
} from "@/lib/generate-prompt";
import {
  clientIp,
  MAX_BODY_BYTES,
  rateLimited,
  streamCompletion,
} from "@/lib/bedrock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const input = parseGenerateBody(parsed);
  if (!input) {
    return Response.json(
      { error: "Describe what to build (1–500 chars) and pick a provider." },
      { status: 400 }
    );
  }

  return streamCompletion({
    system: GENERATE_SYSTEM_PROMPT,
    user: buildGenerateUser(input),
    maxTokens: 700,
    temperature: 0.3,
    transform: stripFences,
  });
}
