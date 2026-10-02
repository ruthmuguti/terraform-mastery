import {
  buildReviewUser,
  parseReviewBody,
  REVIEW_SYSTEM_PROMPT,
} from "@/lib/review-prompt";
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

  const input = parseReviewBody(parsed);
  if (!input) {
    return Response.json({ error: "No code to review." }, { status: 400 });
  }

  return streamCompletion({
    system: REVIEW_SYSTEM_PROMPT,
    user: buildReviewUser(input),
    maxTokens: 450,
    temperature: 0.3,
  });
}
