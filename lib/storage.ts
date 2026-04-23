import { getDashboardPracticeDate } from "@/lib/date";
import { filmRoomVideos, formationMasters, goalLogs, goalTemplates, materials, penaltyTypeMasters, playTypeMasters, players, playbookAssets, positionMasters, seasonGoals, seasons } from "@/lib/mock-data";
import { ClipWhiteboard, FilmRoomVideo, GoalLog, GoalTemplate, Material, Player, PlaybookAsset, PositionMaster, Season, SeasonGoal, VideoClip, VideoTagMaster } from "@/lib/types";
import { findGoalTemplate } from "@/lib/utils";

const KEYS = {
  players: "ff-team-players",
  goalLogs: "ff-team-goal-logs",
  materials: "ff-team-materials",
  filmRoomVideos: "ff-team-film-room-videos",
  positionMasters: "ff-team-position-masters",
  goalTemplates: "ff-team-goal-templates",
  formationMasters: "ff-team-formation-masters",
  penaltyTypeMasters: "ff-team-penalty-type-masters",
  playTypeMasters: "ff-team-play-type-masters",
  playbookAssets: "ff-team-playbook-assets",
  seasons: "ff-team-seasons",
  seasonGoals: "ff-team-season-goals",
} as const;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const value = window.localStorage.getItem(key);

  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function clearStorage() {
  if (typeof window === "undefined") {
    return;
  }

  Object.values(KEYS).forEach((key) => window.localStorage.removeItem(key));
}

function normalizePlayer(player: Player): Player {
  const legacyOffense = (player as Player & { offensePosition?: string }).offensePosition;
  const legacyDefense = (player as Player & { defensePosition?: string }).defensePosition;
  const legacyOffensePositionId = (player as Player & { offensePositionId?: string }).offensePositionId;
  const legacyDefensePositionId = (player as Player & { defensePositionId?: string }).defensePositionId;
  const legacyRecentGoal = (player as Player & { recentGoalText?: string }).recentGoalText;
  const legacyJerseyNumber = (player as Player & { number?: string | number }).number;
  const legacyOffenseReflection = (player as Player & { offenseReflection?: string }).offenseReflection;
  const legacyDefenseReflection = (player as Player & { defenseReflection?: string }).defenseReflection;
  const legacyPracticeDate = getDashboardPracticeDate();
  const normalizedEntries =
    player.practiceEntries?.length
      ? player.practiceEntries
      : player.offenseGoal ||
          player.defenseGoal ||
          player.offenseReflectionRating ||
          player.offenseReflectionComment ||
          player.defenseReflectionRating ||
          player.defenseReflectionComment ||
          legacyOffenseReflection ||
          legacyDefenseReflection
        ? [
            {
              practiceDate: legacyPracticeDate,
              offenseGoal: player.offenseGoal ?? legacyRecentGoal,
              defenseGoal: player.defenseGoal,
              offenseReflectionRating: player.offenseReflectionRating,
              offenseReflectionComment: player.offenseReflectionComment ?? legacyOffenseReflection,
              defenseReflectionRating: player.defenseReflectionRating,
              defenseReflectionComment: player.defenseReflectionComment ?? legacyDefenseReflection,
            },
          ]
        : [];
  const offenseMap: Record<string, string> = {
    center: "op-center",
    quarterback: "op-quarterback",
    runner: "op-runner",
    receiver: "op-receiver",
    flex: "op-flex",
  };
  const defenseMap: Record<string, string> = {
    rusher: "dp-rusher",
    linebacker: "dp-linebacker",
    cornerback: "dp-cornerback",
    safety: "dp-safety",
    "flag-keeper": "dp-flag-keeper",
  };

  return {
    ...player,
    jerseyNumber: player.jerseyNumber ?? String(legacyJerseyNumber ?? ""),
    offensePositionIds:
      player.offensePositionIds?.length
        ? player.offensePositionIds
        : [legacyOffensePositionId ?? offenseMap[legacyOffense ?? ""] ?? "op-flex"],
    defensePositionIds:
      player.defensePositionIds?.length
        ? player.defensePositionIds
        : [legacyDefensePositionId ?? defenseMap[legacyDefense ?? ""] ?? "dp-linebacker"],
    gradeLabel: player.gradeLabel ?? "未設定",
    practiceEntries: normalizedEntries,
    offenseGoal: player.offenseGoal ?? legacyRecentGoal,
    defenseGoal: player.defenseGoal,
    offenseReflectionComment: player.offenseReflectionComment ?? legacyOffenseReflection,
    defenseReflectionComment: player.defenseReflectionComment ?? legacyDefenseReflection,
  };
}

function normalizeGoalLog(log: GoalLog): GoalLog {
  const legacyGoalId = (log as GoalLog & { goalId?: string }).goalId;
  const legacyTemplate = findGoalTemplate(log.goalTemplateId ?? legacyGoalId, goalTemplates);

  return {
    ...log,
    goalTemplateId: log.goalTemplateId ?? legacyGoalId,
    goalText: log.goalText ?? legacyTemplate?.title ?? log.note ?? "目標を登録",
  };
}

