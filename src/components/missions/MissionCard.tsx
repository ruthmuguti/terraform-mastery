"use client";

import Link from "next/link";
import type { Mission } from "@/lib/types";
import type { MissionProgress } from "@/lib/store";
import { cn, DIFFICULTY_COLORS, DIFFICULTY_LABELS } from "@/lib/utils";
import { Lock, CheckCircle2, Clock, Zap, ChevronRight, Play, RefreshCw } from "lucide-react";

interface MissionCardProps {
  mission: Mission;
  progress?: MissionProgress;
}

export function MissionCard({ mission, progress }: MissionCardProps) {
  const status = progress?.status ?? "locked";
  const isLocked = status === "locked";
  const isCompleted = status === "completed";
  const isUnverified = isCompleted && progress?.verified === false;
  const diffColor = DIFFICULTY_COLORS[mission.difficulty];
  const completedObjectives = progress?.completedObjectives?.length ?? 0;
  const totalObjectives = mission.objectives.length;

  return (
    <div
      className={cn(
        "relative rounded-lg border overflow-hidden group transition-all duration-200",
        isLocked
          ? "border-noir-500 bg-noir-800/50"
          : isCompleted
          ? "border-terminal/25 bg-noir-700 hover:border-terminal/40 hover:shadow-lg"
          : "border-noir-400 bg-noir-700 hover:border-purple/40 hover:shadow-lg"
      )}
      style={
        isCompleted
          ? { boxShadow: "0 0 0 0 rgba(0,255,159,0)" }
          : !isLocked
          ? { boxShadow: "0 0 0 0 rgba(124,93,249,0)" }
          : {}
      }
    >
      {/* Top accent bar */}
      <div
        className="h-0.5 w-full"
        style={{
          background: isLocked
            ? "rgba(30,30,56,0.5)"
            : isCompleted
            ? `linear-gradient(90deg, #00ff9f, #00ff9f30)`
            : `linear-gradient(90deg, ${diffColor}, ${diffColor}30)`,
        }}
      />

      <div className={cn("p-5", isLocked && "opacity-50")}>
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-mono text-text-muted tracking-widest">{mission.operationCode}</span>
              {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-terminal" />}
              {isUnverified && (
                <span
                  className="text-xs font-mono px-2 py-0.5 rounded border"
                  style={{ color: "#fbbf24", borderColor: "rgba(251, 191, 36, 0.3)", background: "rgba(251, 191, 36, 0.08)" }}
                  aria-label="Completed offline, not verified"
                >
                  Unverified
                </span>
              )}
              {isLocked && <Lock className="w-3 h-3 text-text-muted" />}
            </div>
            <h3 className="font-bold font-mono text-sm text-text-primary">{mission.title}</h3>
          </div>

          <div
            className="text-xs font-mono px-2 py-1 rounded border shrink-0"
            style={
              isLocked
                ? { color: "#5a5a7a", borderColor: "rgba(30,30,56,0.8)", background: "rgba(16,16,24,0.5)" }
                : { color: diffColor, borderColor: `${diffColor}35`, background: `${diffColor}08` }
            }
          >
            {DIFFICULTY_LABELS[mission.difficulty]}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-text-secondary leading-relaxed mb-4 line-clamp-2">{mission.description}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {mission.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-xs font-mono px-2 py-0.5 rounded"
              style={
                isLocked
                  ? { color: "#5a5a7a", background: "rgba(16,16,24,0.5)" }
                  : { color: "#9898b8", background: "rgba(30,30,56,0.8)" }
              }
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Progress bar (in-progress only) */}
        {status === "in_progress" && completedObjectives > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-text-muted">Progress</span>
              <span className="text-purple">{completedObjectives}/{totalObjectives} objectives</span>
            </div>
            <div className="h-1 rounded-full bg-noir-500 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${(completedObjectives / totalObjectives) * 100}%`, background: "#7c5df9" }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1 text-text-muted">
              <Clock className="w-3 h-3" />
              {mission.estimatedMinutes}m
            </span>
            <span className={cn("flex items-center gap-1", isLocked ? "text-text-muted" : "text-gold")}>
              <Zap className="w-3 h-3" />
              {mission.xpReward} XP
            </span>
          </div>

          {isLocked ? (
            <div className="flex items-center gap-1.5 text-xs font-mono text-text-muted px-3 py-1.5 rounded border border-noir-500 bg-noir-800/50 select-none">
              <Lock className="w-3 h-3" />
              Locked
            </div>
          ) : isUnverified ? (
            <Link
              href={`/missions/${mission.id}?verify=true`}
              className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded border transition-all text-warning border-warning/30 hover:bg-warning/10 hover:border-warning/50"
            >
              <RefreshCw className="w-3 h-3" />
              Replay to verify
            </Link>
          ) : (
            <Link
              href={`/missions/${mission.id}`}
              className={cn(
                "flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded border transition-all",
                isCompleted
                  ? "text-terminal/80 border-terminal/20 hover:bg-terminal/10 hover:text-terminal"
                  : "text-text-primary border-noir-400 hover:border-purple/50 hover:text-purple hover:bg-purple/5"
              )}
            >
              {isCompleted ? (
                <>Replay <ChevronRight className="w-3 h-3" /></>
              ) : status === "in_progress" ? (
                <>Continue <Play className="w-3 h-3 fill-current" /></>
              ) : (
                <>Start <Play className="w-3 h-3" /></>
              )}
            </Link>
          )}
        </div>
      </div>

      {/* Completed checkmark overlay */}
      {isCompleted && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-terminal/10 border border-terminal/30 flex items-center justify-center">
          <CheckCircle2 className="w-3.5 h-3.5 text-terminal" />
        </div>
      )}
    </div>
  );
}
