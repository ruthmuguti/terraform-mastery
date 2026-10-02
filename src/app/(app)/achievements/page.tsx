"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store";
import { BADGES, RARITY_LABELS, RARITY_COLORS } from "@/data/badges";
import { TopBar } from "@/components/layout/TopBar";
import { BadgeCard } from "@/components/achievements/BadgeCard";
import type { Badge } from "@/lib/types";

const RARITY_ORDER: Badge["rarity"][] = ["legendary", "epic", "rare", "common"];

export default function AchievementsPage() {
  const router = useRouter();
  const profile = useGameStore((s) => s.profile);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && !profile) router.replace("/");
  }, [profile, mounted, router]);

  if (!mounted || !profile) return null;

  const unlockedSet = new Set(profile.unlockedBadges);
  const unlockedCount = unlockedSet.size;
  const totalXpBonus = BADGES.filter((b) => unlockedSet.has(b.id)).reduce((sum, b) => sum + b.xpBonus, 0);

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-y-auto">
      <TopBar
        title="Achievements"
        subtitle={`${unlockedCount} of ${BADGES.length} badges unlocked`}
      />

      <div className="flex-1 p-6 max-w-5xl">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: "Unlocked", value: unlockedCount, total: BADGES.length, color: "#00ff9f" },
            { label: "Locked", value: BADGES.length - unlockedCount, total: BADGES.length, color: "#5a5a7a" },
            { label: "XP Bonus", value: `+${totalXpBonus}`, color: "#c9a227" },
          ].map(({ label, value, total, color }) => (
            <div key={label} className="bg-noir-800 border border-noir-500 rounded-lg p-4 text-center">
              <div className="text-xl font-bold font-mono mb-1" style={{ color }}>
                {value}{total !== undefined ? <span className="text-sm text-text-muted">/{total}</span> : ""}
              </div>
              <div className="text-xs font-mono text-text-muted">{label}</div>
            </div>
          ))}
        </div>

        {/* Badges by rarity */}
        {RARITY_ORDER.map((rarity) => {
          const badgesInRarity = BADGES.filter((b) => b.rarity === rarity);
          return (
            <div key={rarity} className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="text-xs font-mono font-bold px-2 py-0.5 rounded border"
                  style={{
                    color: RARITY_COLORS[rarity],
                    borderColor: `${RARITY_COLORS[rarity]}40`,
                    background: `${RARITY_COLORS[rarity]}10`,
                  }}
                >
                  {RARITY_LABELS[rarity].toUpperCase()}
                </div>
                <div className="flex-1 h-px bg-noir-500" />
                <span className="text-xs font-mono text-text-muted">
                  {badgesInRarity.filter((b) => unlockedSet.has(b.id)).length}/{badgesInRarity.length}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {badgesInRarity.map((badge) => (
                  <BadgeCard
                    key={badge.id}
                    badge={badge}
                    unlocked={unlockedSet.has(badge.id)}
                    size="md"
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
