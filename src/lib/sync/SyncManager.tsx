"use client";

import { useEffect, useRef, useState, createContext, useContext } from "react";
import { useSession } from "next-auth/react";
import { SyncQueue, type QueueStatus } from "./queue";
import { useGameStore } from "@/lib/store";
import type { LocalProgressDTO, ProgressDTO } from "@/lib/progress/types";

// ---------------------------------------------------------------------------
// SyncStatus context
// ---------------------------------------------------------------------------

const SyncStatusContext = createContext<QueueStatus>("idle");

export function useSyncStatus(): QueueStatus {
  return useContext(SyncStatusContext);
}

// ---------------------------------------------------------------------------
// Merge-marker helpers
// ---------------------------------------------------------------------------

function mergeMarkerKey(userId: string): string {
  return `terraops:merged:${userId}`;
}

function hasMergeMarker(userId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(mergeMarkerKey(userId)) === "1";
  } catch {
    return false;
  }
}

function setMergeMarker(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(mergeMarkerKey(userId), "1");
  } catch {
    // Storage full — ignore; the merge will be retried next load.
  }
}

// ---------------------------------------------------------------------------
// SyncManager
// ---------------------------------------------------------------------------

/**
 * Invisible client component that manages server sync for a signed-in user.
 *
 * On mount (when signed in):
 *   1. Creates/reuses a SyncQueue for the user.
 *   2. Decides whether to enqueue a one-time merge of local progress:
 *      - enqueue if ownerUserId is undefined AND no merge marker exists AND there's local progress.
 *      - skip (discard, no merge) if ownerUserId is set AND differs from the current userId (R7.8).
 *   3. GETs /api/progress and hydrates the store.
 *   4. Starts the queue and subscribes to status changes.
 *
 * Renders a role="status" aria-live="polite" span with the sync indicator text.
 */
export function SyncManager() {
  const { data: session, status: sessionStatus } = useSession();
  const queueRef = useRef<SyncQueue | null>(null);
  const [syncStatus, setSyncStatus] = useState<QueueStatus>("idle");

  // Read store fields at mount time — we need the stable selectors.
  const ownerUserId = useGameStore((s) => s.ownerUserId);
  const profile = useGameStore((s) => s.profile);
  const missionProgress = useGameStore((s) => s.missionProgress);
  const hydrate = useGameStore((s) => s.hydrate);

  useEffect(() => {
    // Only proceed when the session has resolved and the user is signed in.
    if (sessionStatus !== "authenticated" || !session?.user?.id) return;

    const userId = session.user.id;

    // ── 1. Create or reuse the SyncQueue ──────────────────────────────────
    if (!queueRef.current || (queueRef.current as unknown as { userId: string }).userId !== userId) {
      // Stop the old queue (different user) if one exists.
      queueRef.current?.stop();
      queueRef.current = new SyncQueue(userId);
    }
    const queue = queueRef.current;

    // Subscribe to status changes.
    const unsub = queue.onStatusChange((s) => setSyncStatus(s));

    // ── 2. Merge decision (R7.1, R7.6, R7.8) ─────────────────────────────
    const marker = hasMergeMarker(userId);
    const hasLocalProgress =
      profile !== null ||
      Object.values(missionProgress).some((m) => m.status !== "available");

    if (ownerUserId === undefined && !marker && hasLocalProgress) {
      // First sign-in for an anonymous user who has local progress → merge.
      const local: LocalProgressDTO = {
        profile: profile
          ? {
              username: profile.username,
              provider: profile.provider,
              completedMissions: profile.completedMissions,
              unlockedBadges: profile.unlockedBadges,
              stats: profile.stats,
            }
          : null,
        missionProgress,
      };
      queue.enqueue({ type: "merge", local });
    } else if (ownerUserId !== undefined && ownerUserId !== userId) {
      // A different user signed in — discard local progress, no merge (R7.8).
      // We do nothing extra here; `hydrate` below will replace the store.
    }

    // ── 3. GET /api/progress → hydrate ────────────────────────────────────
    let cancelled = false;
    async function fetchAndHydrate() {
      try {
        const res = await fetch("/api/progress", { method: "GET" });
        if (cancelled) return;
        if (res.status === 200) {
          const dto = (await res.json()) as ProgressDTO;
          if (cancelled) return;
          hydrate(dto, userId);
        }
      } catch {
        // Network error on hydrate — the queue's own retry cycle will handle it.
      }
    }
    void fetchAndHydrate();

    // ── 4. Start the queue ────────────────────────────────────────────────
    queue.start();

    return () => {
      cancelled = true;
      unsub();
      queue.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, session?.user?.id]);

  // ── Sync indicator ─────────────────────────────────────────────────────
  let indicatorText = "";
  if (syncStatus === "retry") indicatorText = "Not saved, retrying\u2026";
  if (syncStatus === "paused") indicatorText = "Session expired, sign in again.";

  return (
    <SyncStatusContext.Provider value={syncStatus}>
      <span
        role="status"
        aria-live="polite"
        className={indicatorText ? "sr-only" : "sr-only"}
      >
        {indicatorText}
      </span>
    </SyncStatusContext.Provider>
  );
}
