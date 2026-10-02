/**
 * Prisma write layer for player progress.
 *
 * All writes go through Prisma interactive transactions so concurrent duplicate
 * requests are safely serialised. Replay always runs *before* calling these
 * functions, so nothing DB-expensive happens inside an open transaction.
 *
 * Error codes handled:
 *   P2002 — unique constraint violation (username collision, badge already exists)
 *   P2034 — serialisation / deadlock → one retry, then rethrow
 */

import { prisma } from "../db";
import type { Provider } from "../providers";
import { MISSIONS, getMission } from "@/data/missions";
import { getBadge } from "@/data/badges";
import { derivedXp, level, isUnlocked } from "../progress/rules";
import type { Completion, InProgressRow, Snapshot } from "../progress/rules";
import { STAT_MAX } from "../progress/rules";
import { getLevelInfo } from "../types";
import type { ProgressDTO } from "../progress/types";

// ─── Temporary username helper (stub until task 11.4 ships) ───────────────────
/** Strips non-slug characters, trims to 32 chars, falls back to "agent". */
function toUsername(base: string): string {
  return base.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || "agent";
}

// ─── loadSnapshot ─────────────────────────────────────────────────────────────

/**
 * Load the full authoritative Snapshot for `profileId` from the DB.
 * Returns an empty Snapshot when the profile has no rows (first load after
 * Profile creation).
 */
export async function loadSnapshot(profileId: string): Promise<Snapshot> {
  const [missionRows, badgeRows, profileRow] = await Promise.all([
    prisma.missionProgress.findMany({
      where: { profileId },
      select: {
        missionId: true,
        status: true,
        completedAt: true,
        verified: true,
        verifiedAt: true,
        startedAt: true,
        hintsUsed: true,
        commandCount: true,
        completedObjectives: true,
      },
    }),
    prisma.unlockedBadge.findMany({
      where: { profileId },
      select: { badgeId: true },
    }),
    prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        totalCommands: true,
        terraformApplies: true,
        hintsUsed: true,
        missionsAttempted: true,
        streakDays: true,
        provider: true,
      },
    }),
  ]);

  // Build completions map
  const completions = new Map<string, Completion>();
  const inProgress = new Map<string, InProgressRow>();

  for (const row of missionRows) {
    if (row.status === "completed" && row.completedAt) {
      completions.set(row.missionId, {
        missionId: row.missionId,
        completedAt: row.completedAt,
        verified: row.verified,
        verifiedAt: row.verifiedAt,
      });
    } else if (row.status === "in_progress") {
      inProgress.set(row.missionId, {
        missionId: row.missionId,
        startedAt: row.startedAt,
        hintsUsed: row.hintsUsed,
        commandCount: row.commandCount,
        completedObjectives: row.completedObjectives,
      });
    }
  }

  const badges = new Set(badgeRows.map((r) => r.badgeId));

  const stats = profileRow
    ? {
        totalCommands: profileRow.totalCommands,
        terraformApplies: profileRow.terraformApplies,
        hintsUsed: profileRow.hintsUsed,
        missionsAttempted: profileRow.missionsAttempted,
        streakDays: profileRow.streakDays,
      }
    : {
        totalCommands: 0,
        terraformApplies: 0,
        hintsUsed: 0,
        missionsAttempted: 0,
        streakDays: 1,
      };

  const provider = (profileRow?.provider as Provider | null | undefined) ?? null;

  return { completions, badges, inProgress, stats, provider };
}

// ─── writeCompletion ──────────────────────────────────────────────────────────

/**
 * Persist a mission completion (or verify an existing unverified one) inside a
 * single interactive transaction. Idempotent: a second call for an already-
 * verified mission is a no-op at the DB level and does NOT re-write XP/level.
 *
 * On a P2034 serialisation / deadlock, the transaction is retried once.
 */
