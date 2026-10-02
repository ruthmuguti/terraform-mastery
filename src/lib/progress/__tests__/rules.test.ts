import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  missionXp,
  derivedXp,
  verifiedXp,
  level,
  isUnlocked,
  applyCompletion,
  type Completion,
  type Snapshot,
} from "../rules";
import type { Provider } from "@/lib/providers";
import type { PlayerStats } from "@/lib/types";
import { getLevelInfo } from "@/lib/types";
import { MISSIONS } from "@/data/missions";
import { getBadge } from "@/data/badges";

// ─────────────────────────────────────────────
// Shared fast-check arbitraries
// ─────────────────────────────────────────────

const PROVIDERS = ["aws", "gcp", "azure"] as const;
const CATALOG_IDS = MISSIONS.map((m) => m.id);

const catalogMissionId = fc.constantFrom(...CATALOG_IDS);
const providerOrNull = fc.option(fc.constantFrom<Provider>(...PROVIDERS), { nil: null });

/** A Date within a modest window so generation stays fast and comparable. */
const someDate = fc
  .integer({ min: Date.UTC(2024, 0, 1), max: Date.UTC(2026, 0, 1) })
  .map((ms) => new Date(ms));

/** Non-negative, modest cosmetic stats. */
const statsArb: fc.Arbitrary<PlayerStats> = fc.record({
  totalCommands: fc.nat({ max: 10_000 }),
  terraformApplies: fc.nat({ max: 1_000 }),
  hintsUsed: fc.nat({ max: 1_000 }),
  missionsAttempted: fc.nat({ max: 100 }),
  streakDays: fc.nat({ max: 365 }),
});

/**
 * A Snapshot built from a random subset of catalog mission IDs. Each completion
 * gets a random date, a random `verified` flag (with a matching `verifiedAt`),
 * and badges are derived from the completed missions' own `badgeId` (R5.7) —
 * exactly as the real pipeline would hold them.
 */
const snapshotArb: fc.Arbitrary<Snapshot> = fc
  .record({
    // a subset of catalog IDs (dedup via a set), each with its own completion metadata
    ids: fc.uniqueArray(catalogMissionId, { maxLength: CATALOG_IDS.length }),
    verifiedFlags: fc.array(fc.boolean(), { maxLength: CATALOG_IDS.length }),
    dates: fc.array(someDate, { maxLength: CATALOG_IDS.length }),
    verifiedDates: fc.array(someDate, { maxLength: CATALOG_IDS.length }),
    stats: statsArb,
    provider: providerOrNull,
  })
  .map(({ ids, verifiedFlags, dates, verifiedDates, stats, provider }) => {
    const completions = new Map<string, Completion>();
    const badges = new Set<string>();
    ids.forEach((id, i) => {
      const verified = verifiedFlags[i % Math.max(verifiedFlags.length, 1)] ?? false;
      const completedAt = dates[i % Math.max(dates.length, 1)] ?? new Date(0);
      const verifiedAt = verified
        ? verifiedDates[i % Math.max(verifiedDates.length, 1)] ?? completedAt
        : null;
      completions.set(id, { missionId: id, completedAt, verified, verifiedAt });
      const badgeId = MISSIONS.find((m) => m.id === id)?.badgeId;
      if (badgeId) badges.add(badgeId);
    });
    return {
      completions,
      badges,
      inProgress: new Map(),
      stats,
      provider,
    };
  });

/** Independent expected XP for a single mission: own xpReward + own badge xpBonus. */
function expectedMissionXp(id: string): number {
  const m = MISSIONS.find((mm) => mm.id === id);
  if (!m) return 0;
  const bonus = m.badgeId ? getBadge(m.badgeId)?.xpBonus ?? 0 : 0;
  return m.xpReward + bonus;
}

// ─────────────────────────────────────────────
// Property 4: Unlock rule
// ─────────────────────────────────────────────

