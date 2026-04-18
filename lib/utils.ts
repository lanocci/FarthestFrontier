import { goalLogs, goalTemplates, materials, players, positionMasters } from "@/lib/mock-data";
import { GoalTemplate, Material, MaterialAudience, Player, PlayerPracticeEntry, PositionMaster, PositionSide, ReflectionRating, TeamRole } from "@/lib/types";

const reflectionEmojiMap: Record<ReflectionRating, string> = {
  5: "🏆",
  4: "🌟",
  3: "👏",
  2: "🙂",
  1: "🌱",
};

export function getReflectionEmoji(rating?: ReflectionRating): string | undefined {
  if (!rating) return undefined;
  return reflectionEmojiMap[rating];
}

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
  return formatAudienceLabel(material.audience);
}

export function formatAudienceLabel(audience: MaterialAudience): string {
  switch (audience) {
    case "all":
      return "チーム全体";
    case "guardians":
      return "保護者のみ";
    case "coaches":
      return "コーチのみ";
    default:
      return audience;
  }
}

export function filterAudiencesForRole<T extends { audience: MaterialAudience }>(items: T[], role: TeamRole | null): T[] {
  if (role === "coach" || role === null) {
    return items;
  }

  return items.filter((item) => item.audience !== "coaches");
}

export function filterMaterialsForRole(materialsList: Material[], role: TeamRole | null): Material[] {
  return filterAudiencesForRole(materialsList, role);
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

export function parseYouTubeVideoId(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);

    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (url.hostname.includes("youtube.com")) {
      const watchId = url.searchParams.get("v");
      if (watchId && /^[a-zA-Z0-9_-]{11}$/.test(watchId)) {
        return watchId;
      }

      const segments = url.pathname.split("/").filter(Boolean);
      const embedId = segments.at(-1);
      return embedId && /^[a-zA-Z0-9_-]{11}$/.test(embedId) ? embedId : null;
    }
  } catch {
    return null;
  }

  return null;
}

export function formatSecondsAsTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
