import { GoalLog, GoalTemplate, Material, Player } from "@/lib/types";

export const players: Player[] = [
  {
    id: "p1",
    name: "あおい",
    gradeLabel: "1ねん",
    gradeBand: "lower",
    active: true,
    guardianName: "佐藤さん",
    favoriteSkill: "はしる",
    recentGoalId: "g1",
  },
  {
    id: "p2",
    name: "はると",
    gradeLabel: "2ねん",
    gradeBand: "lower",
    active: true,
    guardianName: "田中さん",
    favoriteSkill: "キャッチ",
    recentGoalId: "g2",
  },
  {
    id: "p3",
    name: "ゆい",
    gradeLabel: "2ねん",
    gradeBand: "lower",
    active: true,
    guardianName: "山田さん",
    favoriteSkill: "よける",
    recentGoalId: "g4",
  },
  {
    id: "p4",
    name: "そうた",
    gradeLabel: "3ねん",
    gradeBand: "middle",
    active: true,
    guardianName: "井上さん",
    favoriteSkill: "まもる",
    recentGoalId: "g3",
  },
  {
    id: "p5",
    name: "みお",
    gradeLabel: "1ねん",
    gradeBand: "lower",
    active: false,
    guardianName: "中村さん",
    favoriteSkill: "こえだし",
  },
];

export const goalTemplates: GoalTemplate[] = [
  {
    id: "g1",
    title: "こえをだす",
    prompt: "れんしゅうのあいだに 3かい こえをだしてみよう",
    emoji: "📣",
    color: "orange",
  },
  {
    id: "g2",
    title: "ボールをみる",
    prompt: "パスのときに ボールをさいごまで みよう",
    emoji: "👀",
    color: "blue",
  },
  {
    id: "g3",
    title: "はやくうごく",
    prompt: "スタートのあいずで すぐに 1ぽ でよう",
    emoji: "💨",
    color: "green",
  },
  {
    id: "g4",
    title: "はたをとる",
    prompt: "まもりのときに 1かい はたをとりにいこう",
    emoji: "🏈",
    color: "yellow",
  },
];

export const goalLogs: GoalLog[] = [
  {
    id: "l1",
    playerId: "p1",
    goalId: "g1",
    date: "2026-04-14",
    by: "guardian",
  },
  {
    id: "l2",
    playerId: "p2",
    goalId: "g2",
    date: "2026-04-14",
    by: "guardian",
  },
  {
    id: "l3",
    playerId: "p4",
    goalId: "g3",
    date: "2026-04-13",
    note: "コーチがタブレットで補助",
    by: "coach",
  },
];

export const materials: Material[] = [
  {
    id: "m1",
    title: "4月のれんしゅうメニュー",
    description: "Google Slidesで作った今月の練習テーマです。",
    type: "slide",
    audience: "all",
    updatedAt: "2026-04-13",
    url: "https://docs.google.com/presentation/",
  },
  {
    id: "m2",
    title: "試合出欠シート",
    description: "保護者向けの回答用Google Sheetsです。",
    type: "sheet",
    audience: "guardians",
    updatedAt: "2026-04-12",
    url: "https://docs.google.com/spreadsheets/",
  },
  {
    id: "m3",
    title: "コーチ向け指導メモ",
    description: "公開範囲をコーチのみにした資料の例です。",
    type: "doc",
    audience: "coaches",
    updatedAt: "2026-04-10",
    url: "https://docs.google.com/document/",
  },
];
