import type { Provider } from "../providers";
import type { PlayerStats } from "../types";
import type { MissionProgress } from "../store";

/**
 * One recorded step of a mission attempt. Captures the executed command and the
 * editor HCL at that moment so the Server can replay the attempt deterministically.
 * `kind` refines R4's `{ command, hcl }` without breaking it (omitted = "run"):
 * - "run":   a command was executed (empty command allowed; the browser pushes it to history too)
 * - "check": an objective latched from an HCL edit (or on mount, from the starter code)
 * - "reset": the user pressed "Reset terminal" (sim state and history cleared, latches kept)
 */
export interface TranscriptStep {
  command: string; // "" allowed for check/reset steps
  hcl: string; // editor HCL at that moment
  kind?: "run" | "check" | "reset"; // default "run"
}

/** A full recorded mission attempt for a fixed provider, replayed by the Server to verify completion. */
export interface Transcript {
  provider: Provider;
  steps: TranscriptStep[];
}

/** Mission status as persisted in the store. "available" is derived server-side (unlocked, no row). */
export type MissionStatusDTO = "available" | "in_progress" | "completed";

/** Per-mission progress as returned by the Server. Locked missions are omitted (same as the store today). */
export interface MissionProgressDTO {
  status: MissionStatusDTO;
  verified: boolean;
  completedAt: string | null;
  startedAt: string | null;
  hintsUsed: number;
  commandCount: number;
  completedObjectives: string[];
}

/**
 * The authoritative progress snapshot returned by every 200 response except the leaderboard.
 * XP, level, verifiedXp and badges are all derived server-side from verified completions.
 */
export interface ProgressDTO {
  profile: {
    username: string;
    image: string | null;
    xp: number;
    level: number;
    title: string;
    verifiedXp: number;
    provider: Provider | null;
    /** Mirrors PlayerStats (minus `streakDays`, which is Server-managed but still surfaced). */
    stats: Pick<
      PlayerStats,
      "totalCommands" | "terraformApplies" | "hintsUsed" | "missionsAttempted" | "streakDays"
    >;
  };
  missions: Record<string, MissionProgressDTO>;
  badges: string[];
}

/**
 * The browser's persisted progress, sent once to `POST /api/progress/merge` on first sign-in.
 * Shape mirrors the zustand store (its `profile` + `missionProgress`). The Server ignores any
 * client-sent `xp`, `level`, `badges` or `verified`; those are re-derived from completions.
 */
export interface LocalProgressDTO {
  profile: {
    username: string;
    provider: Provider;
    completedMissions: string[];
    unlockedBadges: string[];
    stats: PlayerStats;
  } | null;
  missionProgress: Record<string, MissionProgress>;
}

/**
 * A bounded, cosmetic stats increment sent via `PATCH /api/progress`.
 * Each present field must be a non-negative integer within the Server's per-field cap.
 * `streakDays` is not client-writable (the Server derives it).
 */
export interface StatsDelta {
  totalCommands?: number;
  terraformApplies?: number;
  hintsUsed?: number;
  missionsAttempted?: number;
}
