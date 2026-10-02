import { auth } from "@/lib/auth";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/server/leaderboard";
import { getLevelInfo } from "@/lib/types";
import { formatXP } from "@/lib/utils";
import { TopBar } from "@/components/layout/TopBar";
import { Trophy, Zap } from "lucide-react";

const RANK_COLORS: Record<number, string> = {
  1: "#c9a227",
  2: "#9898c8",
  3: "#c97a27",
};

function EntryRow({
  entry,
  isMe,
}: {
  entry: LeaderboardEntry;
  isMe: boolean;
}) {
  const rankColor = RANK_COLORS[entry.rank];
  const { currentLevel } = getLevelInfo(entry.verifiedXp);

  return (
    <div
      className={`grid grid-cols-12 px-4 py-3 text-xs font-mono border-b border-noir-600 last:border-b-0 transition-colors ${
        isMe ? "bg-terminal/5 border-terminal/10" : "hover:bg-noir-700"
      }`}
      aria-current={isMe ? "true" : undefined}
    >
      <span
        className="col-span-1 font-bold"
        style={{ color: rankColor || (isMe ? "#00ff9f" : "#5a5a7a") }}
      >
        {entry.rank}
      </span>
      <div className="col-span-5 flex items-center gap-2">
        {entry.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.avatarUrl}
            alt=""
            className="w-5 h-5 rounded-full shrink-0 border"
            style={{
              borderColor: isMe ? "#00ff9f60" : `${currentLevel.color}40`,
            }}
          />
        ) : (
          <div
            className="w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold shrink-0"
            style={{
              borderColor: isMe ? "#00ff9f60" : `${currentLevel.color}40`,
              color: isMe ? "#00ff9f" : currentLevel.color,
              background: isMe ? "#00ff9f10" : `${currentLevel.color}10`,
            }}
          >
            {entry.name.charAt(0).toUpperCase()}
          </div>
        )}
        <span className={isMe ? "text-terminal" : "text-text-primary"}>
          {entry.name}
          {isMe && <span className="ml-1 text-terminal/60">(you)</span>}
        </span>
      </div>
      <span className="col-span-3 text-right text-gold flex items-center justify-end gap-1">
        <Zap className="w-3 h-3" />
        {formatXP(entry.verifiedXp)}
      </span>
      <span className="col-span-2 text-right text-text-secondary">
        {entry.verifiedCount}
      </span>
      <span className="col-span-1 text-right text-text-muted font-mono text-xs">
        {entry.title.split(" ")[0]}
      </span>
    </div>
  );
}

export default async function LeaderboardPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const dto = await getLeaderboard(userId ?? undefined);

  const myRank = dto.me?.rank ?? null;

  if (dto.entries.length === 0) {
    return (
      <div className="flex flex-col min-h-0 flex-1 overflow-y-auto">
        <TopBar title="Leaderboard" subtitle="Global rankings" />
        <div className="flex-1 p-6 max-w-3xl flex items-center justify-center">
          <p className="text-sm font-mono text-text-muted">
            Leaderboard unavailable, try again later.
          </p>
        </div>
      </div>
    );
  }

  const top3 = [
    { rank: 2, height: "h-20" },
    { rank: 1, height: "h-28" },
    { rank: 3, height: "h-16" },
  ];

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-y-auto">
      <TopBar
        title="Leaderboard"
        subtitle={
          myRank
            ? `Your rank: #${myRank} of ${dto.entries.length}${(dto.me && !dto.me.inTop) ? "+" : ""}`
            : "Global rankings"
        }
      />

      <div className="flex-1 p-6 max-w-3xl">
        <div className="flex items-center gap-2 mb-6">
          <Trophy className="w-4 h-4 text-gold" />
          <span className="text-xs font-mono text-text-muted tracking-widest">
            GLOBAL RANKINGS
          </span>
        </div>

        {/* Top 3 podium */}
        <div className="flex items-end justify-center gap-3 mb-8">
          {top3.map(({ rank, height }) => {
            const entry = dto.entries[rank - 1];
            if (!entry) return null;
            const color = RANK_COLORS[rank] || "#5a5a7a";
            return (
              <div key={rank} className="flex flex-col items-center gap-2 flex-1">
                <div className="text-xs font-mono text-text-secondary truncate w-full text-center">
                  {entry.name}
                </div>
                <div className="text-xs font-mono text-gold">
                  {formatXP(entry.verifiedXp)} XP
                </div>
                <div
                  className={`${height} w-full rounded-t-lg border flex items-center justify-center`}
                  style={{
                    background: `${color}15`,
                    borderColor: `${color}40`,
                  }}
                >
                  <span
                    className="text-2xl font-bold font-mono"
                    style={{ color }}
                  >
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
            <span className="col-span-1 text-right">Level</span>
          </div>

          {dto.entries.map((entry) => (
            <EntryRow
              key={entry.rank}
              entry={entry}
              isMe={dto.me?.rank === entry.rank}
            />
          ))}

          {/* Viewer outside top 100 — separated row */}
          {dto.me && !dto.me.inTop && (
            <>
              <div className="px-4 py-1 text-xs font-mono text-text-muted bg-noir-700 border-t border-noir-500 border-b border-dashed border-noir-400">
                · · ·
              </div>
              <EntryRow entry={dto.me} isMe={true} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
