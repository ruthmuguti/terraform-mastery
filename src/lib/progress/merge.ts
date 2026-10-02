import type { Provider } from "../providers";
import { PROVIDERS } from "../providers";
import type { PlayerStats } from "../types";
import type { Completion, InProgressRow, Snapshot } from "./rules";
import { STAT_MAX } from "./rules";
import type { LocalProgressDTO } from "./types";
import { MISSIONS, getMission } from "@/data/missions";

/**
 * Merge the browser's local progress into the Server snapshot, once, on first
 * sign-in (R7). Pure: it never mutates its inputs (every Map/Set is cloned) and
 * reads `now` from the caller rather than `Date.now()`.
 *
 * XP and level are *not* stored on a `Snapshot` — they are derived with
 * `derivedXp`/`level` wherever they're needed, so local XP is simply ignored
 * here (R7.2, R7.4). There is no unlock check and no Replay (R7.4): every step
 * below is a union, min, max or filter, which makes the merge idempotent
 * (Property 7).
 */

/** Earliest `completedAt` we'll trust from a local record (clamp lower bound). */
const MIN_COMPLETED_AT = new Date("2024-01-01T00:00:00.000Z").getTime();

/** Catalog mission IDs, for fast "is this a real mission" checks. */
const CATALOG_IDS = new Set(MISSIONS.map((m) => m.id));

/** Valid provider strings, derived from the catalog of providers. */
const VALID_PROVIDERS = new Set(Object.keys(PROVIDERS) as Provider[]);

function isValidProvider(value: unknown): value is Provider {
  return typeof value === "string" && VALID_PROVIDERS.has(value as Provider);
}

/**
 * Clamp a local `completedAt` to `[2024-01-01, now]`.
 *
 * The store's `MissionProgress.completedAt` is an optional epoch-millis number
 * (see `src/lib/store.ts`). When it's missing (older/offline records that never
 * recorded a timestamp) we fall back to `now`, the merge time — the earliest
 * moment the Server can attest to for that completion.
 */
function clampCompletedAt(raw: number | undefined, now: Date): Date {
  const nowMs = now.getTime();
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return new Date(nowMs);
  }
  const clamped = Math.min(Math.max(raw, MIN_COMPLETED_AT), nowMs);
  return new Date(clamped);
}

/** Clamp a single stat to `[0, STAT_MAX]`. */
function clampStat(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > STAT_MAX) return STAT_MAX;
  return value;
}

/** Per-field `max(server, local)`, each clamped to `[0, STAT_MAX]`. */
function mergeStats(server: PlayerStats, local: PlayerStats | undefined): PlayerStats {
  const pick = (key: keyof PlayerStats): number => {
    const s = clampStat(server[key] ?? 0);
    const l = clampStat(local?.[key] ?? 0);
    return Math.max(s, l);
  };
  return {
    totalCommands: pick("totalCommands"),
    terraformApplies: pick("terraformApplies"),
    hintsUsed: pick("hintsUsed"),
    missionsAttempted: pick("missionsAttempted"),
    streakDays: pick("streakDays"),
  };
}

export function mergeProgress(
  server: Snapshot,
  local: LocalProgressDTO,
  now: Date
): Snapshot {
  // ── 1. Local completed mission IDs that exist in the catalog, with a clamped
  //       completedAt. A mission counts as locally completed if its stored
  //       progress row is "completed" OR it's listed in profile.completedMissions.
  const localDone = new Map<string, Date>();

  for (const [missionId, row] of Object.entries(local.missionProgress ?? {})) {
    if (!CATALOG_IDS.has(missionId)) continue;
    if (row?.status === "completed") {
      localDone.set(missionId, clampCompletedAt(row.completedAt, now));
    }
  }

  for (const missionId of local.profile?.completedMissions ?? []) {
    if (!CATALOG_IDS.has(missionId)) continue;
    if (!localDone.has(missionId)) {
      // No progress row (or it wasn't "completed"); fall back to the row's
      // timestamp if present, otherwise `now`.
      const row = local.missionProgress?.[missionId];
      localDone.set(missionId, clampCompletedAt(row?.completedAt, now));
    }
  }

  // ── 2. Completions: union of server ∪ localDone.
  const completions = new Map<string, Completion>();

  // Start with every server completion, cloned.
  for (const [id, c] of server.completions) {
    completions.set(id, { ...c });
  }

  for (const [id, localDate] of localDone) {
    const serverRow = completions.get(id);
    if (!serverRow) {
      // Local-only → unverified completion.
      completions.set(id, {
        missionId: id,
        completedAt: localDate,
        verified: false,
        verifiedAt: null,
      });
    } else {
      // Both sides have it → keep the server row, earliest completedAt wins.
      // verified / verifiedAt are left untouched (a server-verified completion
      // stays verified — Property 8).
      const earliest =
        localDate.getTime() < serverRow.completedAt.getTime()
          ? localDate
          : serverRow.completedAt;
      completions.set(id, { ...serverRow, completedAt: earliest });
    }
  }

  // ── 3. Badges = (server.badges ∪ local.unlockedBadges) ∩ { completed missions' badgeId }.
  const completedBadgeIds = new Set<string>();
  for (const id of completions.keys()) {
    const badgeId = getMission(id)?.badgeId;
    if (badgeId) completedBadgeIds.add(badgeId);
  }
  const candidateBadges = new Set<string>(server.badges);
  for (const b of local.profile?.unlockedBadges ?? []) {
    candidateBadges.add(b);
  }
  const badges = new Set<string>();
  for (const b of candidateBadges) {
    if (completedBadgeIds.has(b)) badges.add(b);
  }

  // ── 4. Stats: per-field max, clamped.
  const stats = mergeStats(server.stats, local.profile?.stats);

  // ── 5. In-progress carry-over. Add local in-progress catalog missions that
  //       aren't completed and have no server in-progress row. Display-only;
  //       never used to decide completion. completedObjectives is filtered to
  //       the mission's own objective IDs.
  const inProgress = new Map<string, InProgressRow>();
  for (const [id, row] of server.inProgress) {
    inProgress.set(id, {
      ...row,
      completedObjectives: [...row.completedObjectives],
    });
  }

  for (const [missionId, row] of Object.entries(local.missionProgress ?? {})) {
    if (!CATALOG_IDS.has(missionId)) continue;
    if (row?.status !== "in_progress") continue;
    if (completions.has(missionId)) continue;
    if (inProgress.has(missionId)) continue;

    const mission = getMission(missionId);
    const objectiveIds = new Set((mission?.objectives ?? []).map((o) => o.id));
    const completedObjectives = (row.completedObjectives ?? []).filter((o) =>
      objectiveIds.has(o)
    );

    inProgress.set(missionId, {
      missionId,
      startedAt:
        typeof row.startedAt === "number" ? new Date(row.startedAt) : null,
      hintsUsed: clampStat(row.hintsUsed ?? 0),
      commandCount: clampStat(row.commandCount ?? 0),
      completedObjectives,
    });
  }

  // ── 6. Provider: server ?? valid(local) ?? null.
  const provider: Provider | null =
    server.provider ??
    (isValidProvider(local.profile?.provider) ? local.profile!.provider : null);

  // ── 7. XP/level are derived, not stored. Return the merged Snapshot.
  return { completions, badges, inProgress, stats, provider };
}
