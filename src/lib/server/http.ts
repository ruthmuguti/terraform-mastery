import { NextResponse } from "next/server";
import { auth } from "../auth";

/**
 * Returns a JSON error response with `{ error: { code, message } }`.
 */
export function jsonError(
  status: number,
  code: string,
  message: string
): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Extracts the authenticated user from the session.
 * Returns `{ userId }` on success, or a 401 `NextResponse` on failure.
 * The user ID comes only from the session — never the request body.
 */
export async function requireUser(): Promise<
  { userId: string } | NextResponse
> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to continue.");
  }
  return { userId };
}

/**
 * Reads and parses the request body as JSON, enforcing a byte limit.
 *
 * - If `Content-Length` header exceeds `maxBytes`, throws a 413 `NextResponse`.
 * - Streams the body counting bytes; aborts at `maxBytes` (413).
 * - On `SyntaxError` from `JSON.parse`, throws a 400 `NextResponse`.
 * - Returns the parsed value on success.
 */
export async function readJsonLimited(
  req: Request,
  maxBytes = 1_048_576
): Promise<unknown> {
  const contentLength = req.headers.get("content-length");
  if (contentLength !== null) {
    const declared = parseInt(contentLength, 10);
    if (!Number.isNaN(declared) && declared > maxBytes) {
      throw jsonError(
        413,
        "TOO_LARGE",
        `Request body exceeds ${maxBytes} bytes.`
      );
    }
  }

  const reader = req.body?.getReader();
  if (!reader) {
    // Empty body — attempt to parse as empty (will produce 400)
    try {
      return JSON.parse("");
    } catch {
      throw jsonError(400, "INVALID", "Request body is not valid JSON.");
    }
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      reader.cancel().catch(() => undefined);
      throw jsonError(
        413,
        "TOO_LARGE",
        `Request body exceeds ${maxBytes} bytes.`
      );
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const text = new TextDecoder().decode(combined);

  try {
    return JSON.parse(text);
  } catch {
    throw jsonError(400, "INVALID", "Request body is not valid JSON.");
  }
}
