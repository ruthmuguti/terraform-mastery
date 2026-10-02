"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useGameStore } from "@/lib/store";
import { MISSIONS, getChapters, CHAPTER_NAMES } from "@/data/missions";
import { BADGES } from "@/data/badges";
import { getLevelInfo } from "@/lib/types";
import { formatXP, timeAgo } from "@/lib/utils";
import { TopBar } from "@/components/layout/TopBar";
import { BadgeCard } from "@/components/achievements/BadgeCard";
import { GuideTour } from "@/components/onboarding/GuideTour";
import {
  Zap, Trophy, Map, Terminal, Clock, ChevronRight,
  TrendingUp, CheckCircle2, Shield, BookOpen, CircleCheck, Circle,
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const profile = useGameStore((s) => s.profile);
  const missionProgress = useGameStore((s) => s.missionProgress);
  const markTourSeen = useGameStore((s) => s.markTourSeen);
  const [mounted, setMounted] = useState(false);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && !profile) router.replace("/");
  }, [profile, mounted, router]);

  // Auto-start the guided tour once, on first dashboard entry.
  useEffect(() => {
    if (mounted && profile && !profile.hasSeenTour) setShowTour(true);
  }, [mounted, profile]);

  if (!mounted || !profile) return null;

  const { currentLevel, nextLevel, progress } = getLevelInfo(profile.xp);
  const xpToNext = nextLevel.xp - profile.xp;

  const completedCount = profile.completedMissions.length;
  const totalMissions = MISSIONS.length;
  const availableCount = Object.values(missionProgress).filter((p) => p.status === "available").length;

  // Find a recommended next mission
  const nextMission = MISSIONS.find(
    (m) => missionProgress[m.id]?.status === "available"
  );

  // Recent badges
  const recentBadges = BADGES.filter((b) => profile.unlockedBadges.includes(b.id)).slice(0, 4);

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-y-auto">
      {showTour && (
        <GuideTour
          onClose={() => {
            setShowTour(false);
            markTourSeen();
          }}
        />
      )}
      <TopBar title="Dashboard" subtitle={`Welcome back, ${profile.username}`} />

      <div className="flex-1 p-6 space-y-6 max-w-5xl">
        {/* Agent card */}
        <div
          className="rounded-xl border border-noir-400 bg-noir-800 p-6 relative overflow-hidden"
          style={{ boxShadow: `0 0 40px ${currentLevel.color}08` }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at top left, ${currentLevel.color}06 0%, transparent 70%)`,
            }}
          />
          <div className="relative flex flex-wrap gap-6 items-start">
            {/* Avatar + name */}
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-full border-2 flex items-center justify-center font-mono text-xl font-bold"
                style={{ borderColor: currentLevel.color, color: currentLevel.color, background: `${currentLevel.color}15` }}
              >
                {profile.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-mono font-bold text-text-primary">{profile.username}</div>
                <div className="text-sm font-mono" style={{ color: currentLevel.color }}>
                  {currentLevel.title}
                </div>
                <div className="text-xs text-text-muted font-mono">
                  Active {timeAgo(profile.lastActiveAt)}
                </div>
              </div>
            </div>

            {/* XP bar */}
            <div className="flex-1 min-w-60">
              <div className="flex justify-between text-xs font-mono mb-2">
                <span className="text-text-muted">LEVEL {currentLevel.level}</span>
                <span style={{ color: currentLevel.color }}>{formatXP(profile.xp)} XP</span>
              </div>
              <div className="h-3 rounded-full bg-noir-500 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, ${currentLevel.color}, ${currentLevel.color}88)`,
                    boxShadow: `0 0 8px ${currentLevel.color}60`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs font-mono mt-1">
                <span className="text-text-muted">{Math.round(progress)}% to next level</span>
                <span className="text-text-muted">{xpToNext} XP needed → LVL {nextLevel.level}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Missions Done", value: completedCount, icon: CheckCircle2, color: "#00ff9f" },
            { label: "Badges Earned", value: profile.unlockedBadges.length, icon: Trophy, color: "#c9a227" },
            { label: "Total XP", value: formatXP(profile.xp), icon: Zap, color: "#7c5df9" },
            { label: "Day Streak", value: profile.stats.streakDays, icon: TrendingUp, color: "#00c8ff" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-noir-800 border border-noir-500 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4" style={{ color }} />
                <span className="text-xs font-mono text-text-muted">{label}</span>
              </div>
              <div className="text-xl font-bold font-mono" style={{ color }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Next mission */}
          <div data-tour="next-op" className="bg-noir-800 border border-noir-500 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-terminal" />
              <h2 className="font-mono font-bold text-sm text-text-secondary tracking-widest">NEXT OPERATION</h2>
            </div>

            {nextMission ? (
              <div>
                <div className="text-xs font-mono text-text-muted mb-1">{nextMission.operationCode}</div>
                <h3 className="font-mono font-bold text-text-primary mb-2">{nextMission.title}</h3>
                <p className="text-xs text-text-secondary mb-4 leading-relaxed">{nextMission.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs font-mono text-text-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {nextMission.estimatedMinutes}m
                    </span>
                    <span className="flex items-center gap-1 text-gold">
                      <Zap className="w-3 h-3" />
                      {nextMission.xpReward} XP
                    </span>
                  </div>
                  <Link
                    href={`/missions/${nextMission.id}`}
                    className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded bg-terminal/10 border border-terminal/20 text-terminal hover:bg-terminal/20 transition-all"
                  >
                    Start <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ) : completedCount >= totalMissions ? (
              <div className="text-center py-4">
                <div className="text-2xl mb-2">👑</div>
                <div className="text-terminal font-mono font-bold text-sm">All Operations Complete!</div>
                <div className="text-xs text-text-muted font-mono mt-1">You are an IaC Legend.</div>
              </div>
            ) : (
              <div className="text-xs text-text-muted font-mono">
                Complete earlier missions to unlock new operations.
              </div>
            )}
          </div>

          {/* Progress overview */}
          <div className="bg-noir-800 border border-noir-500 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Map className="w-4 h-4 text-purple" />
              <h2 className="font-mono font-bold text-sm text-text-secondary tracking-widest">MISSION PROGRESS</h2>
            </div>

            <div className="space-y-3">
              {getChapters().map(({ chapter, missions }) => {
                const done = missions.filter((m) => profile.completedMissions.includes(m.id)).length;
                const pct = Math.round((done / missions.length) * 100);
                return (
                  <div key={chapter}>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-text-muted">CH.{chapter} — {CHAPTER_NAMES[chapter]}</span>
                      <span className="text-text-secondary">{done}/{missions.length}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-noir-500 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: pct === 100 ? "#00ff9f" : "#7c5df9",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-noir-500 flex items-center justify-between">
              <span className="text-xs font-mono text-text-muted">
                {completedCount} of {totalMissions} complete
              </span>
              <Link
                href="/missions"
                className="flex items-center gap-1 text-xs font-mono text-purple hover:text-text-primary transition-colors"
              >
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Recent badges */}
        {recentBadges.length > 0 && (
          <div className="bg-noir-800 border border-noir-500 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-gold" />
                <h2 className="font-mono font-bold text-sm text-text-secondary tracking-widest">RECENT BADGES</h2>
              </div>
              <Link
                href="/achievements"
                className="flex items-center gap-1 text-xs font-mono text-gold hover:text-text-primary transition-colors"
              >
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {recentBadges.map((badge) => (
                <BadgeCard key={badge.id} badge={badge} unlocked={true} size="sm" />
              ))}
            </div>
          </div>
        )}

        {/* Production-grade checklist */}
        <ProductionChecklist completedMissions={profile.completedMissions} />

        {/* Quick actions */}
        <div className="bg-noir-800 border border-noir-500 rounded-xl p-5">
          <h2 className="font-mono font-bold text-sm text-text-secondary tracking-widest mb-4">QUICK ACTIONS</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { href: "/missions", icon: Map, label: "Browse Missions", color: "#7c5df9" },
              { href: "/achievements", icon: Trophy, label: "View Achievements", color: "#c9a227" },
              { href: nextMission ? `/missions/${nextMission.id}` : "/missions", icon: Terminal, label: "Open Terminal", color: "#00ff9f" },
            ].map(({ href, icon: Icon, label, color }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-3 p-3 rounded-lg border border-noir-400 hover:border-opacity-50 transition-all hover:bg-noir-700"
                style={{ borderColor: `${color}20` }}
              >
                <div
                  className="w-8 h-8 rounded flex items-center justify-center shrink-0"
                  style={{ background: `${color}15`, color }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-mono text-text-primary">{label}</span>
                <ChevronRight className="w-3 h-3 ml-auto text-text-muted" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Production-Grade Checklist ─────────────────────────────────────────────
// Based on Chapter 8 of "Terraform: Up and Running, 3rd Edition"

const PROD_CHECKLIST = [
  {
    label: "Remote state backend configured",
    detail: "Never store state locally — use S3+DynamoDB, GCS, or Azure Blob",
    missionId: "mission-07",
    color: "#00c8ff",
  },
  {
    label: "Sensitive variables marked `sensitive = true`",
    detail: "Prevents credentials from appearing in plan/apply output and logs",
    missionId: "mission-11",
    color: "#ff6b6b",
  },
  {
    label: "Input validation blocks added",
    detail: "Catch invalid inputs before resources are provisioned",
    missionId: "mission-15",
    color: "#00ff9f",
  },
  {
    label: "Lifecycle rules for critical resources",
    detail: "`create_before_destroy` for zero-downtime, `prevent_destroy` for databases",
    missionId: "mission-12",
    color: "#7c5df9",
  },
  {
    label: "Module versioning pinned",
    detail: "Always pin modules to a specific version — `version = \"~> 5.0\"` prevents surprise changes",
    missionId: "mission-06",
    color: "#c9a227",
  },
  {
    label: "Workspaces for environment isolation",
    detail: "One backend, separate state files per environment (dev/staging/prod)",
    missionId: "mission-14",
    color: "#ff9f00",
  },
  {
    label: "`terraform fmt` in CI pipeline",
    detail: "Run `terraform fmt -check` on every PR to enforce canonical style",
    missionId: "mission-15",
    color: "#00ff9f",
  },
  {
    label: "Locals for DRY, named values",
    detail: "Use `locals {}` to eliminate magic strings — one definition, no drift",
    missionId: "mission-08",
    color: "#9898c8",
  },
];

function ProductionChecklist({ completedMissions }: { completedMissions: string[] }) {
  const totalDone = PROD_CHECKLIST.filter((item) =>
    completedMissions.includes(item.missionId)
  ).length;
  const pct = Math.round((totalDone / PROD_CHECKLIST.length) * 100);

  return (
    <div className="bg-noir-800 border border-noir-500 rounded-xl p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-purple" />
          <h2 className="font-mono font-bold text-sm text-text-secondary tracking-widest">
            PRODUCTION-GRADE CHECKLIST
          </h2>
        </div>
        <span className="text-xs font-mono text-text-muted">{totalDone}/{PROD_CHECKLIST.length}</span>
      </div>
      <p className="text-xs text-text-muted font-mono mb-3">
        From <span className="text-purple italic">Terraform: Up and Running, 3rd Ed.</span> — Ch. 8
      </p>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-noir-500 overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: pct === 100 ? "#00ff9f" : "linear-gradient(90deg, #7c5df9, #00c8ff)",
          }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PROD_CHECKLIST.map(({ label, detail, missionId, color }) => {
          const done = completedMissions.includes(missionId);
          return (
            <div
              key={label}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg transition-colors ${
                done ? "bg-noir-700/50" : "bg-noir-900/40"
              }`}
            >
              {done ? (
                <CircleCheck className="w-4 h-4 shrink-0 mt-0.5" style={{ color }} />
              ) : (
                <Circle className="w-4 h-4 shrink-0 mt-0.5 text-noir-400" />
              )}
              <div className="min-w-0">
                <p
                  className={`text-xs font-mono font-semibold leading-tight ${
                    done ? "text-text-primary" : "text-text-muted"
                  }`}
                >
                  {label}
                </p>
                <p className="text-[10px] text-text-muted/70 font-mono mt-0.5 leading-snug">{detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      {pct === 100 && (
        <div className="mt-3 pt-3 border-t border-terminal/20 flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-terminal" />
          <span className="text-xs font-mono text-terminal font-bold">
            All production criteria met. Infrastructure is hardened.
          </span>
        </div>
      )}
    </div>
  );
}
