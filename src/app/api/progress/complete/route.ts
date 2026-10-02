import { NextResponse } from "next/server";
import { requireUser, readJsonLimited, jsonError } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { validateCompletionBody } from "@/lib/progress/validate";
import { isUnlocked } from "@/lib/progress/rules";
import { isAccepted } from "@/lib/progress/replay";
import { loadSnapshot, writeCompletion, buildProgressDTO } from "@/lib/server/progress-repo";
import { getMission } from "@/data/missions";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // 1. Authenticate — 401 if no session.
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    // 2. Rate limit — 429 if exceeded.
    const limit = rateLimit(userId);
    if (!limit.ok) {
      const res = jsonError(429, "RATE_LIMITED", "Too many requests. Try again later.");
      res.headers.set("Retry-After", String(limit.retryAfter));
      return res;
    }

    // 3. Parse body — throws a NextResponse (413 or 400) on failure.
    const body = await readJsonLimited(req, 1_048_576);

    // 4. Validate completion body — 400 or 413 on validation failure.
    const validation = validateCompletionBody(body);
    if (!validation.ok) {
      return jsonError(validation.status, validation.code, validation.message);
    }
    const { missionId, transcript } = validation.value;

    // 5. Find the Profile — 401 if it doesn't exist yet (caller must GET /api/progress first).
    const profileRow = await prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profileRow) {
      return jsonError(
        401,
        "UNAUTHENTICATED",
        "Profile not found. Load /api/progress first.",
      );
    }
    const profileId = profileRow.id;

    // 6. Load the authoritative snapshot.
    const snapshot = await loadSnapshot(profileId);

    // 7. Unlock check — 409 if the mission is locked.
    if (!isUnlocked(missionId, snapshot)) {
      return jsonError(409, "LOCKED", "Mission is locked.");
    }

    // 8. Replay — 422 if the transcript doesn't pass all objectives.
    const mission = getMission(missionId);
    if (!mission || !isAccepted(mission, transcript)) {
      return jsonError(
        422,
        "NOT_PASSED",
        "Transcript did not pass all objectives.",
      );
    }

    // 9. Persist the completion.
    await writeCompletion(profileId, missionId, mission.badgeId, new Date());

    // 10. Return the full ProgressDTO.
    const dto = await buildProgressDTO(profileId);
    return NextResponse.json(dto, { status: 200 });
  } catch (err: unknown) {
    // readJsonLimited throws a NextResponse on 413/400 — return it directly.
    if (err instanceof NextResponse) return err;

    console.error("[POST /api/progress/complete] unexpected error", err);
    return jsonError(500, "INTERNAL", "An unexpected error occurred.");
  }
}
