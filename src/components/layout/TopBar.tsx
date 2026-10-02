"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useGameStore } from "@/lib/store";
import { getLevelInfo } from "@/lib/types";
import { formatXP } from "@/lib/utils";
import { useSyncStatus } from "@/lib/sync/SyncManager";
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

  const { data: session, status: authStatus } = useSession();
  const syncStatus = useSyncStatus();

  // Dropdown open/close state
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!menuOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [menuOpen]);

  // Close when clicking outside the menu
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const isSignedIn = authStatus === "authenticated" && session?.user;
  const userName = session?.user?.name ?? "Player";
  const userImage = session?.user?.image ?? null;

  return (
    <header className="h-14 border-b border-noir-500 bg-noir-900/80 backdrop-blur-sm flex items-center px-6 gap-4 sticky top-0 z-10">
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-bold font-mono text-text-primary truncate">{title}</h1>
        {subtitle && <p className="text-xs text-text-muted font-mono">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Sync status indicator */}
        {syncStatus === "retry" && (
          <span
            role="status"
            aria-live="polite"
            className="text-xs font-mono text-yellow-400"
          >
            Not saved, retrying…
          </span>
        )}
        {syncStatus === "paused" && (
          <span
            role="status"
            aria-live="polite"
            className="text-xs font-mono text-red-400"
          >
            Session expired, sign in again
          </span>
        )}

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

        {/* Auth controls */}
        {isSignedIn ? (
          <div className="relative" ref={menuRef}>
            <button
              ref={buttonRef}
              aria-label={`Account menu for ${userName}`}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded border border-noir-500 px-2 py-1 text-text-muted hover:text-text-primary hover:border-noir-400 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terminal"
            >
              {userImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userImage}
                  alt=""
                  aria-hidden="true"
                  className="w-5 h-5 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="w-5 h-5 rounded-full bg-noir-500 flex items-center justify-center text-[10px] font-mono text-text-primary select-none" aria-hidden="true">
                  {userName.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="text-xs font-mono text-text-primary hidden sm:inline max-w-[120px] truncate">
                {userName}
              </span>
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1 min-w-[140px] rounded border border-noir-500 bg-noir-800 shadow-lg py-1 z-20"
              >
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    signOut({ redirectTo: "/" });
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-mono text-text-primary hover:bg-noir-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-terminal transition-colors"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="text-xs font-mono text-terminal hover:text-terminal/80 border border-terminal/30 rounded px-2 py-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terminal"
          >
            Sign in
          </Link>
        )}

        <button className="w-8 h-8 rounded border border-noir-500 flex items-center justify-center text-text-muted hover:text-text-primary hover:border-noir-400 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terminal">
          <Bell className="w-3.5 h-3.5" />
          <span className="sr-only">Notifications</span>
        </button>
        <button className="w-8 h-8 rounded border border-noir-500 flex items-center justify-center text-text-muted hover:text-text-primary hover:border-noir-400 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terminal">
          <Settings className="w-3.5 h-3.5" />
          <span className="sr-only">Settings</span>
        </button>
      </div>
    </header>
  );
}
