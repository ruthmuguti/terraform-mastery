"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PlayerProfile, PlayerStats } from "./types";
import type { Provider } from "./providers";
import { getLevelInfo } from "./types";
import { BADGES, getBadge } from "@/data/badges";
import { MISSIONS } from "@/data/missions";

interface GameStore {
  profile: PlayerProfile | null;
  missionProgress: Record<string, MissionProgress>;

  // Actions
  initProfile: (username: string, provider?: Provider) => void;
  setProvider: (provider: Provider) => void;
  completeMission: (missionId: string, xpReward: number, badgeId?: string) => CompletionResult;
  unlockBadge: (badgeId: string) => void;
  updateMissionProgress: (missionId: string, progress: Partial<MissionProgress>) => void;
  incrementStats: (updates: Partial<PlayerStats>) => void;
  resetProgress: () => void;
}

export interface MissionProgress {
  missionId: string;
  status: "available" | "in_progress" | "completed";
  startedAt?: number;
  completedAt?: number;
  hintsUsed: number;
  commandCount: number;
  completedObjectives: string[];
}

interface CompletionResult {
  leveledUp: boolean;
  newBadge: boolean;
  xpGained: number;
  newLevel?: number;
  newTitle?: string;
}

const INITIAL_AVAILABLE = ["mission-01"];

function createDefaultProfile(username: string, provider: Provider = "aws"): PlayerProfile {
  return {
    username,
    xp: 0,
    level: 1,
    provider,
    completedMissions: [],
    unlockedBadges: [],
    joinedAt: Date.now(),
    lastActiveAt: Date.now(),
    stats: {
      totalCommands: 0,
      terraformApplies: 0,
      hintsUsed: 0,
      missionsAttempted: 0,
      streakDays: 1,
    },
  };
}

function createDefaultMissionProgress(): Record<string, MissionProgress> {
  const progress: Record<string, MissionProgress> = {};
  INITIAL_AVAILABLE.forEach((id) => {
    progress[id] = { missionId: id, status: "available", hintsUsed: 0, commandCount: 0, completedObjectives: [] };
  });
  return progress;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      profile: null,
      missionProgress: createDefaultMissionProgress(),

      initProfile: (username, provider = "aws") => {
        const { profile } = get();
        if (profile) return;
        set({
          profile: createDefaultProfile(username, provider),
          missionProgress: createDefaultMissionProgress(),
        });
      },

      setProvider: (provider) => {
        const { profile } = get();
        if (!profile) return;
        set({ profile: { ...profile, provider } });
      },

      completeMission: (missionId, xpReward, badgeId) => {
        const { profile, missionProgress } = get();
        if (!profile) return { leveledUp: false, newBadge: false, xpGained: 0 };

        const alreadyDone = profile.completedMissions.includes(missionId);
        if (alreadyDone) return { leveledUp: false, newBadge: false, xpGained: 0 };

        const badge = badgeId ? getBadge(badgeId) : undefined;
        const totalXp = xpReward + (badge?.xpBonus ?? 0);

        const { currentLevel } = getLevelInfo(profile.xp);
        const newXp = profile.xp + totalXp;
        const { currentLevel: newCurrentLevel } = getLevelInfo(newXp);
        const leveledUp = newCurrentLevel.level > currentLevel.level;

        const newBadges = badge && !profile.unlockedBadges.includes(badge.id)
          ? [...profile.unlockedBadges, badge.id]
          : profile.unlockedBadges;

        // Unlock next missions
        const completedMission = MISSIONS.find((m) => m.id === missionId);
        const newProgress: Record<string, MissionProgress> = {
          ...missionProgress,
          [missionId]: {
            ...missionProgress[missionId],
            status: "completed",
            completedAt: Date.now(),
          },
        };

        if (completedMission?.unlocks) {
          for (const unlockId of completedMission.unlocks) {
            if (!newProgress[unlockId]) {
              newProgress[unlockId] = {
                missionId: unlockId,
                status: "available",
                hintsUsed: 0,
                commandCount: 0,
                completedObjectives: [],
              };
            }
          }
        }

        set({
          profile: {
            ...profile,
            xp: newXp,
            level: newCurrentLevel.level,
            completedMissions: [...profile.completedMissions, missionId],
            unlockedBadges: newBadges,
            lastActiveAt: Date.now(),
            stats: {
              ...profile.stats,
              terraformApplies: profile.stats.terraformApplies + 1,
            },
          },
          missionProgress: newProgress,
        });

        return {
          leveledUp,
          newBadge: !!badge,
          xpGained: totalXp,
          newLevel: leveledUp ? newCurrentLevel.level : undefined,
          newTitle: leveledUp ? newCurrentLevel.title : undefined,
        };
      },

      unlockBadge: (badgeId) => {
        const { profile } = get();
        if (!profile || profile.unlockedBadges.includes(badgeId)) return;
        set({ profile: { ...profile, unlockedBadges: [...profile.unlockedBadges, badgeId] } });
      },

      updateMissionProgress: (missionId, progress) => {
        const { missionProgress } = get();
        set({
          missionProgress: {
            ...missionProgress,
            [missionId]: { ...missionProgress[missionId], ...progress },
          },
        });
      },

      incrementStats: (updates) => {
        const { profile } = get();
        if (!profile) return;
        set({
          profile: {
            ...profile,
            stats: { ...profile.stats, ...Object.fromEntries(
              Object.entries(updates).map(([k, v]) => [k, (profile.stats[k as keyof PlayerStats] as number) + (v as number)])
            )},
            lastActiveAt: Date.now(),
          },
        });
      },

      resetProgress: () => {
        set({ profile: null, missionProgress: createDefaultMissionProgress() });
      },
    }),
    {
      name: "terraform-mastery-game",
      version: 1,
    }
  )
);
