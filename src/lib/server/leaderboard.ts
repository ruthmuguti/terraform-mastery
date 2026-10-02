/**
 * Leaderboard query and pure ranker.
 *
 * `rankProfiles` is a pure function exported for property testing (Property 12).
 * `getLeaderboard` runs the Prisma query with an explicit field whitelist — no
 * email, userId, account tokens or any User/Account field is loaded or returned.
 *
 * Feature: progress-sync, Property 12: Leaderboard ranking
 */

import { prisma } from "../db";
import { missionXp, level, levelTitle } from "../progress/rules";

// ─── Public types ───────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  name: string;
  avatarUrl: string | null;
  verifiedXp: number;
  level: number;
  title: string;
  verifiedCount: number;
}

export interface LeaderboardDTO {
  /** Top 100 profiles by verified XP. */
  entries: LeaderboardEntry[];
  /** The viewing user's row (including rank even if outside top 100), or null if signed out. */
  me: (LeaderboardEntry & { inTop: boolean }) | null;
}

// ─── Prisma row shape ────────────────────────────────────────────────────────

/** The shape returned by the explicit-select Prisma query in getLeaderboard(). */
export interface ProfileRow {
  id: string;
  userId: string;
  username: string;
  user: { image: string | null };
  missionProgress: Array<{ missionId: string; verifiedAt: Date | null }>;
}

// ─── Internal ranked shape (before mapping to the public DTO) ────────────────

interface RankedEntry extends LeaderboardEntry {
  profileId: string;
  inTop: boolean;
}

// ─── Pure ranker (exported for testing) ─────────────────────────────────────

/**
 * Pure function: takes the Prisma query rows and an optional viewer profile ID,
 * returns a `LeaderboardDTO`.
 *
 * Algorithm (R9.1–R9.4):
 * 1. For each profile, sum `missionXp` over verified completed missions →
 *    `verifiedXp`; take the max `verifiedAt` → `lastVerifiedAt`. Skip profiles
 *    with 0 verified XP.
 * 2. Sort: verifiedXp DESC, lastVerifiedAt ASC (reached that XP earlier = higher),
 *    username ASC for a deterministic tie-break.
 * 3. Assign ranks 1..n.
 * 4. `entries` = top 100 mapped through the whitelist mapper.
 * 5. `me` = the viewer's entry from the full ordered list (rank even outside
 *    top 100), or null if no viewerProfileId / viewer not in the list.
 */
export function rankProfiles(
  rows: ProfileRow[],
  viewerProfileId?: string,
): LeaderboardDTO {
  // Step 1: Compute per-profile stats.
  type Scored = {
    profileId: string;
    username: string;
    avatarUrl: string | null;
    verifiedXp: number;
    lastVerifiedAt: Date | null;
    verifiedCount: number;
  };

  const scored: Scored[] = [];

  for (const row of rows) {
    let verifiedXp = 0;
    let lastVerifiedAt: Date | null = null;

    for (const mp of row.missionProgress) {
      verifiedXp += missionXp(mp.missionId);
      if (mp.verifiedAt !== null) {
        if (lastVerifiedAt === null || mp.verifiedAt > lastVerifiedAt) {
          lastVerifiedAt = mp.verifiedAt;
        }
      }
    }

    // Exclude profiles with no verified XP (R9.1: "ranked by Verified XP").
    if (verifiedXp === 0) continue;

    scored.push({
      profileId: row.id,
      username: row.username,
      avatarUrl: row.user.image,
      verifiedXp,
      lastVerifiedAt,
      verifiedCount: row.missionProgress.length,
    });
  }

  // Step 2: Sort — verifiedXp DESC, lastVerifiedAt ASC, username ASC.
  scored.sort((a, b) => {
    if (b.verifiedXp !== a.verifiedXp) return b.verifiedXp - a.verifiedXp;

    // Earlier lastVerifiedAt = higher rank (reached this XP sooner).
    const aTime = a.lastVerifiedAt?.getTime() ?? Infinity;
    const bTime = b.lastVerifiedAt?.getTime() ?? Infinity;
    if (aTime !== bTime) return aTime - bTime;

    return a.username.localeCompare(b.username);
  });

  // Step 3: Assign ranks.
  const ranked: RankedEntry[] = scored.map((s, i) => {
    const xp = s.verifiedXp;
    const inTop = i < 100;
    return {
      profileId: s.profileId,
      rank: i + 1,
      name: s.username,
      avatarUrl: s.avatarUrl,
      verifiedXp: xp,
      level: level(xp),
      title: levelTitle(xp),
      verifiedCount: s.verifiedCount,
      inTop,
    };
  });

  // Step 4: Top 100 entries, whitelist-mapped (no profileId exposed).
  const entries: LeaderboardEntry[] = ranked.slice(0, 100).map(toEntry);

  // Step 5: Viewer's row — full list, rank even outside top 100.
  let me: (LeaderboardEntry & { inTop: boolean }) | null = null;
  if (viewerProfileId !== undefined) {
    const viewerRow = ranked.find((r) => r.profileId === viewerProfileId);
    if (viewerRow) {
      me = { ...toEntry(viewerRow), inTop: viewerRow.inTop };
    }
  }

  return { entries, me };
}

/** Whitelist mapper: only the public LeaderboardEntry fields — no profileId/userId. */
function toEntry(r: RankedEntry): LeaderboardEntry {
  return {
    rank: r.rank,
    name: r.name,
    avatarUrl: r.avatarUrl,
    verifiedXp: r.verifiedXp,
    level: r.level,
    title: r.title,
    verifiedCount: r.verifiedCount,
  };
}

// ─── DB query ────────────────────────────────────────────────────────────────

/**
 * Loads all profiles with their verified completed missions, then calls
 * `rankProfiles`. On any DB error, logs and returns an empty DTO so the route
 * handler can return 503.
 *
 * The Prisma `select` is explicit: no email, no User.accounts, no User.sessions,
 * no OAuth tokens of any kind.
 */
export async function getLeaderboard(
  viewerUserId?: string,
): Promise<LeaderboardDTO> {
  try {
    // One query: fetch all profiles with their verified completed mission rows.
    const rows = await prisma.profile.findMany({
      select: {
        id: true,
        userId: true,
        username: true,
        user: {
          select: {
            image: true,
          },
        },
        missionProgress: {
          where: {
            verified: true,
            status: "completed",
          },
          select: {
            missionId: true,
            verifiedAt: true,
          },
        },
      },
    });

    // Resolve the viewer's profile ID from their userId (if signed in).
    let viewerProfileId: string | undefined;
    if (viewerUserId !== undefined) {
      const viewer = rows.find((r) => r.userId === viewerUserId);
      viewerProfileId = viewer?.id;
    }

    return rankProfiles(rows, viewerProfileId);
  } catch (err) {
    console.error("[leaderboard] DB error:", err);
    return { entries: [], me: null };
  }
}
