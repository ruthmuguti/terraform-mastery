import type { Provider } from "../providers";
import type {
  Transcript,
  TranscriptStep,
  StatsDelta,
  LocalProgressDTO,
} from "./types";
import { MISSIONS } from "@/data/missions";

/**
 * Hand-written request-body validators for the Progress API (no zod).
 *
 * The validators return a discriminated result rather than throwing, so route
 * handlers can map `status` straight to an HTTP response. They are pure: no I/O,
 * no clock, no randomness. Body-size (> 1 MB) is enforced upstream by
 * `readJsonLimited`; these validators handle Transcript/field-level limits and
 * shape.
 *
 * Order matters and matches the design's "Validation rules" section:
 *   1. size limits  → 413 (TOO_LARGE)
 *   2. shape        → 400 (INVALID)
 *   3. membership   → 400 (UNKNOWN_MISSION)
 */

// ─────────────────────────────────────────────
// Error codes (design's "Progress API" error body)
// ─────────────────────────────────────────────

/** Error codes the Progress API returns in `{ error: { code, message } }`. */
export type ValidationErrorCode =
  | "UNKNOWN_MISSION"
  | "INVALID"
  | "TOO_LARGE"
  | "LOCKED"
  | "NOT_PASSED"
  | "RATE_LIMITED"
  | "UNAUTHENTICATED";

/** Discriminated validation result. On failure, `status` is the HTTP status to return. */
export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 413; code: ValidationErrorCode; message: string };

// ─────────────────────────────────────────────
// Limits / caps (single source of truth)
// ─────────────────────────────────────────────

/** Transcript limits (R4.6). */
export const MAX_TRANSCRIPT_STEPS = 300;
export const MAX_STEP_HCL_BYTES = 65_536; // 64 KB

/** StatsDelta per-field caps (R5.10). Each present field must be an integer in [0, cap]. */
export const STATS_CAPS = {
  totalCommands: 500,
  terraformApplies: 100,
  hintsUsed: 100,
  missionsAttempted: 20,
} as const;

/** missionActivity per-request caps (R6.3/R6.4). */
export const ACTIVITY_CAPS = {
  hints: 100,
  commands: 500,
} as const;

const VALID_KINDS = new Set(["run", "check", "reset"]);
const VALID_PROVIDERS = new Set<Provider>(["aws", "gcp", "azure"]);

// ─────────────────────────────────────────────
// Reusable guards
// ─────────────────────────────────────────────

/** Narrows an unknown value to the `Provider` union ("aws" | "gcp" | "azure"). */
export function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && VALID_PROVIDERS.has(value as Provider);
}

/** True for a non-negative integer (0, 1, 2, …). Rejects NaN, floats, negatives, Infinity. */
export function isNonNegInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** True for a plain object (not null, not an array). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Byte length of a string using UTF-8 (matches what the Server reads off the wire). */
function byteLength(s: string): number {
  // Available in both Node and modern browsers; validate.ts runs on both.
  return new TextEncoder().encode(s).length;
}

// ─────────────────────────────────────────────
// Transcript validation
// ─────────────────────────────────────────────

function fail<T>(
  status: 400 | 413,
  code: ValidationErrorCode,
  message: string,
): ValidationResult<T> {
  return { ok: false, status, code, message };
}

/**
 * Validate a Transcript. Enforces size first (413), then shape (400).
 * Returns a fresh, field-copied Transcript (unknown fields dropped).
 */
function validateTranscript(raw: unknown): ValidationResult<Transcript> {
  if (!isRecord(raw)) {
    return fail(400, "INVALID", "transcript must be an object.");
  }

  const steps = raw.steps;

  // 1. SIZE first — before shape — so a huge body is a 413 even if also malformed.
  if (Array.isArray(steps) && steps.length > MAX_TRANSCRIPT_STEPS) {
    return fail(
      413,
      "TOO_LARGE",
      `transcript has too many steps (max ${MAX_TRANSCRIPT_STEPS}).`,
    );
  }
  if (Array.isArray(steps)) {
    for (const step of steps) {
      if (isRecord(step) && typeof step.hcl === "string" && byteLength(step.hcl) > MAX_STEP_HCL_BYTES) {
        return fail(
          413,
          "TOO_LARGE",
          `a transcript step's hcl exceeds the ${MAX_STEP_HCL_BYTES}-byte limit.`,
        );
      }
    }
  }

  // 2. SHAPE.
  if (!Array.isArray(steps)) {
    return fail(400, "INVALID", "transcript.steps must be an array.");
  }
  if (!isProvider(raw.provider)) {
    return fail(400, "INVALID", "transcript.provider must be one of: aws, gcp, azure.");
  }

  const cleanSteps: TranscriptStep[] = [];
  for (const step of steps) {
    if (!isRecord(step)) {
      return fail(400, "INVALID", "each transcript step must be an object.");
    }
    if (typeof step.command !== "string") {
      return fail(400, "INVALID", "each transcript step's command must be a string.");
    }
    if (typeof step.hcl !== "string") {
      return fail(400, "INVALID", "each transcript step's hcl must be a string.");
    }
    let kind: TranscriptStep["kind"];
    if (step.kind !== undefined) {
      if (typeof step.kind !== "string" || !VALID_KINDS.has(step.kind)) {
        return fail(400, "INVALID", "transcript step kind must be one of: run, check, reset.");
      }
      kind = step.kind as TranscriptStep["kind"];
    }
    // Copy known fields only.
    const cleanStep: TranscriptStep = { command: step.command, hcl: step.hcl };
    if (kind !== undefined) cleanStep.kind = kind;
    cleanSteps.push(cleanStep);
  }

  return { ok: true, value: { provider: raw.provider, steps: cleanSteps } };
}

