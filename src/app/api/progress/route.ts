import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireUser, readJsonLimited, jsonError } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import {
  ensureProfile,
  buildProgressDTO,
  writeStats,
  loadSnapshot,
} from "@/lib/server/progress-repo";
import { validatePatchBody } from "@/lib/progress/validate";
import { isUnlocked } from "@/lib/progress/rules";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── GET /api/progress ────────────────────────────────────────────────────────
// Loads or creates the Profile for the authenticated user and returns a full
// ProgressDTO. Safe to call on every page load.

export async function GET(): Promise<NextResponse> {
  try {
    const result = await requireUser();
    if (result instanceof NextResponse) return result;
    const { userId } = result;

    // auth() is already called inside requireUser, but we need the session for
    // token.login (GitHub username). Call it a second time — it's a JWT decode,
    // no DB hit.
    const session = await auth();
    const user = session?.user as
      | { id?: string; name?: string | null; email?: string | null; image?: string | null; login?: string | null }
      | undefined;

    // Prefer token.login (set in task 11.1); fall back to name, then "user".
    const login = user?.login ?? user?.name ?? "user";
    const image = user?.image ?? null;

    const profileId = await ensureProfile(userId, login, image);
    const dto = await buildProgressDTO(profileId);

    return NextResponse.json(dto, { status: 200 });
  } catch (err: unknown) {
    console.error("[GET /api/progress]", err);
    return jsonError(500, "INTERNAL", "An error occurred.");
  }
}

// ─── PATCH /api/progress ──────────────────────────────────────────────────────
// Applies provider / stats / missionActivity updates. All three fields are
// optional and independent; any subset may be sent in a single request.

export async function PATCH(req: Request): Promise<NextResponse> {
  try {
    // 1. Auth
    const authResult = await requireUser();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    // 2. Rate limit
    const rl = rateLimit(userId);
    if (!rl.ok) {
      return new NextResponse(
        JSON.stringify({ error: { code: "RATE_LIMITED", message: "Too many requests." } }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rl.retryAfter),
          },
        },
      );
    }

    // 3. Parse body
    let body: unknown;
    try {
      body = await readJsonLimited(req, 1_048_576);
    } catch (err: unknown) {
      if (err instanceof NextResponse) return err;
      throw err;
    }

    // 4. Validate
    const validation = validatePatchBody(body);
    if (!validation.ok) {
      return jsonError(validation.status, validation.code, validation.message);
    }
    const patch = validation.value;

    // 5. Resolve profileId (profile must exist — GET must be called first)
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      return jsonError(401, "UNAUTHENTICATED", "Profile not found. Call GET /api/progress first.");
    }
    const profileId = profile.id;

    const now = new Date();

    // 6. Update provider (simple field update)
    if (patch.provider !== undefined) {
      await prisma.profile.update({
        where: { id: profileId },
        data: { provider: patch.provider },
      });
    }

    // 7. Write stats delta
    if (patch.stats !== undefined) {
      await writeStats(profileId, patch.stats, now);
    }

    // 8. Write mission activity (in_progress upsert, only if unlocked and not completed)
    if (patch.missionActivity !== undefined) {
      const { missionId, started, hints, commands } = patch.missionActivity;

      // Load the current snapshot to check unlock/completion state.
      const snapshot = await loadSnapshot(profileId);

      if (isUnlocked(missionId, snapshot) && !snapshot.completions.has(missionId)) {
        // Build the update data for the in_progress row.
        const createData: {
          profileId: string;
          missionId: string;
          status: string;
          startedAt?: Date;
          hintsUsed?: number;
          commandCount?: number;
        } = {
          profileId,
          missionId,
          status: "in_progress",
          ...(started ? { startedAt: now } : {}),
          ...(hints !== undefined ? { hintsUsed: hints } : {}),
          ...(commands !== undefined ? { commandCount: commands } : {}),
        };

        // Upsert: create the row if it doesn't exist; on conflict increment the
        // hint/command counters rather than overwriting them.
        await prisma.missionProgress.upsert({
          where: { profileId_missionId: { profileId, missionId } },
          create: createData,
          update: {
            status: "in_progress",
            ...(started ? { startedAt: now } : {}),
            ...(hints !== undefined ? { hintsUsed: { increment: hints } } : {}),
            ...(commands !== undefined ? { commandCount: { increment: commands } } : {}),
          },
        });
      }
      // If the mission is locked or already completed, this is a no-op (not an error).
    }

    // 9. Return fresh ProgressDTO
    const dto = await buildProgressDTO(profileId);
    return NextResponse.json(dto, { status: 200 });
  } catch (err: unknown) {
    console.error("[PATCH /api/progress]", err);
    return jsonError(500, "INTERNAL", "An error occurred.");
  }
}
