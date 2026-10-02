import type { Provider } from "../providers";
import type { PlayerStats } from "../types";
import { getLevelInfo } from "../types";
import { MISSIONS, getMission } from "@/data/missions";
import { getBadge } from "@/data/badges";

/**
 * The authoritative, pure progress rules shared by the browser and the Server.
 *
 * Everything here is deterministic: no `Date.now()`, no `Math.random`, no I/O.
 * The caller passes `now` in. XP, level and badges are always *derived* from the
 * set of completions — client-sent XP/level/badge/verified values are never trusted.
 */

/** Upper bound each cosmetic stat is clamped to (R5.10). */
export const STAT_MAX = 1_000_000;

/** A single mission completion as tracked server-side. */
export interface Completion {
  missionId: string;
  completedAt: Date;
  verified: boolean;
  verifiedAt: Date | null;
}

/**
 * A display-only in-progress row. Mirrors the relevant fields of the store's
 * `MissionProgress`; it is never used to decide completion.
 */
export interface InProgressRow {
  missionId: string;
  startedAt: Date | null;
  hintsUsed: number;
  commandCount: number;
  completedObjectives: string[];
}

/** The full authoritative progress snapshot for one profile. */
export interface Snapshot {
  completions: Map<string, Completion>;
  badges: Set<string>;
  inProgress: Map<string, InProgressRow>;
  stats: PlayerStats;
  provider: Provider | null;
}

/**
 * XP a single mission is worth: its own `xpReward` plus the `xpBonus` of the
 * badge named by its own `badgeId` (and only that badge). Chapter/streak badges
 * are never awarded here, so they never contribute to XP. Unknown mission → 0.
 */
export function missionXp(id: string): number {
  const mission = getMission(id);
  if (!mission) return 0;
  const bonus = mission.badgeId ? getBadge(mission.badgeId)?.xpBonus ?? 0 : 0;
  return mission.xpReward + bonus;
}

/** Total XP derived from every completion in the snapshot. */
export function derivedXp(s: Snapshot): number {
  let total = 0;
  for (const missionId of s.completions.keys()) {
    total += missionXp(missionId);
  }
  return total;
}

/** Total XP derived from verified completions only (R7.3). Always ≤ derivedXp. */
export function verifiedXp(s: Snapshot): number {
  let total = 0;
  for (const c of s.completions.values()) {
    if (c.verified) total += missionXp(c.missionId);
  }
  return total;
}

/** Numeric level for a given XP total, via the shared client leveling table. */
export function level(xp: number): number {
  return getLevelInfo(xp).currentLevel.level;
}

/** Level title for a given XP total, via the shared client leveling table. */
export function levelTitle(xp: number): string {
  return getLevelInfo(xp).currentLevel.title;
}

/**
 * Whether a mission is unlocked for this snapshot: `mission-01` is always
 * unlocked, otherwise some completed mission (verified or not) must list it
 * in its `unlocks` (R5.2).
 */
export function isUnlocked(id: string, s: Snapshot): boolean {
  if (id === "mission-01") return true;
  for (const mission of MISSIONS) {
    if (s.completions.has(mission.id) && mission.unlocks?.includes(id)) {
      return true;
    }
  }
  return false;
}

/**
 * Apply a completion, returning a new snapshot (pure; never mutates its input).
 * Three cases (R5.8, R5.9):
 *  - not completed:        add a verified completion (completedAt = now) and the mission's own badge.
 *  - completed, unverified: verify it (verifiedAt = now); completedAt and badges unchanged.
 *  - completed, verified:   unchanged.
 */
export function applyCompletion(s: Snapshot, id: string, now: Date): Snapshot {
  const existing = s.completions.get(id);

  if (existing?.verified) {
    // Already verified — nothing changes.
    return s;
  }

  const completions = new Map(s.completions);
  const badges = new Set(s.badges);

  if (!existing) {
    // Not completed → add a fresh verified completion plus the mission's own badge.
    completions.set(id, {
      missionId: id,
      completedAt: now,
      verified: true,
      verifiedAt: now,
    });
    const badgeId = getMission(id)?.badgeId;
    if (badgeId) badges.add(badgeId);
  } else {
    // Completed but unverified → verify only; completedAt and badges unchanged.
    completions.set(id, {
      ...existing,
      verified: true,
      verifiedAt: now,
    });
  }

  return { ...s, completions, badges };
}

/**
 * A bounded, non-negative cosmetic stats increment. Each present field is a
 * non-negative integer added to the stat; `streakDays` is Server-managed and
 * not part of a client delta.
 */
export type StatsIncrement = Partial<Pick<
  PlayerStats,
  "totalCommands" | "terraformApplies" | "hintsUsed" | "missionsAttempted"
>>;

/**
 * Apply a stats delta, per field, clamped to [0, STAT_MAX]. Never decreases a
 * stat: a non-negative delta can only hold a stat steady (once at STAT_MAX) or
 * raise it (R5.10).
 */
export function applyStats(stats: PlayerStats, delta: StatsIncrement): PlayerStats {
  const bump = (current: number, add: number | undefined): number => {
    const next = current + (add ?? 0);
    if (next < 0) return 0;
    if (next > STAT_MAX) return STAT_MAX;
    return next;
  };

  return {
    totalCommands: bump(stats.totalCommands, delta.totalCommands),
    terraformApplies: bump(stats.terraformApplies, delta.terraformApplies),
    hintsUsed: bump(stats.hintsUsed, delta.hintsUsed),
    missionsAttempted: bump(stats.missionsAttempted, delta.missionsAttempted),
    streakDays: stats.streakDays,
  };
}
