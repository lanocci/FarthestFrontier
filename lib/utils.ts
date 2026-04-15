import { goalLogs, goalTemplates, materials, players, positionMasters } from "@/lib/mock-data";
import { GoalTemplate, Material, Player, PlayerPracticeEntry, PositionMaster, PositionSide, TeamRole } from "@/lib/types";

export function getRecentGoalForPlayer(player: Player): string | undefined {
  return player.offenseGoal ?? player.defenseGoal;
}

export function getPracticeEntry(player: Player, practiceDate: string): PlayerPracticeEntry | undefined {
  return player.practiceEntries.find((entry) => entry.practiceDate === practiceDate);
}

export function upsertPracticeEntryForPlayer(player: Player, nextEntry: PlayerPracticeEntry): Player {
  const currentEntries = player.practiceEntries ?? [];
  const hasEntry = currentEntries.some((entry) => entry.practiceDate === nextEntry.practiceDate);
  const practiceEntries = hasEntry
    ? currentEntries.map((entry) => (entry.practiceDate === nextEntry.practiceDate ? nextEntry : entry))
    : [nextEntry, ...currentEntries].sort((left, right) => right.practiceDate.localeCompare(left.practiceDate));

  return {
    ...player,
    practiceEntries,
    offenseGoal: nextEntry.offenseGoal,
    defenseGoal: nextEntry.defenseGoal,
    offenseReflectionRating: nextEntry.offenseReflectionRating,
    offenseReflectionComment: nextEntry.offenseReflectionComment,
    defenseReflectionRating: nextEntry.defenseReflectionRating,
    defenseReflectionComment: nextEntry.defenseReflectionComment,
  };
}

export function countActivePlayers(): number {
  return players.filter((player) => player.active).length;
}

export function countGoalsSubmittedToday(today: string): number {
  return goalLogs.filter((log) => log.date === today).length;
}

export function countSharedMaterials(): number {
  return materials.length;
}

export function formatMaterialType(material: Material): string {
  switch (material.type) {
    case "slide":
      return "Google Slides";
    case "sheet":
      return "Google Sheets";
    case "doc":
      return "Google Docs";
    default:
      return material.type;
  }
}

export function formatAudience(material: Material): string {
  switch (material.audience) {
    case "all":
      return "チーム全体";
    case "guardians":
      return "保護者のみ";
    case "coaches":
      return "コーチのみ";
    default:
      return material.audience;
  }
}

export function filterMaterialsForRole(materialsList: Material[], role: TeamRole | null): Material[] {
  if (role === "coach" || role === null) {
    return materialsList;
  }

  return materialsList.filter((material) => material.audience !== "coaches");
}

export function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function getPositionLabel(positionId: string, masters: PositionMaster[] = positionMasters): string {
  return masters.find((position) => position.id === positionId)?.label ?? "未設定";
}

export function getPositionLabels(positionIds: string[], masters: PositionMaster[] = positionMasters): string {
  if (!positionIds.length) {
    return "未設定";
  }

  return positionIds.map((positionId) => getPositionLabel(positionId, masters)).join(" / ");
}

export function getPositionsBySide(
  side: PositionSide,
  masters: PositionMaster[] = positionMasters,
): PositionMaster[] {
  return masters.filter((position) => position.side === side);
}

export function buildGoalText(template: GoalTemplate, input: string): string {
  const trimmed = input.trim();

  if (template.templateText.includes("{input}")) {
    return template.templateText.replace("{input}", trimmed || template.inputPlaceholder || "");
  }

  return template.templateText;
}

export function formatGoalTemplatePreview(template: GoalTemplate, input: string): string {
  return buildGoalText(template, input).trim();
}

export function findGoalTemplate(goalTemplateId?: string, templates: GoalTemplate[] = goalTemplates) {
  if (!goalTemplateId) {
    return undefined;
  }

  return templates.find((template) => template.id === goalTemplateId);
}