/**
 * Validate the body of `POST /api/progress/complete`:
 * `{ missionId: string, transcript: Transcript }`.
 *
 * Any client-sent `userId`/`profileId`/`xp`/`level`/`badges`/`verified` are ignored —
 * only `missionId` and `transcript` are copied into the result.
 */
export function validateCompletionBody(
  raw: unknown,
): ValidationResult<{ missionId: string; transcript: Transcript }> {
  if (!isRecord(raw)) {
    return fail(400, "INVALID", "request body must be an object.");
  }

  // Transcript limits (413) and shape (400) first — size before membership.
  const transcript = validateTranscript(raw.transcript);
  if (!transcript.ok) return transcript;

  // Membership last.
  if (typeof raw.missionId !== "string") {
    return fail(400, "UNKNOWN_MISSION", "missionId must be a string.");
  }
  if (!MISSIONS.some((m) => m.id === raw.missionId)) {
    return fail(400, "UNKNOWN_MISSION", `unknown missionId: ${raw.missionId}.`);
  }

  return { ok: true, value: { missionId: raw.missionId, transcript: transcript.value } };
}

// ─────────────────────────────────────────────
// Merge validation
// ─────────────────────────────────────────────

/**
 * Loosely validate `POST /api/progress/merge` body `{ local: LocalProgressDTO }`.
 * The merge is defensive (filters to catalog IDs, clamps stats), so this only
 * enforces coarse shape: `local` must be an object with a null-or-object `profile`
 * and a record `missionProgress`. Known fields are copied; everything else is dropped.
 * The merge module re-validates values; this just rejects obviously wrong shapes (400).
 */
export function validateMergeBody(
  raw: unknown,
): ValidationResult<{ local: LocalProgressDTO }> {
  if (!isRecord(raw)) {
    return fail(400, "INVALID", "request body must be an object.");
  }
  const local = raw.local;
  if (!isRecord(local)) {
    return fail(400, "INVALID", "local must be an object.");
  }

  // profile: null or an object.
  if (local.profile !== null && !isRecord(local.profile)) {
    return fail(400, "INVALID", "local.profile must be an object or null.");
  }

  // missionProgress: a record (object) when present.
  const missionProgress = local.missionProgress ?? {};
  if (!isRecord(missionProgress)) {
    return fail(400, "INVALID", "local.missionProgress must be an object.");
  }

  let profile: LocalProgressDTO["profile"] = null;
  if (isRecord(local.profile)) {
    const p = local.profile;
    const username = typeof p.username === "string" ? p.username : "";
    const provider = isProvider(p.provider) ? p.provider : "aws";
    const completedMissions = Array.isArray(p.completedMissions)
      ? p.completedMissions.filter((x): x is string => typeof x === "string")
      : [];
    const unlockedBadges = Array.isArray(p.unlockedBadges)
      ? p.unlockedBadges.filter((x): x is string => typeof x === "string")
      : [];
    const rawStats = isRecord(p.stats) ? p.stats : {};
    const stats = {
      totalCommands: isNonNegInt(rawStats.totalCommands) ? rawStats.totalCommands : 0,
      terraformApplies: isNonNegInt(rawStats.terraformApplies) ? rawStats.terraformApplies : 0,
      hintsUsed: isNonNegInt(rawStats.hintsUsed) ? rawStats.hintsUsed : 0,
      missionsAttempted: isNonNegInt(rawStats.missionsAttempted) ? rawStats.missionsAttempted : 0,
      streakDays: isNonNegInt(rawStats.streakDays) ? rawStats.streakDays : 0,
    };
    profile = { username, provider, completedMissions, unlockedBadges, stats };
  }

  return {
    ok: true,
    value: {
      local: {
        profile,
        // The merge module reads only known fields off each row; pass through as-is.
        missionProgress: missionProgress as LocalProgressDTO["missionProgress"],
      },
    },
  };
}

