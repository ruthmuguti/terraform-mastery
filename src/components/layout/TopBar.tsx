"use client";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store";
import { getLevelInfo } from "@/lib/types";
import { formatXP } from "@/lib/utils";
import { Bell, LogOut, HelpCircle } from "lucide-react";

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const router = useRouter();
  const profile = useGameStore((s) => s.profile);
  const resetProgress = useGameStore((s) => s.resetProgress);
  const replayTour = useGameStore((s) => s.replayTour);

  // Replay the first-run guide: clear the seen flag, then land on the dashboard
  // where the tour auto-triggers against its anchors.
  const handleReplayTour = () => {
    replayTour();
    router.push("/dashboard");
  };
  const { currentLevel } = profile
    ? getLevelInfo(profile.xp)
    : { currentLevel: { level: 1, title: "Terraform Rookie", xp: 0, color: "#9898c8" } };

  // Progress lives only in this browser, so signing out wipes it.
  const handleSignOut = () => {
    const ok = window.confirm(
      "Sign out? This clears your progress in this browser and returns you to the start screen."
    );
    if (!ok) return;
    resetProgress();
    router.push("/");
  };

  return (
    <header className="h-14 border-b border-noir-500 bg-noir-900/80 backdrop-blur-sm flex items-center px-6 gap-4 sticky top-0 z-10">
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-bold font-mono text-text-primary truncate">{title}</h1>
        {subtitle && <p className="text-xs text-text-muted font-mono">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {profile && (
          <div className="flex items-center gap-2 bg-terminal/5 border border-terminal/15 rounded px-3 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-terminal animate-pulse" />
            <span className="text-xs font-mono text-terminal">{formatXP(profile.xp)} XP</span>
            <span className="text-xs font-mono text-text-muted">·</span>
            <span className="text-xs font-mono" style={{ color: currentLevel.color }}>
              LVL {currentLevel.level}
            </span>
          </div>
        )}

        {profile && (
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs font-mono text-text-muted hover:text-text-primary border border-noir-500 hover:border-noir-400 rounded px-2 py-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terminal"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline max-w-[120px] truncate">{profile.username}</span>
            <span className="sr-only sm:not-sr-only">· Sign out</span>
          </button>
        )}

        <button className="w-8 h-8 rounded border border-noir-500 flex items-center justify-center text-text-muted hover:text-text-primary hover:border-noir-400 transition-colors">
          <Bell className="w-3.5 h-3.5" />
          <span className="sr-only">Notifications</span>
        </button>
        {profile && (
          <button
            type="button"
            onClick={handleReplayTour}
            title="Replay the guided tour"
            className="w-8 h-8 rounded border border-noir-500 flex items-center justify-center text-text-muted hover:text-text-primary hover:border-noir-400 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="sr-only">Replay guided tour</span>
          </button>
        )}
      </div>
    </header>
  );
}
