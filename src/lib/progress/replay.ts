import type { Mission } from "@/lib/types";
import { createInitialState, executeCommand } from "@/lib/terraform-simulator";
import { mulberry32 } from "./rng";
import type { Transcript } from "./types";

/**
 * Replay a recorded mission attempt and return the set of objective IDs that latched.
 *
 * This mirrors `MissionExecutor`'s loop exactly so the Server reaches the same verdict
 * as the browser (R4.1, R4.2, R5.3, R5.4):
 *  - a "run" step runs `executeCommand(command, state, hcl)` then appends the command to
 *    history (the executor sets `simState` and `commandHistory` in `handleCommand`);
 *  - a "reset" step clears the sim state and command history but keeps latched objectives
 *    (the executor's "Reset terminal" button);
 *  - a "check" step touches neither (an objective latched purely from an HCL edit);
 *  - after EVERY step, each not-yet-latched objective is checked against
 *    `(state, step.hcl, history, provider)` and latched once it passes. Latches are never
 *    re-checked, matching the executor's `!newCompleted.has(obj.id)` guard.
 *
 * `random` is threaded into the simulator so resource IDs are deterministic (R5.5); it
 * defaults to `mulberry32(0)`. No `check` reads an ID today, so the outcome is independent
 * of the random source (Property 2). Each `check` is wrapped in try/catch — a throw counts
 * as "not passed" and never crashes replay.
 */
export function replay(
  mission: Mission,
  transcript: Transcript,
  random: () => number = mulberry32(0)
): Set<string> {
  let state = createInitialState();
  let history: string[] = [];
  const latched = new Set<string>();

  for (const step of transcript.steps) {
    const kind = step.kind ?? "run";
    if (kind === "reset") {
      state = createInitialState();
      history = [];
    } else if (kind === "run") {
      state = executeCommand(step.command, state, step.hcl, { random }).newState;
      history = [...history, step.command];
    }
    // kind === "check" updates neither state nor history.

    for (const obj of mission.objectives) {
      if (latched.has(obj.id)) continue;
      try {
        if (obj.check(state, step.hcl, history, transcript.provider)) {
          latched.add(obj.id);
        }
      } catch {
        // A throwing check counts as "not passed": do not latch, do not crash.
      }
    }
  }

  return latched;
}

/**
 * Whether a replayed attempt completes the mission: every objective latched (R5.3).
 * Handy for the completion route handler.
 */
export function isAccepted(
  mission: Mission,
  transcript: Transcript,
  random: () => number = mulberry32(0)
): boolean {
  return replay(mission, transcript, random).size === mission.objectives.length;
}
