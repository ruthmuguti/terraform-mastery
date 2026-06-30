"use client";

import type { Badge } from "@/lib/types";
import { RARITY_COLORS, RARITY_LABELS } from "@/data/badges";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";

interface BadgeCardProps {
  badge: Badge;
  unlocked: boolean;
  size?: "sm" | "md" | "lg";
}

export function BadgeCard({ badge, unlocked, size = "md" }: BadgeCardProps) {
  const rarityColor = RARITY_COLORS[badge.rarity];

  return (
    <div
      className={cn(
        "relative rounded-lg border text-center transition-all duration-200",
        size === "sm" ? "p-3" : size === "lg" ? "p-6" : "p-4",
        unlocked
          ? "border-opacity-30 bg-noir-700 hover:scale-105"
          : "border-noir-500 bg-noir-800 opacity-50 grayscale"
      )}
      style={unlocked ? { borderColor: `${rarityColor}40` } : {}}
    >
      {/* Rarity glow */}
      {unlocked && (
        <div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{ boxShadow: `inset 0 0 20px ${rarityColor}08` }}
        />
      )}

      {/* Icon */}
      <div
        className={cn(
          "mx-auto rounded-full flex items-center justify-center mb-2",
          size === "sm" ? "w-10 h-10 text-xl" : size === "lg" ? "w-16 h-16 text-3xl" : "w-12 h-12 text-2xl"
        )}
        style={
          unlocked
            ? { background: `${rarityColor}15`, border: `1px solid ${rarityColor}30` }
            : { background: "rgba(30,30,56,0.5)", border: "1px solid rgba(30,30,56,0.8)" }
        }
      >
        {unlocked ? badge.icon : <Lock className="w-4 h-4 text-text-muted" />}
      </div>

      {/* Name */}
      <div
        className={cn("font-mono font-bold", size === "sm" ? "text-xs" : "text-sm")}
        style={{ color: unlocked ? rarityColor : "#5a5a7a" }}
      >
        {badge.name}
      </div>

      {/* Rarity */}
      <div className="text-xs text-text-muted font-mono mt-0.5">{RARITY_LABELS[badge.rarity]}</div>

      {/* Description (md/lg only) */}
      {size !== "sm" && (
        <div className="text-xs text-text-secondary mt-2 leading-relaxed">{badge.description}</div>
      )}

      {/* XP Bonus */}
      {unlocked && badge.xpBonus > 0 && size !== "sm" && (
        <div className="mt-2 text-xs font-mono text-gold">+{badge.xpBonus} XP bonus</div>
      )}
    </div>
  );
}
