import type { Player, PlayerPracticeEntry } from "@/lib/types";

export type CoachReviewStatus = "missing-goal" | "goal-only" | "partial-reflection" | "complete";
export type CoachReviewStatusFilter = CoachReviewStatus | "all" | "needs-attention";

export type CoachReviewClassification = {
  status: CoachReviewStatus;
  hasGoal: boolean;
  hasAnyReflection: boolean;
  isComplete: boolean;
};

export type CoachReviewSummary = {
  activePlayers: number;
  playersWithGoal: number;
  playersWithAnyReflection: number;
  playersComplete: number;
  playersNeedingAttention: number;
};

const millisecondsPerDay = 24 * 60 * 60 * 1000;
const recentPracticeIntervalDays = 7;

function hasText(value?: string): boolean {
  return Boolean(value?.trim());
}

function hasRating(value: PlayerPracticeEntry["offenseReflectionRating"]): boolean {
  return value !== undefined;
}

function getPracticeEntry(player: Player, practiceDate: string): PlayerPracticeEntry | undefined {
  return player.practiceEntries.find((entry) => entry.practiceDate === practiceDate);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function jerseySortValue(jerseyNumber: string): number {
  const parsed = Number.parseInt(jerseyNumber, 10);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export function classifyCoachReviewEntry(entry?: PlayerPracticeEntry): CoachReviewClassification {
  if (!entry) {
    return {
      status: "missing-goal",
      hasGoal: false,
      hasAnyReflection: false,
      isComplete: false,
    };
  }

  const goalSides = [
    { hasGoal: hasText(entry.offenseGoal), hasReflection: hasRating(entry.offenseReflectionRating) },
    { hasGoal: hasText(entry.defenseGoal), hasReflection: hasRating(entry.defenseReflectionRating) },
  ].filter((side) => side.hasGoal);

  const hasGoal = goalSides.length > 0;
  const hasAnyReflection = goalSides.some((side) => side.hasReflection);
  const hasEveryGoalReflection = goalSides.length === 2 && goalSides.every((side) => side.hasReflection);

  if (!hasGoal) {
    return {
      status: "missing-goal",
      hasGoal: false,
      hasAnyReflection: false,
      isComplete: false,
    };
  }

  if (!hasAnyReflection) {
    return {
      status: "goal-only",
      hasGoal,
      hasAnyReflection,
      isComplete: false,
    };
  }

  if (!hasEveryGoalReflection) {
    return {
      status: "partial-reflection",
      hasGoal,
      hasAnyReflection,
      isComplete: false,
    };
  }

  return {
    status: "complete",
    hasGoal,
    hasAnyReflection,
    isComplete: true,
  };
}

export function sortCoachReviewPlayers(players: Player[], linkedPlayerIds: string[]): Player[] {
  const linkedOrder = new Map(linkedPlayerIds.map((id, index) => [id, index]));

  return [...players].sort((left, right) => {
    const leftLinkedOrder = linkedOrder.get(left.id) ?? Number.POSITIVE_INFINITY;
    const rightLinkedOrder = linkedOrder.get(right.id) ?? Number.POSITIVE_INFINITY;

    if (leftLinkedOrder !== rightLinkedOrder) {
      return leftLinkedOrder - rightLinkedOrder;
    }

    const leftJersey = jerseySortValue(left.jerseyNumber);
    const rightJersey = jerseySortValue(right.jerseyNumber);

    if (leftJersey !== rightJersey) {
      return leftJersey - rightJersey;
    }

    return left.name.localeCompare(right.name, "ja");
  });
}

export function buildCoachReviewDateOptions(players: Player[], anchorDate: string, recentCount = 6): string[] {
  const dateOptions = new Set<string>();
  const parsedAnchorDate = parseDate(anchorDate);

  for (let index = 0; index < recentCount; index += 1) {
    dateOptions.add(formatDate(new Date(parsedAnchorDate.getTime() - index * recentPracticeIntervalDays * millisecondsPerDay)));
  }

  for (const player of players) {
    for (const entry of player.practiceEntries) {
      dateOptions.add(entry.practiceDate);
    }
  }

  return [...dateOptions].sort((left, right) => right.localeCompare(left));
}

export function filterCoachReviewPlayers(
  players: Player[],
  searchText: string,
  statusFilter: CoachReviewStatusFilter,
  practiceDate: string,
): Player[] {
  const normalizedSearchText = searchText.trim().toLocaleLowerCase("ja");

  return players.filter((player) => {
    const matchesSearch =
      !normalizedSearchText ||
      player.name.toLocaleLowerCase("ja").includes(normalizedSearchText) ||
      player.jerseyNumber.toLocaleLowerCase("ja").includes(normalizedSearchText);

    if (!matchesSearch) {
      return false;
    }

    const classification = classifyCoachReviewEntry(getPracticeEntry(player, practiceDate));

    if (statusFilter === "all") {
      return true;
    }

    if (statusFilter === "needs-attention") {
      return classification.status !== "complete";
    }

    return classification.status === statusFilter;
  });
}

export function getCoachReviewSummary(players: Player[], practiceDate: string): CoachReviewSummary {
  return players
    .filter((player) => player.active)
    .reduce<CoachReviewSummary>(
      (summary, player) => {
        const classification = classifyCoachReviewEntry(getPracticeEntry(player, practiceDate));

        return {
          activePlayers: summary.activePlayers + 1,
          playersWithGoal: summary.playersWithGoal + (classification.hasGoal ? 1 : 0),
          playersWithAnyReflection: summary.playersWithAnyReflection + (classification.hasAnyReflection ? 1 : 0),
          playersComplete: summary.playersComplete + (classification.isComplete ? 1 : 0),
          playersNeedingAttention: summary.playersNeedingAttention + (classification.isComplete ? 0 : 1),
        };
      },
      {
        activePlayers: 0,
        playersWithGoal: 0,
        playersWithAnyReflection: 0,
        playersComplete: 0,
        playersNeedingAttention: 0,
      },
    );
}
