import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  validateCompletionBody,
  validateStatsDelta,
  STATS_CAPS,
  MAX_TRANSCRIPT_STEPS,
  MAX_STEP_HCL_BYTES,
} from "../validate";
import { applyStats, STAT_MAX } from "../rules";
import type { PlayerStats } from "../../types";
import { MISSIONS } from "@/data/missions";

// ─────────────────────────────────────────────
// Shared fast-check arbitraries
// ─────────────────────────────────────────────

const PROVIDERS = ["aws", "gcp", "azure"] as const;
const KINDS = ["run", "check", "reset"] as const;

const catalogMissionId = fc.constantFrom(...MISSIONS.map((m) => m.id));
const provider = fc.constantFrom(...PROVIDERS);

/** Small HCL strings so generated payloads stay well under the byte limit and fast to build. */
const smallHcl = fc.string({ maxLength: 40 });

/** A well-formed step: command + hcl strings, kind present (run|check|reset) or omitted. */
const validStep = fc.record(
  {
    command: fc.string({ maxLength: 20 }),
    hcl: smallHcl,
    kind: fc.option(fc.constantFrom(...KINDS), { nil: undefined }),
  },
  { requiredKeys: ["command", "hcl"] },
);

/** A well-formed transcript within the step-count limit. */
const validTranscript = fc.record({
  provider,
  steps: fc.array(validStep, { maxLength: 30 }),
});

/** A well-formed completion body within all limits. */
const validBody = fc.record({
  missionId: catalogMissionId,
  transcript: validTranscript,
});

