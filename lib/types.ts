export type Role = "coach" | "guardian";
export type TeamRole = Role;
export type MembershipStatus = "pending" | "approved" | "rejected";
export type MaterialType = "slide" | "sheet" | "doc";
export type MaterialAudience = "all" | "guardians" | "coaches";
export type VideoAudience = MaterialAudience;
export type PositionSide = "offense" | "defense";
export type ReflectionRating = 1 | 2 | 3 | 4 | 5;

export type PositionMaster = {
  id: string;
  label: string;
  side: PositionSide;
};

export type VideoTagMaster = {
  id: string;
  label: string;
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

export type VideoClipPlayerLink = {
  playerId: string;
  positionId?: string;
};

export type VideoClip = {
  id: string;
  title: string;
  startSeconds: number;
  endSeconds: number;
  down?: number;
  toGoYards?: string;
  penaltyType?: string;
  formation: string;
  playType: string;
  comment: string;
  coachComment?: string;
  playerLinks: VideoClipPlayerLink[];
};

export type FilmRoomVideo = {
  id: string;
  title: string;
  description: string;
  sourceLabel: string;
  matchDate?: string;
  audience: VideoAudience;
  updatedAt: string;
  youtubeUrl: string;
  clips: VideoClip[];
};

export type Season = {
  id: string;
  label: string;
  startDate: string;
  targetDate: string;
  active: boolean;
};

export type SeasonGoal = {
  id: string;
  playerId: string;
  seasonId: string;
  offenseGoal?: string;
  defenseGoal?: string;
  offenseReflectionRating?: ReflectionRating;
  offenseReflectionComment?: string;
  defenseReflectionRating?: ReflectionRating;
  defenseReflectionComment?: string;
  createdAt: string;
  updatedAt: string;
};

export type TeamMember = {
  userId: string;
  email?: string;
  role: TeamRole;
  status: MembershipStatus;
  playerIds: string[];
  registrationMessage?: string;
};
