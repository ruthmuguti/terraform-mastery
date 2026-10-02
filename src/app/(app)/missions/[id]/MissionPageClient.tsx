"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getMission } from "@/data/missions";
import { useGameStore } from "@/lib/store";
import { MissionExecutor } from "@/components/missions/MissionExecutor";
import { DIFFICULTY_COLORS, DIFFICULTY_LABELS } from "@/lib/utils";
import { ArrowLeft, Clock, Zap, RefreshCw } from "lucide-react";
import { useSession } from "next-auth/react";
import { startNewTranscript } from "@/lib/sync/transcript-store";

interface MissionPageClientProps {
  missionId: string;
}

export function MissionPageClient({ missionId }: MissionPageClientProps) {
  // Resolve the full Mission object (including check functions) on the client
  const mission = getMission(missionId)!;
  const profile = useGameStore((s) => s.profile);
  const missionProgress = useGameStore((s) => s.missionProgress);
  const updateMissionProgress = useGameStore((s) => s.updateMissionProgress);
  const incrementStats = useGameStore((s) => s.incrementStats);
  const [mounted, setMounted] = useState(false);
  const [verifyMode, setVerifyMode] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "anonymous";

  useEffect(() => { setMounted(true); }, []);

  // Check if we're in verify mode (coming from "Replay to verify" button)
  useEffect(() => {
    if (searchParams.get("verify") === "true") {
      setVerifyMode(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!mounted) return;

    const p = missionProgress[mission.id];
    
    // Handle verify mode: clear the transcript and latches to start fresh
    if (verifyMode && p) {
      // Start a new empty transcript
      const provider = profile?.provider ?? "aws";
      startNewTranscript(userId, mission.id, provider);
      
      // Clear latches by resetting completed objectives
      updateMissionProgress(mission.id, { 
        completedObjectives: [],
        status: "in_progress",
      });
      
      // Clear the verify flag from URL
      router.replace(`/missions/${mission.id}`);
      setVerifyMode(false);
      return;
    }
    
    // If the mission isn't in the store yet, it's locked or not initialized.
    // For anonymous users, initialize mission-01 if needed.
    if (!p) {
      if (mission.id === "mission-01") {
        // Initialize mission-01 for anonymous users
        updateMissionProgress(mission.id, { 
          status: "available", 
          missionId: mission.id,
          hintsUsed: 0,
          commandCount: 0,
          completedObjectives: []
        });
      } else {
        // For other missions, redirect to mission list
        window.location.replace("/missions");
        return;
      }
    }
    
    // Mark as in_progress when user lands on the page
    const progress = missionProgress[mission.id];
    if (progress?.status === "available") {
      updateMissionProgress(mission.id, { status: "in_progress", startedAt: Date.now() });
      if (profile) incrementStats({ missionsAttempted: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, verifyMode]);

  if (!mounted) return null;

  const progress = missionProgress[mission.id];
  const diffColor = DIFFICULTY_COLORS[mission.difficulty];
  const isUnverified = progress?.status === "completed" && progress?.verified === false;

  const handleReplayToVerify = () => {
    // Start a new empty transcript
    const provider = profile?.provider ?? "aws";
    startNewTranscript(userId, mission.id, provider);
    
    // Clear latches by resetting completed objectives
    updateMissionProgress(mission.id, { 
      completedObjectives: [],
      status: "in_progress",
    });
    
    // Force a re-render by navigating
    router.push(`/missions/${mission.id}`);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Mission header bar */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-noir-500 bg-noir-900/80 backdrop-blur-sm shrink-0">
        <Link
          href="/missions"
          className="flex items-center gap-1.5 text-xs font-mono text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Missions
        </Link>

        <div className="h-4 w-px bg-noir-500" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-text-muted tracking-widest">{mission.operationCode}</span>
            <span className="text-xs font-mono text-text-secondary font-bold">{mission.title}</span>
            {isUnverified && (
              <span
                className="text-xs font-mono px-2 py-0.5 rounded border"
                style={{ color: "#fbbf24", borderColor: "rgba(251, 191, 36, 0.3)", background: "rgba(251, 191, 36, 0.08)" }}
                aria-label="Completed offline, not verified"
              >
                Unverified
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isUnverified && (
            <button
              onClick={handleReplayToVerify}
              className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded border transition-all text-warning border-warning/30 hover:bg-warning/10 hover:border-warning/50"
            >
              <RefreshCw className="w-3 h-3" />
              Replay to verify
            </button>
          )}
          <span
            className="text-xs font-mono px-2 py-0.5 rounded border"
            style={{ color: diffColor, borderColor: `${diffColor}40`, background: `${diffColor}10` }}
          >
            {DIFFICULTY_LABELS[mission.difficulty]}
          </span>
          <span className="flex items-center gap-1 text-xs font-mono text-text-muted">
            <Clock className="w-3 h-3" /> {mission.estimatedMinutes}m
          </span>
          <span className="flex items-center gap-1 text-xs font-mono text-gold">
            <Zap className="w-3 h-3" /> {mission.xpReward} XP
          </span>
        </div>
      </div>

      {/* Main executor */}
      <div className="flex-1 min-h-0">
        <MissionExecutor mission={mission} progress={progress} />
      </div>
    </div>
  );
}
