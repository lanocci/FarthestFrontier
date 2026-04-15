export type Role = "coach" | "guardian";
export type TeamRole = Role;
export type MembershipStatus = "pending" | "approved" | "rejected";
export type MaterialType = "slide" | "sheet" | "doc";
export type MaterialAudience = "all" | "guardians" | "coaches";
export type PositionSide = "offense" | "defense";
export type ReflectionRating = 1 | 2 | 3 | 4 | 5;

export type PositionMaster = {
  id: string;
  label: string;
  side: PositionSide;
};

export type PlayerPracticeEntry = {
  practiceDate: string;
  offenseGoal?: string;
  defenseGoal?: string;
  offenseReflectionRating?: ReflectionRating;
  offenseReflectionComment?: string;
  defenseReflectionRating?: ReflectionRating;
  defenseReflectionComment?: string;
};

export type Player = {
  id: string;
  name: string;
  jerseyNumber: string;
  gradeLabel: string;
  active: boolean;
  guardianName: string;
  favoriteSkill: string;
  offensePositionIds: string[];
  defensePositionIds: string[];
  practiceEntries: PlayerPracticeEntry[];
  offenseGoal?: string;
  defenseGoal?: string;
  offenseReflectionRating?: ReflectionRating;
  offenseReflectionComment?: string;
  defenseReflectionRating?: ReflectionRating;
  defenseReflectionComment?: string;
};

export type GoalTemplate = {
  id: string;
  side: PositionSide;
  title: string;
  prompt: string;
  emoji: string;
  color: "orange" | "green" | "blue" | "yellow";
  templateText: string;
  inputPlaceholder?: string;
};

export type GoalLog = {
  id: string;
  playerId: string;
  goalText: string;
  goalTemplateId?: string;
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

export type TeamMember = {
  userId: string;
  email?: string;
  role: TeamRole;
  status: MembershipStatus;
  playerIds: string[];
  registrationMessage?: string;
};
