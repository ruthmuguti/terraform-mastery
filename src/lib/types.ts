import type { Provider } from "./providers";

export type MissionStatus = "locked" | "available" | "in_progress" | "completed";
export type DifficultyLevel = "rookie" | "specialist" | "expert" | "master";

export interface MissionObjective {
  id: string;
  description: string;
  /** Progressive hints revealed one at a time. Index 0 = gentle nudge, last = near-answer. */
  hints: string[];
  check: (state: SimulatorState, hcl: string, commandHistory: string[], provider: Provider) => boolean;
}

export interface Mission {
  id: string;
  operationCode: string;
  title: string;
  description: string;
  briefing: string;
  difficulty: DifficultyLevel;
  xpReward: number;
  badgeId?: string;
  chapter: number;
  order: number;
  estimatedMinutes: number;
  tags: string[];
  /** Provider-specific starter code. Falls back to "aws" if the selected provider isn't defined. */
  starterCodes: Record<Provider, string>;
  objectives: MissionObjective[];
  concepts: string[];
  unlocks?: string[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  xpBonus: number;
  unlockedAt?: number;
}

export interface SimulatorState {
  initialized: boolean;
  validated: boolean;
  planned: boolean;
  applied: boolean;
  destroyed: boolean;
  appliedResources: AppliedResource[];
  planResources: PlannedResource[];
  outputs: Record<string, string>;
  variables: Record<string, string>;
  workingDir: string;
  providerInstalled: boolean;
  lastCommand?: string;
  /** Current workspace name — defaults to "default" */
  workspace: string;
  /** All workspace names that have been created */
  workspaces: string[];
}

export interface AppliedResource {
  type: string;
  name: string;
  id: string;
  attributes: Record<string, string>;
}

export interface PlannedResource {
  type: string;
  name: string;
  action: "create" | "update" | "destroy" | "no-change";
  attributes: Record<string, string>;
}

export interface ParsedHCL {
  providers: HCLBlock[];
  resources: HCLResourceBlock[];
  variables: HCLVariableBlock[];
  outputs: HCLOutputBlock[];
  locals: HCLLocalsBlock[];
  modules: HCLModuleBlock[];
  data: HCLDataBlock[];
  valid: boolean;
  errors: string[];
}

export interface HCLBlock {
  type: string;
  labels: string[];
  attributes: Record<string, string>;
}

export interface HCLResourceBlock extends HCLBlock {
  resourceType: string;
  resourceName: string;
}

export interface HCLVariableBlock {
  name: string;
  type?: string;
  default?: string;
  description?: string;
}

export interface HCLOutputBlock {
  name: string;
  value: string;
  description?: string;
}

export interface HCLLocalsBlock {
  assignments: Record<string, string>;
}

export interface HCLModuleBlock {
  name: string;
  source: string;
  inputs: Record<string, string>;
}

export interface HCLDataBlock {
  dataType: string;
  dataName: string;
  attributes: Record<string, string>;
}

export interface PlayerProfile {
  username: string;
  xp: number;
  level: number;
  provider: Provider;
  completedMissions: string[];
  unlockedBadges: string[];
  currentMission?: string;
  joinedAt: number;
  lastActiveAt: number;
  stats: PlayerStats;
  /** True once the first-run guided tour has been seen or skipped. */
  hasSeenTour?: boolean;
}

export interface PlayerStats {
  totalCommands: number;
  terraformApplies: number;
  hintsUsed: number;
  missionsAttempted: number;
  streakDays: number;
}

export const LEVEL_THRESHOLDS = [
  { level: 1, xp: 0, title: "Terraform Rookie", color: "#9898c8" },
  { level: 2, xp: 200, title: "Config Scribe", color: "#9898c8" },
  { level: 3, xp: 500, title: "Provider Agent", color: "#00c8ff" },
  { level: 4, xp: 900, title: "Resource Wrangler", color: "#00c8ff" },
  { level: 5, xp: 1400, title: "State Operator", color: "#00ff9f" },
  { level: 6, xp: 2100, title: "Module Architect", color: "#00ff9f" },
  { level: 7, xp: 3000, title: "Pipeline Engineer", color: "#7c5df9" },
  { level: 8, xp: 4200, title: "Cloud Strategist", color: "#7c5df9" },
  { level: 9, xp: 5800, title: "IaC Specialist", color: "#c9a227" },
  { level: 10, xp: 8000, title: "IaC Architect", color: "#c9a227" },
] as const;

type LevelEntry = { level: number; xp: number; title: string; color: string };

export function getLevelInfo(xp: number): { currentLevel: LevelEntry; nextLevel: LevelEntry; progress: number } {
  const levels: LevelEntry[] = LEVEL_THRESHOLDS.map((l) => ({ ...l }));
  let currentLevel = levels[0];
  let nextLevel = levels[1];
  for (let i = levels.length - 1; i >= 0; i--) {
    if (xp >= levels[i].xp) {
      currentLevel = levels[i];
      nextLevel = levels[Math.min(i + 1, levels.length - 1)];
      break;
    }
  }
  const progress = nextLevel.xp > currentLevel.xp
    ? ((xp - currentLevel.xp) / (nextLevel.xp - currentLevel.xp)) * 100
    : 100;
  return { currentLevel, nextLevel, progress: Math.min(progress, 100) };
}