// ─────────────────────────────────────────────
// Stats / PATCH validation
// ─────────────────────────────────────────────

/**
 * Validate a `StatsDelta`: each present field must be a non-negative integer within
 * its per-field cap (R5.10). `streakDays` is NOT client-writable — if present it is
 * ignored (dropped), never trusted. Returns a fresh, field-copied delta.
 */
export function validateStatsDelta(raw: unknown): ValidationResult<StatsDelta> {
  if (!isRecord(raw)) {
    return fail(400, "INVALID", "stats must be an object.");
  }

  const out: StatsDelta = {};
  for (const field of ["totalCommands", "terraformApplies", "hintsUsed", "missionsAttempted"] as const) {
    const v = raw[field];
    if (v === undefined) continue;
    if (!isNonNegInt(v)) {
      return fail(400, "INVALID", `stats.${field} must be a non-negative integer.`);
    }
    if (v > STATS_CAPS[field]) {
      return fail(400, "INVALID", `stats.${field} exceeds the cap of ${STATS_CAPS[field]}.`);
    }
    out[field] = v;
  }
  // `streakDays` and any other field are intentionally ignored.
  return { ok: true, value: out };
}

/** Validated `missionActivity` payload from a PATCH body. */
export interface MissionActivityInput {
  missionId: string;
  started?: true;
  hints?: number;
  commands?: number;
}

/** Validated `PATCH /api/progress` body. */
export interface PatchBody {
  provider?: Provider;
  stats?: StatsDelta;
  missionActivity?: MissionActivityInput;
}

/**
 * Validate the body of `PATCH /api/progress`:
 * `{ provider?: Provider, stats?: StatsDelta, missionActivity?: { missionId, started?, hints?, commands? } }`.
 * Copies known fields only; ignores any injected `userId`/`profileId`/`xp`/`level`/`badges`/`verified`.
 */
export function validatePatchBody(raw: unknown): ValidationResult<PatchBody> {
  if (!isRecord(raw)) {
    return fail(400, "INVALID", "request body must be an object.");
  }

  const out: PatchBody = {};

  if (raw.provider !== undefined) {
    if (!isProvider(raw.provider)) {
      return fail(400, "INVALID", "provider must be one of: aws, gcp, azure.");
    }
    out.provider = raw.provider;
  }

  if (raw.stats !== undefined) {
    const stats = validateStatsDelta(raw.stats);
    if (!stats.ok) return stats;
    out.stats = stats.value;
  }

  if (raw.missionActivity !== undefined) {
    const activity = raw.missionActivity;
    if (!isRecord(activity)) {
      return fail(400, "INVALID", "missionActivity must be an object.");
    }
    if (typeof activity.missionId !== "string") {
      return fail(400, "UNKNOWN_MISSION", "missionActivity.missionId must be a string.");
    }
    if (!MISSIONS.some((m) => m.id === activity.missionId)) {
      return fail(400, "UNKNOWN_MISSION", `unknown missionId: ${activity.missionId}.`);
    }

    const clean: MissionActivityInput = { missionId: activity.missionId };

    if (activity.started !== undefined) {
      if (activity.started !== true) {
        return fail(400, "INVALID", "missionActivity.started must be true when present.");
      }
      clean.started = true;
    }
    if (activity.hints !== undefined) {
      if (!isNonNegInt(activity.hints)) {
        return fail(400, "INVALID", "missionActivity.hints must be a non-negative integer.");
      }
      if (activity.hints > ACTIVITY_CAPS.hints) {
        return fail(400, "INVALID", `missionActivity.hints exceeds the cap of ${ACTIVITY_CAPS.hints}.`);
      }
      clean.hints = activity.hints;
    }
    if (activity.commands !== undefined) {
      if (!isNonNegInt(activity.commands)) {
        return fail(400, "INVALID", "missionActivity.commands must be a non-negative integer.");
      }
      if (activity.commands > ACTIVITY_CAPS.commands) {
        return fail(400, "INVALID", `missionActivity.commands exceeds the cap of ${ACTIVITY_CAPS.commands}.`);
      }
      clean.commands = activity.commands;
    }

    out.missionActivity = clean;
  }

  return { ok: true, value: out };
}