export async function writeCompletion(
  profileId: string,
  missionId: string,
  badgeId: string | undefined,
  now: Date,
): Promise<void> {
  const run = async (): Promise<void> => {
    await prisma.$transaction(async (tx) => {
      // ── a. Ensure the row exists (no-op if it already does) ───────────────
      await tx.missionProgress.upsert({
        where: { profileId_missionId: { profileId, missionId } },
        create: { profileId, missionId, status: "available" },
        update: {},
      });

      // ── b. Attempt to mark as completed (if not already) ──────────────────
      const completedCount = await tx.missionProgress.updateMany({
        where: {
          profileId,
          missionId,
          status: { not: "completed" },
        },
        data: {
          status: "completed",
          completedAt: now,
          verified: true,
          verifiedAt: now,
        },
      });

      // ── c. If already completed but unverified, verify it ────────────────
      if (completedCount.count === 0) {
        await tx.missionProgress.updateMany({
          where: {
            profileId,
            missionId,
            status: "completed",
            verified: false,
          },
          data: {
            verified: true,
            verifiedAt: now,
          },
        });
        // If verified was already true, this also matches 0 rows — that's fine
        // (idempotent for the fully-verified case).
      }

      // ── d. Award the badge (skip if no badgeId or already awarded) ────────
      if (badgeId) {
        await tx.unlockedBadge.createMany({
          data: [{ profileId, badgeId }],
          skipDuplicates: true,
        });
      }

      // ── e. Recompute XP / level from ALL completions, then update Profile ─
      const allCompletedRows = await tx.missionProgress.findMany({
        where: { profileId, status: "completed" },
        select: { missionId: true, completedAt: true, verified: true, verifiedAt: true },
      });

      const snapshot = buildSnapshotFromRows(allCompletedRows);
      const xp = derivedXp(snapshot);
      const lvl = level(xp);

      await tx.profile.update({
        where: { id: profileId },
        data: { xp, level: lvl, updatedAt: now },
      });
    });
  };

  try {
    await run();
  } catch (err: unknown) {
    if (isPrismaError(err, "P2034")) {
      // One retry on serialisation failure / deadlock
      await run();
    } else {
      throw err;
    }
  }
}

// ─── writeMerge ───────────────────────────────────────────────────────────────

/**
 * Write the result of `mergeProgress` back to the DB in one transaction.
 * Uses upserts and `createMany skipDuplicates` so the call is idempotent.
 * Stats are written as the max values already computed by `mergeProgress`,
 * satisfying the GREATEST semantics from the design.
 */
export async function writeMerge(
  profileId: string,
  snapshot: Snapshot,
  now: Date,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // ── Completion rows ────────────────────────────────────────────────────
    for (const [missionId, completion] of snapshot.completions) {
      await tx.missionProgress.upsert({
        where: { profileId_missionId: { profileId, missionId } },
        create: {
          profileId,
          missionId,
          status: "completed",
          completedAt: completion.completedAt,
          verified: completion.verified,
          verifiedAt: completion.verifiedAt,
        },
        update: {
          // Only advance toward completed / verified — never regress.
          status: "completed",
          completedAt: completion.completedAt,
          // Keep verified = true if already set; set it if merge says true.
          ...(completion.verified
            ? { verified: true, verifiedAt: completion.verifiedAt }
            : {}),
        },
      });
    }

    // ── In-progress rows ───────────────────────────────────────────────────
    for (const [missionId, row] of snapshot.inProgress) {
      await tx.missionProgress.upsert({
        where: { profileId_missionId: { profileId, missionId } },
        create: {
          profileId,
          missionId,
          status: "in_progress",
          startedAt: row.startedAt,
          hintsUsed: row.hintsUsed,
          commandCount: row.commandCount,
          completedObjectives: row.completedObjectives,
        },
        update: {
          // Don't overwrite completed rows with in-progress data.
          startedAt: row.startedAt,
          hintsUsed: row.hintsUsed,
          commandCount: row.commandCount,
          completedObjectives: row.completedObjectives,
        },
      });
    }

    // ── Badges ─────────────────────────────────────────────────────────────
    const badgeData = Array.from(snapshot.badges).map((badgeId) => ({
      profileId,
      badgeId,
    }));
    if (badgeData.length > 0) {
      await tx.unlockedBadge.createMany({
        data: badgeData,
        skipDuplicates: true,
      });
    }

    // ── Profile: stats (GREATEST), provider, XP/level ─────────────────────
    const xp = derivedXp(snapshot);
    const lvl = level(xp);

    await tx.profile.update({
      where: { id: profileId },
      data: {
        xp,
        level: lvl,
        totalCommands: snapshot.stats.totalCommands,
        terraformApplies: snapshot.stats.terraformApplies,
        hintsUsed: snapshot.stats.hintsUsed,
        missionsAttempted: snapshot.stats.missionsAttempted,
        streakDays: snapshot.stats.streakDays,
        ...(snapshot.provider !== null ? { provider: snapshot.provider } : {}),
        updatedAt: now,
      },
    });
  });
}

// ─── writeStats ───────────────────────────────────────────────────────────────

