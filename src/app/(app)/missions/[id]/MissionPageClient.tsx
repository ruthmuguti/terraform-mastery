"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getMission } from "@/data/missions";
import { useGameStore } from "@/lib/store";
import { MissionExecutor } from "@/components/missions/MissionExecutor";
import { DIFFICULTY_COLORS, DIFFICULTY_LABELS } from "@/lib/utils";
import { ArrowLeft, Clock, Zap } from "lucide-react";

interface MissionPageClientProps {
  missionId: string;
}

export function MissionPageClient({ missionId }: MissionPageClientProps) {
  // Resolve the full Mission object (including check functions) on the client
  const mission = getMission(missionId)!;
  const router = useRouter();
  const profile = useGameStore((s) => s.profile);
  const missionProgress = useGameStore((s) => s.missionProgress);
  const updateMissionProgress = useGameStore((s) => s.updateMissionProgress);
  const incrementStats = useGameStore((s) => s.incrementStats);

  useEffect(() => {
    if (!profile) { router.replace("/"); return; }

    const p = missionProgress[mission.id];
    // If not unlocked yet, redirect
    if (!p) {
      router.replace("/missions");
      return;
    }
    // Mark as in_progress
    if (p.status === "available") {
      updateMissionProgress(mission.id, { status: "in_progress", startedAt: Date.now() });
      incrementStats({ missionsAttempted: 1 });
    }
  }, [profile]);

  if (!profile) return null;

  const progress = missionProgress[mission.id];
  const diffColor = DIFFICULTY_COLORS[mission.difficulty];

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
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
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