export function loadPlayers(): Player[] {
  return readJson(KEYS.players, players).map(normalizePlayer);
}

export function savePlayers(nextPlayers: Player[]) {
  writeJson(KEYS.players, nextPlayers);
}

export function loadGoalLogs(): GoalLog[] {
  return readJson(KEYS.goalLogs, goalLogs).map(normalizeGoalLog);
}

export function saveGoalLogs(nextLogs: GoalLog[]) {
  writeJson(KEYS.goalLogs, nextLogs);
}

export function loadMaterials(): Material[] {
  return readJson(KEYS.materials, materials);
}

export function saveMaterials(nextMaterials: Material[]) {
  writeJson(KEYS.materials, nextMaterials);
}

export function loadFilmRoomVideos(): FilmRoomVideo[] {
  return readJson(KEYS.filmRoomVideos, filmRoomVideos).map(normalizeFilmRoomVideo);
}

export function saveFilmRoomVideos(nextVideos: FilmRoomVideo[]) {
  writeJson(KEYS.filmRoomVideos, nextVideos);
}

function normalizeVideoClip(clip: VideoClip & { playerLabel?: string }): VideoClip {
  const legacyDown = (clip as unknown as { down?: string | number }).down;
  const parsedDown =
    typeof legacyDown === "number"
      ? legacyDown
      : typeof legacyDown === "string"
        ? Number.parseInt(legacyDown, 10) || Number.parseInt(legacyDown.replace(/\D/g, ""), 10) || undefined
        : undefined;

  return {
    ...clip,
    down: clip.down ?? parsedDown,
    toGoYards: clip.toGoYards ?? undefined,
    penaltyType: clip.penaltyType ?? undefined,
    coachComment: clip.coachComment ?? undefined,
    playerLinks: clip.playerLinks ?? [],
    focusTargets: clip.focusTargets ?? [],
    whiteboards: (clip.whiteboards ?? []).map(normalizeClipWhiteboard),
  };
}

function normalizeClipWhiteboard(whiteboard: ClipWhiteboard): ClipWhiteboard {
  return {
    ...whiteboard,
    baseMode: whiteboard.baseMode ?? "blank",
    basePlaybookAssetId: whiteboard.basePlaybookAssetId ?? undefined,
  };
}

function normalizeFilmRoomVideo(video: FilmRoomVideo): FilmRoomVideo {
  const legacyMatchDate = (video as FilmRoomVideo & { gameDate?: string }).gameDate;

  return {
    ...video,
    matchDate: video.matchDate ?? legacyMatchDate,
    clips: (video.clips ?? []).map(normalizeVideoClip),
  };
}

export function loadPositionMasters(): PositionMaster[] {
  return readJson(KEYS.positionMasters, positionMasters);
}

export function savePositionMasters(nextPositions: PositionMaster[]) {
  writeJson(KEYS.positionMasters, nextPositions);
}

export function loadGoalTemplates(): GoalTemplate[] {
  return readJson(KEYS.goalTemplates, goalTemplates);
}

export function saveGoalTemplates(nextTemplates: GoalTemplate[]) {
  writeJson(KEYS.goalTemplates, nextTemplates);
}

export function loadFormationMasters(): VideoTagMaster[] {
  return readJson(KEYS.formationMasters, formationMasters);
}

export function saveFormationMasters(nextMasters: VideoTagMaster[]) {
  writeJson(KEYS.formationMasters, nextMasters);
}

export function loadPlayTypeMasters(): VideoTagMaster[] {
  return readJson(KEYS.playTypeMasters, playTypeMasters);
}

export function savePlayTypeMasters(nextMasters: VideoTagMaster[]) {
  writeJson(KEYS.playTypeMasters, nextMasters);
}

export function loadPlaybookAssets(): PlaybookAsset[] {
  return readJson(KEYS.playbookAssets, playbookAssets);
}

export function savePlaybookAssets(nextAssets: PlaybookAsset[]) {
  writeJson(KEYS.playbookAssets, nextAssets);
}

export function loadPenaltyTypeMasters(): VideoTagMaster[] {
  return readJson(KEYS.penaltyTypeMasters, penaltyTypeMasters);
}

export function savePenaltyTypeMasters(nextMasters: VideoTagMaster[]) {
  writeJson(KEYS.penaltyTypeMasters, nextMasters);
}

export function loadSeasons(): Season[] {
  return readJson(KEYS.seasons, seasons);
}

export function saveSeasons(next: Season[]) {
  writeJson(KEYS.seasons, next);
}

export function loadSeasonGoals(): SeasonGoal[] {
  return readJson(KEYS.seasonGoals, seasonGoals);
}

export function saveSeasonGoals(next: SeasonGoal[]) {
  writeJson(KEYS.seasonGoals, next);
}
