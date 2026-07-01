"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store";
import { getLevelInfo } from "@/lib/types";
import { formatXP } from "@/lib/utils";
import { TopBar } from "@/components/layout/TopBar";
import { Trophy, Zap } from "lucide-react";

// Static demo leaderboard (in a real app this would come from a database)
const DEMO_AGENTS = [
  { username: "xShadowByte", xp: 5200, completedMissions: 6, badges: 10 },
  { username: "0xVortex", xp: 4100, completedMissions: 5, badges: 8 },
  { username: "NightCipher", xp: 3600, completedMissions: 5, badges: 7 },
  { username: "GridPhantom", xp: 2800, completedMissions: 4, badges: 6 },
  { username: "SpecterNode", xp: 2100, completedMissions: 3, badges: 5 },
  { username: "CodeWraith", xp: 1650, completedMissions: 3, badges: 4 },
  { username: "PulseRunner", xp: 1100, completedMissions: 2, badges: 3 },
  { username: "ZeroFrame", xp: 750, completedMissions: 2, badges: 2 },
  { username: "StaticEcho", xp: 400, completedMissions: 1, badges: 1 },
  { username: "BinaryGhost", xp: 200, completedMissions: 1, badges: 1 },
];

const RANK_COLORS: Record<number, string> = {
  1: "#c9a227",
  2: "#9898c8",
  3: "#c97a27",
};

export default function LeaderboardPage() {
  const router = useRouter();
  const profile = useGameStore((s) => s.profile);
  const hasHydrated = useGameStore((s) => s._hasHydrated);

  useEffect(() => {
    if (hasHydrated && !profile) router.replace("/");
  }, [profile, hasHydrated, router]);

  if (!hasHydrated || !profile) return null;

  // Insert current user into leaderboard
  const allAgents = [
    ...DEMO_AGENTS,
    { username: profile.username + " (you)", xp: profile.xp, completedMissions: profile.completedMissions.length, badges: profile.unlockedBadges.length },
  ].sort((a, b) => b.xp - a.xp);

  const userRank = allAgents.findIndex((a) => a.username.includes("(you)")) + 1;

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-y-auto">
      <TopBar title="Leaderboard" subtitle={`Your rank: #${userRank} of ${allAgents.length}`} />

      <div className="flex-1 p-6 max-w-3xl">
        <div className="flex items-center gap-2 mb-6">
          <Trophy className="w-4 h-4 text-gold" />
          <span className="text-xs font-mono text-text-muted tracking-widest">GLOBAL RANKINGS</span>
          <span className="ml-2 text-xs font-mono text-text-muted bg-noir-700 px-2 py-0.5 rounded border border-noir-500">
            DEMO DATA
          </span>
        </div>

        {/* Top 3 podium */}
        <div className="flex items-end justify-center gap-3 mb-8">
          {[
            { rank: 2, height: "h-20" },
            { rank: 1, height: "h-28" },
            { rank: 3, height: "h-16" },
          ].map(({ rank, height }) => {
            const agent = allAgents[rank - 1];
            if (!agent) return null;
            const color = RANK_COLORS[rank] || "#5a5a7a";
            return (
              <div key={rank} className="flex flex-col items-center gap-2 flex-1">
                <div className="text-xs font-mono text-text-secondary truncate w-full text-center">{agent.username}</div>
                <div className="text-xs font-mono text-gold">{formatXP(agent.xp)} XP</div>
                <div
                  className={`${height} w-full rounded-t-lg border flex items-center justify-center`}
                  style={{ background: `${color}15`, borderColor: `${color}40` }}
                >
                  <span className="text-2xl font-bold font-mono" style={{ color }}>
                    {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Full table */}
        <div className="bg-noir-800 border border-noir-500 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-2 border-b border-noir-500 text-xs font-mono text-text-muted">
            <span className="col-span-1">#</span>
            <span className="col-span-5">Agent</span>
            <span className="col-span-3 text-right">XP</span>
            <span className="col-span-2 text-right">Missions</span>
            <span className="col-span-1 text-right">🏅</span>
          </div>

          {allAgents.map((agent, idx) => {
            const rank = idx + 1;
            const isYou = agent.username.includes("(you)");
            const rankColor = RANK_COLORS[rank];
            const { currentLevel } = getLevelInfo(agent.xp);

            return (
              <div
                key={agent.username}
                className={`grid grid-cols-12 px-4 py-3 text-xs font-mono border-b border-noir-600 last:border-b-0 transition-colors ${
                  isYou ? "bg-terminal/5 border-terminal/10" : "hover:bg-noir-700"
                }`}
              >
                <span
                  className="col-span-1 font-bold"
                  style={{ color: rankColor || (isYou ? "#00ff9f" : "#5a5a7a") }}
                >
                  {rank}
                </span>
                <div className="col-span-5 flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold shrink-0"
                    style={{
                      borderColor: isYou ? "#00ff9f60" : `${currentLevel.color}40`,
                      color: isYou ? "#00ff9f" : currentLevel.color,
                      background: isYou ? "#00ff9f10" : `${currentLevel.color}10`,
                    }}
                  >
                    {agent.username.charAt(0).toUpperCase()}
                  </div>
                  <span className={isYou ? "text-terminal" : "text-text-primary"}>{agent.username}</span>
                </div>
                <span className="col-span-3 text-right text-gold flex items-center justify-end gap-1">
                  <Zap className="w-3 h-3" />{formatXP(agent.xp)}
                </span>
                <span className="col-span-2 text-right text-text-secondary">{agent.completedMissions}</span>
                <span className="col-span-1 text-right text-text-secondary">{agent.badges}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