type StatsDeltaFields = Partial<
  Record<"totalCommands" | "terraformApplies" | "hintsUsed" | "missionsAttempted", number>
>;

/**
 * Increment cosmetic stats on a Profile and update `streakDays`:
 * - Same UTC day → no change to streakDays.
 * - Previous UTC day → streakDays + 1.
 * - Older → reset to 1.
 * All stat values are clamped to [0, STAT_MAX].
 */
export async function writeStats(
  profileId: string,
  delta: StatsDeltaFields,
  now: Date,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const current = await tx.profile.findUnique({
      where: { id: profileId },
      select: {
        totalCommands: true,
        terraformApplies: true,
        hintsUsed: true,
        missionsAttempted: true,
        streakDays: true,
        lastActiveAt: true,
      },
    });

    if (!current) return;

    const clamp = (value: number): number =>
      Math.min(STAT_MAX, Math.max(0, value));

    const newStats = {
      totalCommands: clamp(current.totalCommands + (delta.totalCommands ?? 0)),
      terraformApplies: clamp(current.terraformApplies + (delta.terraformApplies ?? 0)),
      hintsUsed: clamp(current.hintsUsed + (delta.hintsUsed ?? 0)),
      missionsAttempted: clamp(current.missionsAttempted + (delta.missionsAttempted ?? 0)),
    };

    const streakDays = computeStreakDays(current.streakDays, current.lastActiveAt, now);

    await tx.profile.update({
      where: { id: profileId },
      data: {
        ...newStats,
        streakDays,
        lastActiveAt: now,
        updatedAt: now,
      },
    });
  });
}

// ─── ensureProfile ────────────────────────────────────────────────────────────

/**
 * Upsert a Profile by `userId`. Creates one (with a unique username derived
 * from `login`) if it doesn't exist. Returns the profileId.
 *
 * On a P2002 username collision the suffix `-2`…`-20` is tried, then a
 * 6-hex-char random suffix.
 */
export async function ensureProfile(
  userId: string,
  login: string,
  image: string | null,
): Promise<string> {
  // Fast path: profile already exists.
  const existing = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (existing) return existing.id;

  // Try to create with the base username, then with collision suffixes.
  const base = toUsername(login);
  const candidates = [
    base,
    ...Array.from({ length: 19 }, (_, i) => `${base}-${i + 2}`),
  ];

  for (const username of candidates) {
    try {
      const created = await prisma.profile.create({
        data: {
          userId,
          username,
          xp: 0,
          level: 1,
        },
        select: { id: true },
      });

      // Also update the User.image (best-effort; ignore failure).
      if (image !== null) {
        await prisma.user
          .update({ where: { id: userId }, data: { image } })
          .catch(() => undefined);
      }

      return created.id;
    } catch (err: unknown) {
      if (isPrismaError(err, "P2002")) {
        // Username collision — try the next candidate.
        continue;
      }
      // For P2034 or any other error: one retry attempt on the same username.
      if (isPrismaError(err, "P2034")) {
        const retried = await prisma.profile.upsert({
          where: { userId },
          create: { userId, username, xp: 0, level: 1 },
          update: {},
          select: { id: true },
        });
        return retried.id;
      }
      throw err;
    }
  }

  // All 20 suffix candidates exhausted — use a random hex suffix.
  const hex = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0");
  const fallback = `${base}-${hex}`.slice(0, 40);
  const created = await prisma.profile.create({
    data: { userId, username: fallback, xp: 0, level: 1 },
    select: { id: true },
  });
  return created.id;
}

// ─── buildProgressDTO ─────────────────────────────────────────────────────────

/**
 * Load the full state for `profileId` and build the `ProgressDTO` that the
 * API handlers return on every 200 response.
 *
 * Unlocked missions that have no row yet are included with `status: "available"`.
 * Locked missions are omitted (same as the store today).
 */
