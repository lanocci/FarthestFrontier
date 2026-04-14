export type Role = "coach" | "guardian";
export type GradeBand = "lower" | "middle" | "upper";
export type MaterialType = "slide" | "sheet" | "doc";
export type MaterialAudience = "all" | "guardians" | "coaches";

export type Player = {
  id: string;
  name: string;
  gradeLabel: string;
  gradeBand: GradeBand;
  active: boolean;
  guardianName: string;
  favoriteSkill: string;
  recentGoalId?: string;
};

export type GoalTemplate = {
  id: string;
  title: string;
  prompt: string;
  emoji: string;
  color: "orange" | "green" | "blue" | "yellow";
};

export type GoalLog = {
  id: string;
  playerId: string;
  goalId: string;
  date: string;
  note?: string;
  by: Role;
};

export type Material = {
  id: string;
  title: string;
  description: string;
  type: MaterialType;
  audience: MaterialAudience;
  updatedAt: string;
  url: string;
};
