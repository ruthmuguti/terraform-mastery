"use client";

import { useGameStore } from "@/lib/store";
import { getLevelInfo } from "@/lib/types";
import { formatXP } from "@/lib/utils";
import { Bell, Settings } from "lucide-react";

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const profile = useGameStore((s) => s.profile);
  const { currentLevel } = profile
    ? getLevelInfo(profile.xp)
    : { currentLevel: { level: 1, title: "Terraform Rookie", xp: 0, color: "#9898c8" } };

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
        <button className="w-8 h-8 rounded border border-noir-500 flex items-center justify-center text-text-muted hover:text-text-primary hover:border-noir-400 transition-colors">
          <Bell className="w-3.5 h-3.5" />
        </button>
        <button className="w-8 h-8 rounded border border-noir-500 flex items-center justify-center text-text-muted hover:text-text-primary hover:border-noir-400 transition-colors">
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