export async function buildProgressDTO(profileId: string): Promise<ProgressDTO> {
  const [snapshot, profileRow, allMissionRows] = await Promise.all([
    loadSnapshot(profileId),
    prisma.profile.findUniqueOrThrow({
      where: { id: profileId },
      select: {
        username: true,
        streakDays: true,
        provider: true,
        user: { select: { image: true } },
      },
    }),
    // Fetch display fields (hintsUsed, commandCount, completedObjectives) for all rows.
    prisma.missionProgress.findMany({
      where: { profileId },
      select: {
        missionId: true,
        startedAt: true,
        hintsUsed: true,
        commandCount: true,
        completedObjectives: true,
      },
    }),
  ]);

  // Index display fields by missionId for O(1) lookup.
  const displayByMission = new Map(
    allMissionRows.map((r) => [
      r.missionId,
      {
        startedAt: r.startedAt,
        hintsUsed: r.hintsUsed,
        commandCount: r.commandCount,
        completedObjectives: r.completedObjectives,
      },
    ]),
  );

  const xp = derivedXp(snapshot);
  const { currentLevel } = getLevelInfo(xp);

  // Build the missions map (available + in_progress + completed; locked omitted).
  const missions: ProgressDTO["missions"] = {};

  for (const mission of MISSIONS) {
    const mId = mission.id;
    const completion = snapshot.completions.get(mId);
    const inProg = snapshot.inProgress.get(mId);
    const unlocked = isUnlocked(mId, snapshot);
    const display = displayByMission.get(mId);

    if (completion) {
      missions[mId] = {
        status: "completed",
        verified: completion.verified,
        completedAt: completion.completedAt.toISOString(),
        startedAt: display?.startedAt?.toISOString() ?? null,
        hintsUsed: display?.hintsUsed ?? 0,
        commandCount: display?.commandCount ?? 0,
        completedObjectives: display?.completedObjectives ?? [],
      };
    } else if (inProg) {
      missions[mId] = {
        status: "in_progress",
        verified: false,
        completedAt: null,
        startedAt: inProg.startedAt?.toISOString() ?? null,
        hintsUsed: inProg.hintsUsed,
        commandCount: inProg.commandCount,
        completedObjectives: inProg.completedObjectives,
      };
    } else if (unlocked) {
      missions[mId] = {
        status: "available",
        verified: false,
        completedAt: null,
        startedAt: null,
        hintsUsed: 0,
        commandCount: 0,
        completedObjectives: [],
      };
    }
    // Locked → omitted from response.
  }

  // Verified XP: sum over verified completions only.
  let verifiedXp = 0;
  for (const c of snapshot.completions.values()) {
    if (c.verified) {
      const m = getMission(c.missionId);
      if (m) {
        const bonus = m.badgeId ? (getBadge(m.badgeId)?.xpBonus ?? 0) : 0;
        verifiedXp += m.xpReward + bonus;
      }
    }
  }

  return {
    profile: {
      username: profileRow.username,
      image: profileRow.user?.image ?? null,
      xp,
      level: currentLevel.level,
      title: currentLevel.title,
      verifiedXp,
      provider: (profileRow.provider as Provider | null) ?? null,
      stats: {
        totalCommands: snapshot.stats.totalCommands,
        terraformApplies: snapshot.stats.terraformApplies,
        hintsUsed: snapshot.stats.hintsUsed,
        missionsAttempted: snapshot.stats.missionsAttempted,
        streakDays: profileRow.streakDays,
      },
    },
    missions,
    badges: Array.from(snapshot.badges),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal Snapshot from flat DB completion rows (for XP recomputation). */
function buildSnapshotFromRows(
  rows: Array<{ missionId: string; completedAt: Date | null; verified: boolean; verifiedAt: Date | null }>,
): Snapshot {
  const completions = new Map<string, Completion>();
  for (const row of rows) {
    if (row.completedAt) {
      completions.set(row.missionId, {
        missionId: row.missionId,
        completedAt: row.completedAt,
        verified: row.verified,
        verifiedAt: row.verifiedAt,
      });
    }
  }
  return {
    completions,
    badges: new Set(),
    inProgress: new Map(),
    stats: { totalCommands: 0, terraformApplies: 0, hintsUsed: 0, missionsAttempted: 0, streakDays: 1 },
    provider: null,
  };
}

/** Check whether an unknown error is a specific Prisma client error code. */
function isPrismaError(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === code
  );
}

/**
 * Derive the new streakDays value from the last active date and now (UTC).
 * - Same UTC day  → unchanged.
 * - Yesterday UTC → +1.
 * - Older         → reset to 1.
 */
function computeStreakDays(current: number, lastActiveAt: Date, now: Date): number {
  const toUtcDay = (d: Date): number =>
    Math.floor(d.getTime() / 86_400_000);

  const lastDay = toUtcDay(lastActiveAt);
  const nowDay = toUtcDay(now);
  const diff = nowDay - lastDay;

  if (diff === 0) return current;
  if (diff === 1) return current + 1;
  return 1;
}
