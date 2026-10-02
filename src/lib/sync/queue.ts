"use client";

import type { ProgressDTO } from "@/lib/progress/types";
import { getTranscript, deleteTranscript } from "./transcript-store";

// ---------------------------------------------------------------------------
// Op types
// ---------------------------------------------------------------------------

/** A single pending change waiting to be synced to the server. */
export type QueueOp =
  | { type: "complete"; missionId: string }
  | { type: "stats"; delta: Record<string, number> }
  | { type: "provider"; provider: string }
  | { type: "merge"; local: unknown }
  | { type: "missionActivity"; missionId: string; started?: true; hints?: number; commands?: number };

// ---------------------------------------------------------------------------
// Status types
// ---------------------------------------------------------------------------

export type QueueStatus = "idle" | "syncing" | "retry" | "paused" | "error";

// ---------------------------------------------------------------------------
// Internal storage types
// ---------------------------------------------------------------------------

interface StoredQueue {
  ops: QueueOp[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 60_000;
const JITTER_FRACTION = 0.2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function storageKey(userId: string): string {
  return `terraops:pending:${userId}`;
}

/**
 * Compute the backoff delay in milliseconds for the nth retry attempt.
 * Formula: min(60s, 1s * 2^n) ± 20% jitter.
 */
function backoffMs(retryCount: number): number {
  const base = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * Math.pow(2, retryCount));
  const jitter = base * JITTER_FRACTION * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(base + jitter));
}

/**
 * Sort ops so merge comes first, then completes, then everything else
 * (provider/stats/missionActivity). Relative order within each group is stable.
 */
function prioritise(ops: QueueOp[]): QueueOp[] {
  const priority = (op: QueueOp): number => {
    if (op.type === "merge") return 0;
    if (op.type === "complete") return 1;
    return 2;
  };
  return [...ops].sort((a, b) => priority(a) - priority(b));
}

// ---------------------------------------------------------------------------
// SyncQueue
// ---------------------------------------------------------------------------

/**
 * Client-side pending-change queue.
 *
 * - Persisted at `terraops:pending:<userId>` in localStorage.
 * - Processes one op at a time, in priority order: merge → complete → PATCH.
 * - Retries with exponential backoff (min 1 s · 2^n, max 60 s, ±20% jitter).
 * - Fires retries on `online` and `visibilitychange → visible`.
 * - Stats deltas are coalesced (same-key values summed).
 * - Provider changes use last-write semantics.
 * - SSR-safe: all localStorage / event access is guarded by `typeof window`.
 */
export class SyncQueue {
  private readonly userId: string;
  private ops: QueueOp[] = [];
  private status: QueueStatus = "idle";
  private listeners: Set<(s: QueueStatus) => void> = new Set();
  private running = false;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;

