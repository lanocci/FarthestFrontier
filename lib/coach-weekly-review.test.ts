import {
  buildCoachReviewDateOptions,
  classifyCoachReviewEntry,
  filterCoachReviewPlayers,
  getCoachReviewSummary,
  sortCoachReviewPlayers,
} from "./coach-weekly-review.js";
import type { Player } from "@/lib/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const players: Player[] = [
  {
    id: "p2",
    name: "佐藤 杏",
    jerseyNumber: "12",
    gradeLabel: "4年",
    active: true,
    guardianName: "佐藤",
    favoriteSkill: "キャッチ",
    offensePositionIds: ["wr"],
    defensePositionIds: ["s"],
    practiceEntries: [
      {
        practiceDate: "2026-05-02",
        attendanceStatus: "present",
        offenseGoal: "声を3回出す",
        offenseReflectionRating: 5,
        offenseReflectionComment: "よく声が出た",
      },
    ],
  },
  {
    id: "p1",
    name: "高橋 蓮",
    jerseyNumber: "7",
    gradeLabel: "5年",
    active: true,
    guardianName: "高橋",
    favoriteSkill: "ラン",
    offensePositionIds: ["qb"],
    defensePositionIds: ["db"],
    practiceEntries: [
      {
        practiceDate: "2026-05-02",
        attendanceStatus: "absent",
        offenseGoal: "最初の1歩を速く出す",
        defenseGoal: "相手の腰を見る",
        offenseReflectionRating: 4,
        defenseReflectionRating: 3,
        defenseReflectionComment: "途中で見失った",
      },
      {
        practiceDate: "2026-04-25",
        defenseGoal: "横に流れすぎない",
      },
    ],
  },
  {
    id: "p3",
    name: "山田 海",
    jerseyNumber: "",
    gradeLabel: "3年",
    active: false,
    guardianName: "山田",
    favoriteSkill: "フラッグ",
    offensePositionIds: [],
    defensePositionIds: [],
    practiceEntries: [],
  },
];

const sorted = sortCoachReviewPlayers(players, ["p2"]);
assert(sorted.map((player) => player.id).join(",") === "p2,p1,p3", `Unexpected sort order: ${sorted.map((player) => player.id).join(",")}`);

const sortedLinkedPlayersByJersey = sortCoachReviewPlayers(players, ["p2", "p1"]);
assert(
  sortedLinkedPlayersByJersey.map((player) => player.id).join(",") === "p1,p2,p3",
  `Linked players should sort by jersey number, got ${sortedLinkedPlayersByJersey.map((player) => player.id).join(",")}`,
);

const dateOptions = buildCoachReviewDateOptions(players, "2026-05-02", 2);
assert(dateOptions.includes("2026-05-02"), "Date options should include anchor date");
assert(dateOptions.includes("2026-04-25"), "Date options should include practice entry date");
assert(dateOptions[0] === "2026-05-02", `Newest date should be first, got ${dateOptions[0]}`);

assert(classifyCoachReviewEntry(players[0].practiceEntries[0]).status === "partial-reflection", "Single-side reflection should be partial");
assert(classifyCoachReviewEntry(players[1].practiceEntries[0]).status === "complete", "Both sides reflected should be complete");
assert(classifyCoachReviewEntry(undefined).status === "missing-goal", "Missing entry should be missing-goal");

const summary = getCoachReviewSummary(players, "2026-05-02");
assert(summary.activePlayers === 2, `Expected 2 active players, got ${summary.activePlayers}`);
assert(summary.playersWithGoal === 2, `Expected 2 players with goals, got ${summary.playersWithGoal}`);
assert(summary.playersWithAnyReflection === 2, `Expected 2 players with reflection, got ${summary.playersWithAnyReflection}`);
assert(summary.playersComplete === 1, `Expected 1 complete player, got ${summary.playersComplete}`);
assert(summary.playersNeedingAttention === 1, `Expected 1 attention player, got ${summary.playersNeedingAttention}`);
assert(summary.playersPresent === 1, `Expected 1 present player, got ${summary.playersPresent}`);
assert(summary.playersAbsent === 1, `Expected 1 absent player, got ${summary.playersAbsent}`);
assert(summary.playersAttendanceUnmarked === 0, `Expected 0 unmarked attendance players, got ${summary.playersAttendanceUnmarked}`);

const filteredByName = filterCoachReviewPlayers(players, "高橋", "all", "2026-05-02");
assert(filteredByName.length === 1 && filteredByName[0].id === "p1", "Name filter should return 高橋");

const filteredByStatus = filterCoachReviewPlayers(players, "", "partial-reflection", "2026-05-02");
assert(filteredByStatus.length === 1 && filteredByStatus[0].id === "p2", "Status filter should return partial reflection player");
