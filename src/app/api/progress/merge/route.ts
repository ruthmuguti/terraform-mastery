import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, readJsonLimited, jsonError } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { validateMergeBody } from "@/lib/progress/validate";
import { loadSnapshot, writeMerge, buildProgressDTO } from "@/lib/server/progress-repo";
import { mergeProgress } from "@/lib/progress/merge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/progress/merge
 *
 * Merges local (offline) progress into the Server snapshot on first sign-in (R7).
 * No Replay, no unlock check (R7.4) — every step is a union, min, max or filter.
 * Idempotent: repeating the call with the same local data produces the same result.
 *
 * Pipeline: requireUser → rateLimit → readJsonLimited → validateMergeBody →
 *           loadSnapshot → mergeProgress → writeMerge → buildProgressDTO
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    // 1. Authenticate
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    // 2. Rate limit
    const rl = rateLimit(userId);
    if (!rl.ok) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests." } },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfter) },
        },
      );
    }

    // 3. Read and parse body (≤ 1 MB)
    let body: unknown;
    try {
      body = await readJsonLimited(req, 1_048_576);
    } catch (err) {
      if (err instanceof NextResponse) return err;
      throw err;
    }

    // 4. Validate body shape
    const validation = validateMergeBody(body);
    if (!validation.ok) {
      return jsonError(validation.status, validation.code, validation.message);
    }
    const { local } = validation.value;

    // 5. Find profile for this user
    const profileRow = await prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profileRow) {
      return jsonError(401, "UNAUTHENTICATED", "Sign in to continue.");
    }
    const profileId = profileRow.id;

    // 6. Load current server snapshot
    const serverSnapshot = await loadSnapshot(profileId);

    // 7. Compute the merged snapshot (pure, no Replay, no unlock check)
    const now = new Date();
    const merged = mergeProgress(serverSnapshot, local, now);

    // 8. Persist the merged snapshot
    await writeMerge(profileId, merged, now);

    // 9. Return the full up-to-date ProgressDTO
    const dto = await buildProgressDTO(profileId);
    return NextResponse.json(dto, { status: 200 });
  } catch (err: unknown) {
    console.error("[POST /api/progress/merge] Unexpected error", { userId: "unknown", err });
    return jsonError(500, "INTERNAL", "An unexpected error occurred.");
  }
}
