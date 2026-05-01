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
  playersPresent: number;
  playersAbsent: number;
  playersAttendanceUnmarked: number;
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

function hasBothGoals(entry?: PlayerPracticeEntry): boolean {
  return hasText(entry?.offenseGoal) && hasText(entry?.defenseGoal);
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

function jerseySortValue(jerseyNumber: string): { hasNumber: boolean; number: number } {
  const parsed = Number(jerseyNumber);

  return {
    hasNumber: Number.isFinite(parsed) && jerseyNumber !== "",
    number: parsed,
  };
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

function attendanceSortValue(entry?: PlayerPracticeEntry): number {
  if (entry?.attendanceStatus === "present") return 0;
  if (entry?.attendanceStatus === "absent") return 2;
  return 1;
}

export function sortCoachReviewPlayers(players: Player[], linkedPlayerIds: string[], practiceDate?: string): Player[] {
  return [...players].sort((left, right) => {
    const leftEntry = practiceDate ? getPracticeEntry(left, practiceDate) : undefined;
    const rightEntry = practiceDate ? getPracticeEntry(right, practiceDate) : undefined;

    if (practiceDate) {
      const leftAttendance = attendanceSortValue(leftEntry);
      const rightAttendance = attendanceSortValue(rightEntry);

      if (leftAttendance !== rightAttendance) {
        return leftAttendance - rightAttendance;
      }

      const leftHasGoal = classifyCoachReviewEntry(leftEntry).hasGoal ? 1 : 0;
      const rightHasGoal = classifyCoachReviewEntry(rightEntry).hasGoal ? 1 : 0;

      if (leftHasGoal !== rightHasGoal) {
        return rightHasGoal - leftHasGoal;
      }
    }

    const leftLinked = linkedPlayerIds.includes(left.id) ? 1 : 0;
    const rightLinked = linkedPlayerIds.includes(right.id) ? 1 : 0;

    if (leftLinked !== rightLinked) {
      return rightLinked - leftLinked;
    }

    const leftJersey = jerseySortValue(left.jerseyNumber);
    const rightJersey = jerseySortValue(right.jerseyNumber);

    if (leftJersey.hasNumber && rightJersey.hasNumber && leftJersey.number !== rightJersey.number) {
      return leftJersey.number - rightJersey.number;
    }

    if (leftJersey.hasNumber !== rightJersey.hasNumber) {
      return leftJersey.hasNumber ? -1 : 1;
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

    const entry = getPracticeEntry(player, practiceDate);

    if (statusFilter !== "all" && !player.active) {
      return false;
    }

    if (entry?.attendanceStatus === "absent") {
      return statusFilter === "all";
    }

    const classification = classifyCoachReviewEntry(entry);

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
        const entry = getPracticeEntry(player, practiceDate);
        const classification = classifyCoachReviewEntry(entry);

        const isAbsent = entry?.attendanceStatus === "absent";

        return {
          activePlayers: summary.activePlayers + (isAbsent ? 0 : 1),
          playersPresent: summary.playersPresent + (entry?.attendanceStatus === "present" ? 1 : 0),
          playersAbsent: summary.playersAbsent + (entry?.attendanceStatus === "absent" ? 1 : 0),
          playersAttendanceUnmarked: summary.playersAttendanceUnmarked + (entry?.attendanceStatus ? 0 : 1),
          playersWithGoal: summary.playersWithGoal + (!isAbsent && hasBothGoals(entry) ? 1 : 0),
          playersWithAnyReflection: summary.playersWithAnyReflection + (!isAbsent && classification.isComplete ? 1 : 0),
          playersComplete: summary.playersComplete + (!isAbsent && classification.isComplete ? 1 : 0),
          playersNeedingAttention: summary.playersNeedingAttention + (!isAbsent && !classification.isComplete ? 1 : 0),
        };
      },
      {
        activePlayers: 0,
        playersPresent: 0,
        playersAbsent: 0,
        playersAttendanceUnmarked: 0,
        playersWithGoal: 0,
        playersWithAnyReflection: 0,
        playersComplete: 0,
        playersNeedingAttention: 0,
      },
    );
}
