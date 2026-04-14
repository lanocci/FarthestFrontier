import { goalLogs, goalTemplates, materials, players } from "@/lib/mock-data";
import { GoalTemplate, Material, Player } from "@/lib/types";

export function getRecentGoalForPlayer(player: Player): GoalTemplate | undefined {
  if (!player.recentGoalId) {
    return undefined;
  }

  return goalTemplates.find((goal) => goal.id === player.recentGoalId);
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