describe("Property 4: Unlock rule", () => {
  // Feature: progress-sync, Property 4: Unlock rule
  it("isUnlocked(id, s) is true iff id is mission-01 or a completed mission lists id in unlocks", () => {
    fc.assert(
      fc.property(snapshotArb, catalogMissionId, (s, id) => {
        // Expectation computed independently of isUnlocked's internals.
        const expected =
          id === "mission-01" ||
          MISSIONS.some(
            (m) => s.completions.has(m.id) && (m.unlocks ?? []).includes(id),
          );

        expect(isUnlocked(id, s)).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────
// Property 5: XP, level and badges are derived
// ─────────────────────────────────────────────

describe("Property 5: XP, level and badges are derived", () => {
  // Feature: progress-sync, Property 5: XP, level and badges are derived
  it("derivedXp sums missionXp over completions; level matches the shared table; badges ⊆ completed missions' badgeIds", () => {
    fc.assert(
      fc.property(snapshotArb, (s) => {
        // XP is the independent sum over the completed missions.
        const expectedXp = [...s.completions.keys()].reduce(
          (acc, id) => acc + expectedMissionXp(id),
          0,
        );
        expect(derivedXp(s)).toBe(expectedXp);

        // Each completion's missionXp matches the independent per-mission value.
        for (const id of s.completions.keys()) {
          expect(missionXp(id)).toBe(expectedMissionXp(id));
        }

        // level(xp) agrees with the shared leveling table.
        const xp = derivedXp(s);
        expect(level(xp)).toBe(getLevelInfo(xp).currentLevel.level);

        // badges ⊆ { m.badgeId | m completed }.
        const allowed = new Set<string>();
        for (const id of s.completions.keys()) {
          const badgeId = MISSIONS.find((m) => m.id === id)?.badgeId;
          if (badgeId) allowed.add(badgeId);
        }
        for (const b of s.badges) {
          expect(allowed.has(b)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: progress-sync, Property 5: XP, level and badges are derived
  it("ignores client-sent xp/level/badges — the result depends only on the Snapshot's completions", () => {
    fc.assert(
      fc.property(
        snapshotArb,
        // arbitrary client-claimed values that must have no effect
        fc.record({ xp: fc.integer(), level: fc.integer(), badges: fc.array(fc.string()) }),
        (s, claimed) => {
          // These functions take only the Snapshot — the claimed values can't reach them.
          // Attaching them to a copy must not change any derived quantity.
          const dirty = { ...s, ...(claimed as object) } as Snapshot;
          expect(derivedXp(dirty)).toBe(derivedXp(s));
          expect(level(derivedXp(dirty))).toBe(level(derivedXp(s)));
          expect(verifiedXp(dirty)).toBe(verifiedXp(s));
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────
// Property 6: Completion is idempotent and verify-only on unverified
// ─────────────────────────────────────────────

describe("Property 6: Completion is idempotent and verify-only on unverified", () => {
  /** Mission IDs that are unlocked for a given snapshot. */
  function unlockedIds(s: Snapshot): string[] {
    return CATALOG_IDS.filter((id) => isUnlocked(id, s));
  }

  // Feature: progress-sync, Property 6: Completion is idempotent and verify-only on unverified
  it("applying an unlocked completion twice equals applying it once (completed-fields)", () => {
    fc.assert(
      fc.property(
        snapshotArb,
        fc.integer({ min: Date.UTC(2024, 0, 1), max: Date.UTC(2025, 0, 1) }),
        fc.integer({ min: Date.UTC(2025, 0, 2), max: Date.UTC(2026, 0, 1) }),
        (s, t1ms, t2ms) => {
          const unlocked = unlockedIds(s);
          if (unlocked.length === 0) return;
          const id = unlocked[t1ms % unlocked.length];
          const t1 = new Date(t1ms);
          const t2 = new Date(t2ms); // t2 > t1

          const once = applyCompletion(s, id, t1);
          const twice = applyCompletion(once, id, t2);

          const c1 = once.completions.get(id)!;
          const c2 = twice.completions.get(id)!;

          // completedAt, verified, verifiedAt stay fixed after the first apply.
          expect(c2.completedAt.getTime()).toBe(c1.completedAt.getTime());
          expect(c2.verified).toBe(c1.verified);
          expect(c2.verified).toBe(true);
          expect(c2.verifiedAt?.getTime()).toBe(c1.verifiedAt?.getTime());

          // Badges and XP are stable.
          expect([...twice.badges].sort()).toEqual([...once.badges].sort());
          expect(derivedXp(twice)).toBe(derivedXp(once));
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: progress-sync, Property 6: Completion is idempotent and verify-only on unverified
  it("verifies an existing unverified completion without changing completedAt, XP or badges", () => {
    fc.assert(
      fc.property(
        snapshotArb,
        someDate,
        catalogMissionId,
        (base, verifyAt, pickId) => {
          // Force a present-but-unverified completion for `pickId` on a fresh snapshot copy.
          const completions = new Map(base.completions);
          const completedAt = new Date(Date.UTC(2024, 5, 15));
          completions.set(pickId, {
            missionId: pickId,
            completedAt,
            verified: false,
            verifiedAt: null,
          });
          const badgeId = MISSIONS.find((m) => m.id === pickId)?.badgeId;
          const badges = new Set(base.badges);
          if (badgeId) badges.add(badgeId); // badge already present (completion exists)

          const s: Snapshot = { ...base, completions, badges };

          const xpBefore = derivedXp(s);
          const badgesBefore = [...s.badges].sort();

          const after = applyCompletion(s, pickId, verifyAt);
          const c = after.completions.get(pickId)!;

          // Now verified, with verifiedAt = the apply time.
          expect(c.verified).toBe(true);
          expect(c.verifiedAt?.getTime()).toBe(verifyAt.getTime());

          // completedAt unchanged.
          expect(c.completedAt.getTime()).toBe(completedAt.getTime());

          // XP and badges unchanged from the input snapshot.
          expect(derivedXp(after)).toBe(xpBefore);
          expect([...after.badges].sort()).toEqual(badgesBefore);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────
// Property 9: Verified XP excludes unverified
// ─────────────────────────────────────────────

describe("Property 9: Verified XP excludes unverified", () => {
  // Feature: progress-sync, Property 9: Verified XP excludes unverified
  it("verifiedXp(s) equals derivedXp over the verified-only sub-snapshot and is ≤ derivedXp(s)", () => {
    fc.assert(
      fc.property(snapshotArb, (s) => {
        // Build the verified-only sub-snapshot.
        const verifiedCompletions = new Map<string, Completion>();
        for (const [id, c] of s.completions) {
          if (c.verified) verifiedCompletions.set(id, c);
        }
        const sub: Snapshot = { ...s, completions: verifiedCompletions };

        expect(verifiedXp(s)).toBe(derivedXp(sub));
        expect(verifiedXp(s)).toBeLessThanOrEqual(derivedXp(s));
      }),
      { numRuns: 100 },
    );
  });
});
