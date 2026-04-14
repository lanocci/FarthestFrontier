import { goalLogs, goalTemplates, materials, players, positionMasters } from "@/lib/mock-data";
import { GoalLog, GoalTemplate, Material, Player, PositionMaster } from "@/lib/types";
import { findGoalTemplate } from "@/lib/utils";

const KEYS = {
  players: "ff-team-players",
  goalLogs: "ff-team-goal-logs",
  materials: "ff-team-materials",
  positionMasters: "ff-team-position-masters",
  goalTemplates: "ff-team-goal-templates",
} as const;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const value = window.localStorage.getItem(key);

  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function clearStorage() {
  if (typeof window === "undefined") {
    return;
  }

  Object.values(KEYS).forEach((key) => window.localStorage.removeItem(key));
}

function normalizePlayer(player: Player): Player {
  const legacyOffense = (player as Player & { offensePosition?: string }).offensePosition;
  const legacyDefense = (player as Player & { defensePosition?: string }).defensePosition;
  const legacyRecentGoal = (player as Player & { recentGoalText?: string }).recentGoalText;
  const legacyJerseyNumber = (player as Player & { number?: string | number }).number;
  const legacyOffenseReflection = (player as Player & { offenseReflection?: string }).offenseReflection;
  const legacyDefenseReflection = (player as Player & { defenseReflection?: string }).defenseReflection;
  const offenseMap: Record<string, string> = {
    center: "op-center",
    quarterback: "op-quarterback",
    runner: "op-runner",
    receiver: "op-receiver",
    flex: "op-flex",
  };
  const defenseMap: Record<string, string> = {
    rusher: "dp-rusher",
    linebacker: "dp-linebacker",
    cornerback: "dp-cornerback",
    safety: "dp-safety",
    "flag-keeper": "dp-flag-keeper",
  };

  return {
    ...player,
    jerseyNumber: player.jerseyNumber ?? String(legacyJerseyNumber ?? ""),
    offensePositionId: player.offensePositionId ?? offenseMap[legacyOffense ?? ""] ?? "op-flex",
    defensePositionId: player.defensePositionId ?? defenseMap[legacyDefense ?? ""] ?? "dp-linebacker",
    gradeLabel: player.gradeLabel ?? "未設定",
    offenseGoal: player.offenseGoal ?? legacyRecentGoal,
    defenseGoal: player.defenseGoal,
    offenseReflectionComment: player.offenseReflectionComment ?? legacyOffenseReflection,
    defenseReflectionComment: player.defenseReflectionComment ?? legacyDefenseReflection,
  };
}

function normalizeGoalLog(log: GoalLog): GoalLog {
  const legacyGoalId = (log as GoalLog & { goalId?: string }).goalId;
  const legacyTemplate = findGoalTemplate(log.goalTemplateId ?? legacyGoalId, goalTemplates);

  return {
    ...log,
    goalTemplateId: log.goalTemplateId ?? legacyGoalId,
    goalText: log.goalText ?? legacyTemplate?.title ?? log.note ?? "目標を登録",
  };
}

export function loadPlayers(): Player[] {
  return readJson(KEYS.players, players).map(normalizePlayer);
}

export function savePlayers(nextPlayers: Player[]) {
  writeJson(KEYS.players, nextPlayers);
}

export function loadGoalLogs(): GoalLog[] {
  return readJson(KEYS.goalLogs, goalLogs).map(normalizeGoalLog);
}

export function saveGoalLogs(nextLogs: GoalLog[]) {
  writeJson(KEYS.goalLogs, nextLogs);
}

export function loadMaterials(): Material[] {
  return readJson(KEYS.materials, materials);
}

export function saveMaterials(nextMaterials: Material[]) {
  writeJson(KEYS.materials, nextMaterials);
}

export function loadPositionMasters(): PositionMaster[] {
  return readJson(KEYS.positionMasters, positionMasters);
}

export function savePositionMasters(nextPositions: PositionMaster[]) {
  writeJson(KEYS.positionMasters, nextPositions);
}

export function loadGoalTemplates(): GoalTemplate[] {
  return readJson(KEYS.goalTemplates, goalTemplates);
}

export function saveGoalTemplates(nextTemplates: GoalTemplate[]) {
  writeJson(KEYS.goalTemplates, nextTemplates);
}