  // Bound event handlers so we can remove them in stop().
  private onOnline = (): void => { this.scheduleImmediate(); };
  private onVisibility = (): void => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      this.scheduleImmediate();
    }
  };

  constructor(userId: string) {
    this.userId = userId;
    this.loadFromStorage();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Add an op to the queue.
   *
   * Stats deltas are coalesced into the existing pending `stats` op (fields
   * summed). Provider changes overwrite the existing pending `provider` op.
   * All other op types are appended.
   */
  enqueue(op: QueueOp): void {
    if (typeof window === "undefined") return;

    if (op.type === "stats") {
      const existing = this.ops.find((o): o is Extract<QueueOp, { type: "stats" }> => o.type === "stats");
      if (existing) {
        for (const [k, v] of Object.entries(op.delta)) {
          existing.delta[k] = (existing.delta[k] ?? 0) + v;
        }
        this.persist();
        this.scheduleImmediate();
        return;
      }
    }

    if (op.type === "provider") {
      const existingIdx = this.ops.findIndex((o) => o.type === "provider");
      if (existingIdx !== -1) {
        this.ops[existingIdx] = op;
        this.persist();
        this.scheduleImmediate();
        return;
      }
    }

    this.ops.push(op);
    this.persist();
    this.scheduleImmediate();
  }

  /**
   * Begin processing the queue. Attaches `online` and `visibilitychange`
   * listeners for automatic retries. Safe to call multiple times.
   */
  start(): void {
    if (typeof window === "undefined") return;
    window.addEventListener("online", this.onOnline);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.scheduleImmediate();
  }

  /**
   * Stop processing. Detaches event listeners and cancels any pending retry
   * timer. In-flight requests are not cancelled (they will simply have no
   * effect on the stopped queue).
   */
  stop(): void {
    if (typeof window === "undefined") return;
    window.removeEventListener("online", this.onOnline);
    document.removeEventListener("visibilitychange", this.onVisibility);
    if (this.retryTimeout !== null) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    this.running = false;
  }

  /** Current sync status. */
  getStatus(): QueueStatus {
    return this.status;
  }

  /**
   * Subscribe to status changes. Returns an unsubscribe function.
   */
  onStatusChange(cb: (status: QueueStatus) => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private setStatus(s: QueueStatus): void {
    if (this.status === s) return;
    this.status = s;
    for (const cb of this.listeners) {
      try { cb(s); } catch { /* ignore listener errors */ }
    }
  }

  private loadFromStorage(): void {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(storageKey(this.userId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredQueue;
      if (Array.isArray(parsed?.ops)) {
        this.ops = parsed.ops as QueueOp[];
      }
    } catch {
      this.ops = [];
    }
  }

  private persist(): void {
    if (typeof window === "undefined") return;
    try {
      const data: StoredQueue = { ops: this.ops };
      localStorage.setItem(storageKey(this.userId), JSON.stringify(data));
    } catch {
      // Storage full or access denied — queue lives in memory only.
    }
  }

  private clearStorage(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(storageKey(this.userId));
    } catch {
      // ignore
    }
  }

  private scheduleImmediate(): void {
    if (this.running || this.status === "paused") return;
    if (this.retryTimeout !== null) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    void this.processNext();
  }

  private scheduleRetry(): void {
    if (this.retryTimeout !== null) clearTimeout(this.retryTimeout);
    const delay = backoffMs(this.retryCount);
    this.retryTimeout = setTimeout(() => {
      this.retryTimeout = null;
      if (this.status !== "paused") void this.processNext();
    }, delay);
  }

  private async processNext(): Promise<void> {
    if (this.running || this.status === "paused") return;
    if (typeof window === "undefined") return;

    const sorted = prioritise(this.ops);
    if (sorted.length === 0) {
      this.setStatus("idle");
      this.ops = [];
      this.clearStorage();
      return;
    }

    this.running = true;
    this.setStatus("syncing");

    const op = sorted[0];

    // Sync ops order back so the first item matches what we're about to send.
    this.ops = sorted;

    try {
      const result = await this.sendOp(op);
      this.handleResult(result, op);
    } catch {
      // Network-level failure (fetch threw).
      this.running = false;
      this.retryCount += 1;
      this.setStatus("retry");
      this.scheduleRetry();
    }
  }

  /** Build and send the fetch request for a single op. */
  private async sendOp(
    op: QueueOp,
  ): Promise<{ status: number; body: unknown; retryAfterSeconds: number | null }> {
    let url: string;
    let method: string;
    let bodyPayload: unknown;

    if (op.type === "complete") {
      const record = getTranscript(this.userId, op.missionId);
      if (!record) {
        // No transcript available — drop the op immediately without an HTTP call.
        return { status: -1, body: null, retryAfterSeconds: null };
      }
      url = "/api/progress/complete";
      method = "POST";
      bodyPayload = { missionId: op.missionId, transcript: { provider: record.provider, steps: record.steps } };
    } else if (op.type === "merge") {
      url = "/api/progress/merge";
      method = "POST";
      bodyPayload = { local: op.local };
    } else {
      // stats / provider / missionActivity → PATCH
      url = "/api/progress";
      method = "PATCH";
      if (op.type === "stats") {
        bodyPayload = { stats: op.delta };
      } else if (op.type === "provider") {
        bodyPayload = { provider: op.provider };
      } else {
        // missionActivity
        const { type: _, ...rest } = op;
        bodyPayload = { missionActivity: rest };
      }
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload),
    });

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore parse failures; callers use status only
    }

    const retryAfterHeader = res.headers.get("Retry-After");
    const retryAfterSeconds =
      retryAfterHeader !== null ? parseFloat(retryAfterHeader) : null;

    return { status: res.status, body, retryAfterSeconds };
  }

  /**
   * Handle the response from a single op send, updating queue state
   * and scheduling the next step or a retry.
   */
  private handleResult(
    result: { status: number; body: unknown; retryAfterSeconds: number | null },
    op: QueueOp,
  ): void {
    this.running = false;
    const { status, body, retryAfterSeconds } = result;

    // Status -1 = transcript not found → drop silently.
    if (status === -1) {
      this.dropFirst();
      this.retryCount = 0;
      this.setStatus("idle");
      void this.processNext();
      return;
    }

    if (status === 200) {
      // Drop the op, hydrate the store if a ProgressDTO came back.
      if (op.type === "complete") {
        deleteTranscript(this.userId, op.missionId);
      }
      if (op.type === "merge") {
        // Write the merge marker to indicate this user's local data has been
        // merged successfully (R7.6). Prevents duplicate merges on next load.
        this.writeMergeMarker();
      }
      this.dropFirst();
      this.retryCount = 0;

      const dto = body as ProgressDTO | null;
      if (dto && typeof dto === "object" && "profile" in dto) {
        this.hydrateStore(dto as ProgressDTO);
      }

      if (this.ops.length === 0) {
        this.setStatus("idle");
        this.clearStorage();
      } else {
        void this.processNext();
      }
      return;
    }

    if (status === 401) {
      // Session expired — pause queue, keep all ops.
      this.setStatus("paused");
      return;
    }

    if (status === 429) {
      // Keep op, retry after Retry-After seconds.
      this.retryCount += 1;
      this.setStatus("retry");
      if (retryAfterSeconds !== null && retryAfterSeconds > 0) {
        this.retryTimeout = setTimeout(() => {
          this.retryTimeout = null;
          if (this.status !== "paused") void this.processNext();
        }, Math.ceil(retryAfterSeconds) * 1_000);
      } else {
        this.scheduleRetry();
      }
      return;
    }

    if (status >= 500 || status === 0) {
      // Network error or server error — keep op, exponential backoff.
      this.retryCount += 1;
      this.setStatus("retry");
      this.scheduleRetry();
      return;
    }

    // 400 / 409 / 413 / 422 — drop the op, re-fetch progress, set error status.
    this.dropFirst();
    this.retryCount = 0;
    this.setStatus("error");
    void this.refetchProgress();
  }

  /** Remove the first op from the queue and persist. */
  private dropFirst(): void {
    this.ops.shift();
    if (this.ops.length === 0) {
      this.clearStorage();
    } else {
      this.persist();
    }
  }

  /** Re-fetch the server progress after a 4xx error and hydrate the store. */
  private async refetchProgress(): Promise<void> {
    try {
      const res = await fetch("/api/progress", { method: "GET" });
      if (res.status === 200) {
        const dto = (await res.json()) as ProgressDTO;
        this.hydrateStore(dto);
      }
    } catch {
      // Ignore — the store keeps its current state.
    }
    if (this.ops.length > 0) void this.processNext();
  }

  /**
   * Hydrate the zustand store with a fresh ProgressDTO. Imported lazily to
   * avoid a circular bundle dependency and to ensure it only runs in the
   * browser (the store is "use client").
   */
  private hydrateStore(dto: ProgressDTO): void {
    // Lazy import keeps the store out of SSR bundles.
    import("@/lib/store").then(({ useGameStore }) => {
      useGameStore.getState().hydrate(dto, this.userId);
    }).catch(() => { /* ignore — hydration is best-effort */ });
  }

  /**
   * Write the merge marker to localStorage to indicate this user's local
   * progress has been successfully merged to the server (R7.6).
   */
  private writeMergeMarker(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(`terraops:merged:${this.userId}`, "1");
    } catch {
      // Storage full — ignore. On next load, the ownerUserId check will
      // prevent a duplicate merge anyway.
    }
  }
}