describe("validateCompletionBody — Property 3: Transcript validation", () => {
  // Feature: progress-sync, Property 3: Transcript validation
  it("accepts well-formed bodies and returns only the known fields", () => {
    fc.assert(
      fc.property(validBody, (body) => {
        const result = validateCompletionBody(body);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // missionId copied through unchanged.
        expect(result.value.missionId).toBe(body.missionId);

        // Transcript provider preserved.
        expect(result.value.transcript.provider).toBe(body.transcript.provider);

        // Steps are field-copied: same length, same command/hcl, kind preserved only when present.
        expect(result.value.transcript.steps).toHaveLength(body.transcript.steps.length);
        body.transcript.steps.forEach((inStep, i) => {
          const outStep = result.value.transcript.steps[i];
          expect(outStep.command).toBe(inStep.command);
          expect(outStep.hcl).toBe(inStep.hcl);
          if (inStep.kind === undefined) {
            expect("kind" in outStep).toBe(false);
          } else {
            expect(outStep.kind).toBe(inStep.kind);
          }
          // No stray keys on a copied step.
          expect(Object.keys(outStep).sort()).toEqual(
            inStep.kind === undefined ? ["command", "hcl"] : ["command", "hcl", "kind"],
          );
        });
      }),
      { numRuns: 200 },
    );
  });

  // Feature: progress-sync, Property 3: Transcript validation
  it("copies known fields only — injected userId/xp/verified are dropped", () => {
    fc.assert(
      fc.property(
        validBody,
        fc.record({
          userId: fc.string(),
          xp: fc.integer(),
          verified: fc.boolean(),
          profileId: fc.string(),
          level: fc.integer(),
          badges: fc.array(fc.string()),
        }),
        (body, injected) => {
          // Inject extra top-level fields and a stray field on the transcript.
          const dirty = {
            ...injected,
            missionId: body.missionId,
            transcript: { ...body.transcript, extra: "nope" },
          };
          const result = validateCompletionBody(dirty);
          expect(result.ok).toBe(true);
          if (!result.ok) return;

          // Only missionId + transcript survive at the top level.
          expect(Object.keys(result.value).sort()).toEqual(["missionId", "transcript"]);
          // Only provider + steps survive on the transcript.
          expect(Object.keys(result.value.transcript).sort()).toEqual(["provider", "steps"]);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: progress-sync, Property 3: Transcript validation
  it("returns 413 for a transcript with more than 300 steps", () => {
    fc.assert(
      fc.property(
        catalogMissionId,
        provider,
        // length in [301, 350]; tiny steps so this stays fast.
        fc.integer({ min: MAX_TRANSCRIPT_STEPS + 1, max: MAX_TRANSCRIPT_STEPS + 50 }),
        (missionId, prov, len) => {
          const steps = Array.from({ length: len }, () => ({ command: "", hcl: "" }));
          const result = validateCompletionBody({ missionId, transcript: { provider: prov, steps } });
          expect(result.ok).toBe(false);
          if (result.ok) return;
          expect(result.status).toBe(413);
          expect(result.code).toBe("TOO_LARGE");
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: progress-sync, Property 3: Transcript validation
  it("returns 413 when a step's hcl exceeds the 64 KB byte limit", () => {
    fc.assert(
      fc.property(
        catalogMissionId,
        provider,
        // overshoot the byte limit by 1..64 bytes (ASCII → 1 byte each).
        fc.integer({ min: 1, max: 64 }),
        (missionId, prov, over) => {
          const bigHcl = "a".repeat(MAX_STEP_HCL_BYTES + over);
          const steps = [
            { command: "terraform init", hcl: "" },
            { command: "", hcl: bigHcl },
          ];
          const result = validateCompletionBody({ missionId, transcript: { provider: prov, steps } });
          expect(result.ok).toBe(false);
          if (result.ok) return;
          expect(result.status).toBe(413);
          expect(result.code).toBe("TOO_LARGE");
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: progress-sync, Property 3: Transcript validation
  it("returns 400 for otherwise-malformed bodies", () => {
    // Each entry builds a body that is well-formed except for one deliberate defect,
    // all within the size limits so the failure is a 400 (shape/membership), not a 413.
    const malformed = fc.oneof(
      // non-array steps
      fc.record({ missionId: catalogMissionId, transcript: fc.record({ provider, steps: fc.string() }) }),
      // transcript is not an object
      fc.record({ missionId: catalogMissionId, transcript: fc.constantFrom(null, 42, "x", true) }),
      // unknown provider
      fc.record({
        missionId: catalogMissionId,
        transcript: fc.record({
          provider: fc.constantFrom("do", "linode", "", "AWS", "oracle"),
          steps: fc.constant([]),
        }),
      }),
      // non-string command
      fc.record({
        missionId: catalogMissionId,
        transcript: fc.record({
          provider,
          steps: fc.constant([{ command: 123 as unknown as string, hcl: "" }]),
        }),
      }),
      // non-string hcl
      fc.record({
        missionId: catalogMissionId,
        transcript: fc.record({
          provider,
          steps: fc.constant([{ command: "", hcl: 5 as unknown as string }]),
        }),
      }),
      // bad kind
      fc.record({
        missionId: catalogMissionId,
        transcript: fc.record({
          provider,
          steps: fc.constant([{ command: "", hcl: "", kind: "wat" }]),
        }),
      }),
      // step not an object
      fc.record({
        missionId: catalogMissionId,
        transcript: fc.record({ provider, steps: fc.constant(["not-an-object"]) }),
      }),
      // missionId not in the catalog
      fc.record({
        missionId: fc.constantFrom("mission-999", "nope", "", "mission-00"),
        transcript: validTranscript,
      }),
      // missionId non-string
      fc.record({
        missionId: fc.constantFrom(1 as unknown as string, null as unknown as string),
        transcript: validTranscript,
      }),
      // body itself not an object
      fc.constantFrom(null, 7, "body", [] as unknown as object),
    );

    fc.assert(
      fc.property(malformed, (body) => {
        const result = validateCompletionBody(body);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.status).toBe(400);
      }),
      { numRuns: 200 },
    );
  });
});

// The four client-writable stat fields and their caps (R5.10).
const STAT_FIELDS = ["totalCommands", "terraformApplies", "hintsUsed", "missionsAttempted"] as const;

// Feature: progress-sync, Property 10: Stats deltas are bounded
describe("Property 10: Stats deltas are bounded", () => {
  // A value that is sometimes an in-range integer, sometimes out of range
  // (negative, float, > cap, NaN/Infinity), sometimes a non-number.
  const fieldValueArb = (cap: number) =>
    fc.oneof(
      fc.integer({ min: 0, max: cap }), // in range
      fc.integer({ min: cap + 1, max: cap + 10_000 }), // over the cap
      fc.integer({ min: -10_000, max: -1 }), // negative
      fc
        .double({ min: 0, max: cap, noDefaultInfinity: true, noNaN: true })
        .filter((n) => !Number.isInteger(n)), // non-integer float
      fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY),
      fc.oneof(fc.string(), fc.boolean(), fc.constant(null)), // wrong type
    );

  // Each writable field is independently present-or-absent; a stray `streakDays`
  // confirms it is always ignored.
  const rawDeltaArb = fc.record(
    {
      totalCommands: fc.option(fieldValueArb(STATS_CAPS.totalCommands), { nil: undefined }),
      terraformApplies: fc.option(fieldValueArb(STATS_CAPS.terraformApplies), { nil: undefined }),
      hintsUsed: fc.option(fieldValueArb(STATS_CAPS.hintsUsed), { nil: undefined }),
      missionsAttempted: fc.option(fieldValueArb(STATS_CAPS.missionsAttempted), { nil: undefined }),
      streakDays: fc.option(fc.integer({ min: -100, max: 100 }), { nil: undefined }),
    },
    { requiredKeys: [] },
  );

  it("accepts a delta iff every present field is an integer in [0, cap], and ignores streakDays", () => {
    fc.assert(
      fc.property(rawDeltaArb, (raw) => {
        const result = validateStatsDelta(raw);

        const expectedOk = STAT_FIELDS.every((field) => {
          const v = (raw as Record<string, unknown>)[field];
          if (v === undefined) return true;
          return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= STATS_CAPS[field];
        });

        expect(result.ok).toBe(expectedOk);

        if (result.ok) {
          for (const field of STAT_FIELDS) {
            const v = (raw as Record<string, unknown>)[field];
            if (v === undefined) {
              expect(result.value[field]).toBeUndefined();
            } else {
              expect(result.value[field]).toBe(v);
            }
          }
          // streakDays is never present in the validated output.
          expect("streakDays" in result.value).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("applyStats never decreases a stat, never exceeds STAT_MAX, and passes streakDays through", () => {
    const nonNegInt = fc.integer({ min: 0, max: STAT_MAX });

    const baseArb: fc.Arbitrary<PlayerStats> = fc.record({
      totalCommands: nonNegInt,
      terraformApplies: nonNegInt,
      hintsUsed: nonNegInt,
      missionsAttempted: nonNegInt,
      streakDays: fc.integer({ min: 0, max: 10_000 }),
    });

    // StatsIncrement: each present field a non-negative integer.
    const incrementArb = fc.record(
      {
        totalCommands: fc.option(nonNegInt, { nil: undefined }),
        terraformApplies: fc.option(nonNegInt, { nil: undefined }),
        hintsUsed: fc.option(nonNegInt, { nil: undefined }),
        missionsAttempted: fc.option(nonNegInt, { nil: undefined }),
      },
      { requiredKeys: [] },
    );

    fc.assert(
      fc.property(baseArb, incrementArb, (base, delta) => {
        const next = applyStats(base, delta);

        for (const field of STAT_FIELDS) {
          expect(next[field]).toBeGreaterThanOrEqual(base[field]); // monotonic
          expect(next[field]).toBeLessThanOrEqual(STAT_MAX); // clamped
        }

        // streakDays is Server-managed and passes through unchanged.
        expect(next.streakDays).toBe(base.streakDays);
      }),
      { numRuns: 100 },
    );
  });
});
