import { goalLogs, goalTemplates, materials, players, positionMasters } from "@/lib/mock-data";
import { GoalTemplate, Material, Player, PositionMaster, PositionSide } from "@/lib/types";

export function getRecentGoalForPlayer(player: Player): string | undefined {
  return player.offenseGoal ?? player.defenseGoal;
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
