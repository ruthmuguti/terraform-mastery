"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGameStore } from "@/lib/store";
import { getLevelInfo } from "@/lib/types";
import { cn, formatXP } from "@/lib/utils";
import {
  LayoutDashboard,
  Map,
  Trophy,
  Users,
  Terminal,
  ChevronRight,
  Zap,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { href: "/dashboard",     label: "Dashboard",    icon: LayoutDashboard },
  { href: "/missions",      label: "Missions",     icon: Map },
  { href: "/achievements",  label: "Achievements", icon: Trophy },
  { href: "/leaderboard",   label: "Leaderboard",  icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();
  const profile = useGameStore((s) => s.profile);
  const { currentLevel, nextLevel, progress } = profile
    ? getLevelInfo(profile.xp)
    : {
        currentLevel: { level: 1, title: "Terraform Rookie", xp: 0, color: "#9898c8" },
        nextLevel:    { level: 2, title: "Config Scribe",    xp: 200, color: "#9898c8" },
        progress: 0,
      };

  const [collapsed, setCollapsed] = useState(false);

  // Persist collapse state across page navigations
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);
  const toggle = () => {
    setCollapsed((v) => {
      localStorage.setItem("sidebar-collapsed", String(!v));
      return !v;
    });
  };

  return (
    <aside
      className={cn(
        "shrink-0 h-screen sticky top-0 flex flex-col border-r border-noir-500 bg-noir-900 transition-all duration-200",
        collapsed ? "w-14" : "w-64"
      )}
    >
      {/* Logo / toggle */}
      <div
        className={cn(
          "border-b border-noir-500 flex items-center",
          collapsed ? "p-3 justify-center" : "p-4 justify-between"
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded bg-terminal/10 border border-terminal/30 flex items-center justify-center shrink-0">
              <Terminal className="w-4 h-4 text-terminal" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-terminal font-mono tracking-widest">TERRAOPS</div>
              <div className="text-xs text-text-muted font-mono">v1.0 CLASSIFIED</div>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded bg-terminal/10 border border-terminal/30 flex items-center justify-center">
            <Terminal className="w-4 h-4 text-terminal" />
          </div>
        )}
        <button
          onClick={toggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "text-text-muted hover:text-terminal transition-colors",
            collapsed && "absolute -right-3 top-5 w-6 h-6 rounded-full bg-noir-800 border border-noir-400 flex items-center justify-center z-10"
          )}
        >
          {collapsed
            ? <PanelLeftOpen className="w-3.5 h-3.5" />
            : <PanelLeftClose className="w-3.5 h-3.5" />
          }
        </button>
      </div>

      {/* Agent profile */}
      {profile && (
        <div className={cn("border-b border-noir-500", collapsed ? "p-3" : "p-4")}>
          <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3 mb-3")}>
            <div
              className="w-9 h-9 rounded-full border-2 flex items-center justify-center font-mono text-sm font-bold shrink-0"
              style={{
                borderColor: currentLevel.color,
                color: currentLevel.color,
                background: `${currentLevel.color}15`,
              }}
              title={collapsed ? `${profile.username} · ${currentLevel.title}` : undefined}
            >
              {profile.username.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-xs font-semibold text-text-primary truncate font-mono">{profile.username}</div>
                <div className="text-xs font-mono" style={{ color: currentLevel.color }}>
                  {currentLevel.title}
                </div>
              </div>
            )}
          </div>

          {/* XP bar — hidden when collapsed */}
          {!collapsed && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono text-text-muted">
                <span>LVL {currentLevel.level}</span>
                <span className="text-terminal">{formatXP(profile.xp)} XP</span>
              </div>
              <div className="h-1.5 rounded-full bg-noir-500 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, ${currentLevel.color}, ${currentLevel.color}cc)`,
                    boxShadow: `0 0 6px ${currentLevel.color}60`,
                  }}
                />
              </div>
              <div className="text-right text-xs font-mono text-text-muted">
                → LVL {nextLevel.level}
              </div>
            </div>
          )}

          {/* Compact XP shown when collapsed */}
          {collapsed && (
            <div
              className="mt-2 text-center text-xs font-mono font-bold"
              style={{ color: currentLevel.color }}
              title={`${formatXP(profile.xp)} XP · Level ${currentLevel.level}`}
            >
              {currentLevel.level}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className={cn("flex-1 space-y-0.5", collapsed ? "p-2" : "p-3")}>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center rounded font-mono transition-all duration-150",
                collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5 text-sm",
                active
                  ? "bg-terminal/10 text-terminal border border-terminal/20"
                  : "text-text-secondary hover:text-text-primary hover:bg-noir-600 border border-transparent"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
              {!collapsed && active && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* Stats footer */}
      {profile && (
        <div className={cn("border-t border-noir-500", collapsed ? "p-2" : "p-4 space-y-2")}>
          {collapsed ? (
            <div
              className="flex flex-col items-center gap-1 text-xs font-mono text-gold"
              title={`${profile.completedMissions.length} missions · ${profile.unlockedBadges.length} badges · ${profile.stats.streakDays}d streak`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="text-[10px]">{profile.stats.streakDays}d</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Missions" value={profile.completedMissions.length} />
                <Stat label="Badges"   value={profile.unlockedBadges.length} />
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono text-gold">
                <Zap className="w-3 h-3" />
                <span>{profile.stats.streakDays} day streak</span>
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-noir-700 rounded p-2 text-center">
      <div className="text-sm font-bold font-mono text-terminal">{value}</div>
      <div className="text-xs text-text-muted font-mono">{label}</div>
    </div>
  );
}
