"use client";

import type { Provider } from "@/lib/providers";
import type { TranscriptStep } from "@/lib/progress/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TranscriptRecord {
  provider: Provider;
  steps: TranscriptStep[];
  startedAt: string;
}

// ---------------------------------------------------------------------------
// Storage-key helper
// ---------------------------------------------------------------------------

function key(userId: string, missionId: string): string {
  return `terraops:transcript:${userId}:${missionId}`;
}

// ---------------------------------------------------------------------------
// Limit constants (mirrored from the Server, see design §Recorder)
// ---------------------------------------------------------------------------

const MAX_STEPS = 300;
const MAX_HCL_LENGTH = 65536; // 64 KB per step

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true when the transcript has hit the 300-step limit or any step's HCL
 * exceeds 64 KB.  Callers should stop recording and show an "attempt too long"
 * warning to the user.
 */
export function isTranscriptOverLimit(record: TranscriptRecord): boolean {
  if (record.steps.length >= MAX_STEPS) return true;
  return record.steps.some((s) => s.hcl.length >= MAX_HCL_LENGTH);
}

/**
 * Reads a TranscriptRecord from localStorage.
 * Returns null when not in a browser, when no entry exists, or when parsing fails.
 */
export function getTranscript(
  userId: string,
  missionId: string,
): TranscriptRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(userId, missionId));
    if (raw === null) return null;
    return JSON.parse(raw) as TranscriptRecord;
  } catch {
    return null;
  }
}

/**
 * Persists a TranscriptRecord to localStorage.
 * Silently swallows QuotaExceededError / DOMException — callers should check
 * `isTranscriptOverLimit` to know whether recording should stop.
 */
export function saveTranscript(
  userId: string,
  missionId: string,
  record: TranscriptRecord,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(userId, missionId), JSON.stringify(record));
  } catch (err) {
    // Storage full or access denied — nothing we can do; record is kept in memory.
    if (
      err instanceof DOMException &&
      (err.name === "QuotaExceededError" ||
        err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        err.code === 22) // legacy Safari QuotaExceededError code
    ) {
      return;
    }
    // Re-throw anything unexpected so it surfaces during development.
    throw err;
  }
}

/**
 * Removes the stored transcript for a given user + mission.
 * Called after the Server returns 200 for a successful completion (R4.4).
 * No-op in SSR or when no entry exists.
 */
export function deleteTranscript(userId: string, missionId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key(userId, missionId));
}

/**
 * Creates a fresh empty TranscriptRecord for a new attempt, persists it, and
 * returns it.  Callers should call this when the user starts a new attempt or
 * presses "Restart mission".
 */
export function startNewTranscript(
  userId: string,
  missionId: string,
  provider: Provider,
): TranscriptRecord {
  const record: TranscriptRecord = {
    provider,
    steps: [],
    startedAt: new Date().toISOString(),
  };
  saveTranscript(userId, missionId, record);
  return record;
}
