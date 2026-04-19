import { getDashboardPracticeDate } from "@/lib/date";
import {
  filmRoomVideos as mockFilmRoomVideos,
  formationMasters as mockFormationMasters,
  goalLogs as mockGoalLogs,
  goalTemplates as mockGoalTemplates,
  materials as mockMaterials,
  penaltyTypeMasters as mockPenaltyTypeMasters,
  playTypeMasters as mockPlayTypeMasters,
  players as mockPlayers,
  positionMasters as mockPositionMasters,
  seasonGoals as mockSeasonGoals,
  seasons as mockSeasons
} from "@/lib/mock-data";
import { FilmRoomVideo, GoalLog, GoalTemplate, Material, MembershipStatus, Player, PlayerPracticeEntry, PositionMaster, Season, SeasonGoal, TeamMember, TeamRole, VideoClip, VideoClipPlayerLink, VideoTagMaster } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type PlayerRow = {
  id: string;
  name: string;
  jersey_number: string | null;
  grade_label: string;
  guardian_name: string;
  favorite_skill: string | null;
  offense_position_ids: string[] | null;
  defense_position_ids: string[] | null;
  offense_goal: string | null;
  defense_goal: string | null;
  offense_reflection_rating: 1 | 2 | 3 | 4 | 5 | null;
  offense_reflection_comment: string | null;
  defense_reflection_rating: 1 | 2 | 3 | 4 | 5 | null;
  defense_reflection_comment: string | null;
  active: boolean;
};

type GoalTemplateRow = {
  id: string;
  side: GoalTemplate["side"];
  title: string;
  prompt: string;
  emoji: string;
  color: GoalTemplate["color"];
  template_text: string;
  input_placeholder: string | null;
};

type PracticeEntryRow = {
  player_id: string;
  practice_date: string;
  offense_goal: string | null;
  defense_goal: string | null;
  offense_reflection_rating: 1 | 2 | 3 | 4 | 5 | null;
  offense_reflection_comment: string | null;
  defense_reflection_rating: 1 | 2 | 3 | 4 | 5 | null;
  defense_reflection_comment: string | null;
};

type GoalLogRow = {
  id: string;
  player_id: string;
  goal_text: string;
  goal_template_id: string | null;
  log_date: string;
  note: string | null;
  submitted_by_role: GoalLog["by"];
};

type MaterialRow = {
  id: string;
  title: string;
  description: string;
  material_type: Material["type"];
  audience: Material["audience"];
  google_url: string;
  updated_at: string;
};

type FilmVideoRow = {
  id: string;
  title: string;
  description: string;
  youtube_url: string;
  audience: FilmRoomVideo["audience"];
  source_label: string;
  match_date: string | null;
  updated_at: string;
};

type FilmClipRow = {
  id: string;
  video_id: string;
  title: string;
  start_seconds: number;
  end_seconds: number;
  down: number | null;
  to_go_yards: string | null;
  penalty_type: string | null;
  formation: string;
  play_type: string;
  comment: string;
  coach_comment: string | null;
  player_links: VideoClipPlayerLink[] | null;
  sort_order: number;
};

type PositionMasterRow = {
  id: string;
  label: string;
  side: PositionMaster["side"];
};

type VideoTagMasterRow = {
  id: string;
  label: string;
};

type SeasonRow = {
  id: string;
  label: string;
  start_date: string;
  target_date: string;
  active: boolean;
};

type SeasonGoalRow = {
  id: string;
  player_id: string;
  season_id: string;
  offense_goal: string | null;
  defense_goal: string | null;
  offense_reflection_rating: 1 | 2 | 3 | 4 | 5 | null;
  offense_reflection_comment: string | null;
  defense_reflection_rating: 1 | 2 | 3 | 4 | 5 | null;
  defense_reflection_comment: string | null;
  created_at: string;
  updated_at: string;
};

export type TeamSnapshot = {
  filmRoomVideos: FilmRoomVideo[];
  formationMasters: VideoTagMaster[];
  goalLogs: GoalLog[];
  goalTemplates: GoalTemplate[];
  materials: Material[];
  penaltyTypeMasters: VideoTagMaster[];
  playTypeMasters: VideoTagMaster[];
  players: Player[];
  positionMasters: PositionMaster[];
  seasons: Season[];
  seasonGoals: SeasonGoal[];
};

type TeamMemberRow = {
  user_id: string;
  email: string | null;
  role: TeamRole;
  status: MembershipStatus;
  player_ids: string[] | null;
  registration_message: string | null;
};

function toPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    jerseyNumber: row.jersey_number ?? "",
    gradeLabel: row.grade_label,
    guardianName: row.guardian_name,
    favoriteSkill: row.favorite_skill ?? "これから見つける",
    offensePositionIds: row.offense_position_ids ?? [],
    defensePositionIds: row.defense_position_ids ?? [],
    practiceEntries: [],
    offenseGoal: row.offense_goal ?? undefined,
    defenseGoal: row.defense_goal ?? undefined,
    offenseReflectionRating: row.offense_reflection_rating ?? undefined,
    offenseReflectionComment: row.offense_reflection_comment ?? undefined,
    defenseReflectionRating: row.defense_reflection_rating ?? undefined,
    defenseReflectionComment: row.defense_reflection_comment ?? undefined,
    active: row.active,
  };
}

function toGoalTemplate(row: GoalTemplateRow): GoalTemplate {
  return {
    id: row.id,
    side: row.side,
    title: row.title,
    prompt: row.prompt,
    emoji: row.emoji,
    color: row.color,
    templateText: row.template_text,
    inputPlaceholder: row.input_placeholder ?? undefined,
  };
}

function toPracticeEntry(row: PracticeEntryRow): PlayerPracticeEntry {
  return {
    practiceDate: row.practice_date,
    offenseGoal: row.offense_goal ?? undefined,
    defenseGoal: row.defense_goal ?? undefined,
    offenseReflectionRating: row.offense_reflection_rating ?? undefined,
    offenseReflectionComment: row.offense_reflection_comment ?? undefined,
    defenseReflectionRating: row.defense_reflection_rating ?? undefined,
    defenseReflectionComment: row.defense_reflection_comment ?? undefined,
  };
}

function toGoalLog(row: GoalLogRow): GoalLog {
  return {
    id: row.id,
    playerId: row.player_id,
    goalText: row.goal_text,
    goalTemplateId: row.goal_template_id ?? undefined,
    date: row.log_date,
    note: row.note ?? undefined,
    by: row.submitted_by_role,
  };
}

function toMaterial(row: MaterialRow): Material {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.material_type,
    audience: row.audience,
    updatedAt: row.updated_at.slice(0, 10),
    url: row.google_url,
  };
}

function toVideoClip(row: FilmClipRow): VideoClip {
  return {
    id: row.id,
    title: row.title,
    startSeconds: row.start_seconds,
    endSeconds: row.end_seconds,
    down: row.down ?? undefined,
    toGoYards: row.to_go_yards ?? undefined,
    penaltyType: row.penalty_type ?? undefined,
    formation: row.formation,
    playType: row.play_type,
    comment: row.comment,
    coachComment: row.coach_comment ?? undefined,
    playerLinks: row.player_links ?? [],
  };
}

function toFilmRoomVideo(row: FilmVideoRow, clips: VideoClip[]): FilmRoomVideo {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    youtubeUrl: row.youtube_url,
    audience: row.audience,
    sourceLabel: row.source_label,
    matchDate: row.match_date ?? undefined,
    updatedAt: row.updated_at.slice(0, 10),
    clips,
  };
}

function toPositionMaster(row: PositionMasterRow): PositionMaster {
  return {
    id: row.id,
    label: row.label,
    side: row.side,
  };
}

function toVideoTagMaster(row: VideoTagMasterRow): VideoTagMaster {
  return {
    id: row.id,
    label: row.label,
  };
}

function toSeason(row: SeasonRow): Season {
  return {
    id: row.id,
    label: row.label,
    startDate: row.start_date,
    targetDate: row.target_date,
    active: row.active,
  };
}

function toSeasonGoal(row: SeasonGoalRow): SeasonGoal {
  return {
    id: row.id,
    playerId: row.player_id,
    seasonId: row.season_id,
    offenseGoal: row.offense_goal ?? undefined,
    defenseGoal: row.defense_goal ?? undefined,
    offenseReflectionRating: row.offense_reflection_rating ?? undefined,
    offenseReflectionComment: row.offense_reflection_comment ?? undefined,
    defenseReflectionRating: row.defense_reflection_rating ?? undefined,
    defenseReflectionComment: row.defense_reflection_comment ?? undefined,
    createdAt: row.created_at.slice(0, 10),
    updatedAt: row.updated_at.slice(0, 10),
  };
}

export async function fetchTeamSnapshot(supabase: SupabaseClient): Promise<TeamSnapshot> {
  const [
    { data: playerRows, error: playerError },
    { data: templateRows, error: templateError },
    { data: formationMasterRows, error: formationMasterError },
    { data: logRows, error: logError },
    { data: materialRows, error: materialError },
    { data: filmVideoRows, error: filmVideoError },
    { data: filmClipRows, error: filmClipError },
    { data: penaltyTypeMasterRows, error: penaltyTypeMasterError },
    { data: playTypeMasterRows, error: playTypeMasterError },
    { data: positionRows, error: positionError },
    { data: practiceRows, error: practiceError },
    { data: seasonRows, error: seasonError },
    { data: seasonGoalRows, error: seasonGoalError },
  ] = await Promise.all([
    supabase
      .from("players")
      .select(
        "id, name, jersey_number, grade_label, guardian_name, favorite_skill, offense_position_ids, defense_position_ids, offense_goal, defense_goal, offense_reflection_rating, offense_reflection_comment, defense_reflection_rating, defense_reflection_comment, active",
      )
      .order("created_at", { ascending: true }),
    supabase
      .from("goal_templates")
      .select("id, side, title, prompt, emoji, color, template_text, input_placeholder")
      .order("created_at", { ascending: true }),
    supabase.from("formation_masters").select("id, label").order("label", { ascending: true }),
    supabase
      .from("goal_logs")
      .select("id, player_id, goal_text, goal_template_id, log_date, note, submitted_by_role")
      .order("log_date", { ascending: false }),
    supabase
      .from("materials")
      .select("id, title, description, material_type, audience, google_url, updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("film_videos")
      .select("id, title, description, youtube_url, audience, source_label, match_date, updated_at")
      .order("match_date", { ascending: false, nullsFirst: false }),
    supabase
    .from("film_clips")
      .select("id, video_id, title, start_seconds, end_seconds, down, to_go_yards, penalty_type, formation, play_type, comment, coach_comment, player_links, sort_order")
      .order("sort_order", { ascending: true }),
    supabase.from("penalty_type_masters").select("id, label").order("label", { ascending: true }),
    supabase.from("play_type_masters").select("id, label").order("label", { ascending: true }),
    supabase.from("position_masters").select("id, label, side").order("label", { ascending: true }),
    supabase
      .from("practice_entries")
      .select("player_id, practice_date, offense_goal, defense_goal, offense_reflection_rating, offense_reflection_comment, defense_reflection_rating, defense_reflection_comment")
      .order("practice_date", { ascending: false }),
    supabase
      .from("seasons")
      .select("id, label, start_date, target_date, active")
      .order("start_date", { ascending: false }),
    supabase
      .from("season_goals")
      .select("id, player_id, season_id, offense_goal, defense_goal, offense_reflection_rating, offense_reflection_comment, defense_reflection_rating, defense_reflection_comment, created_at, updated_at")
      .order("created_at", { ascending: false }),
  ]);

  const firstError =
    playerError ??
    templateError ??
    formationMasterError ??
    logError ??
    materialError ??
    filmVideoError ??
    filmClipError ??
    penaltyTypeMasterError ??
    playTypeMasterError ??
    positionError ??
    practiceError ??
    seasonError ??
    seasonGoalError;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const goalEntries = (logRows ?? []).map(toGoalLog);
  const practiceEntriesByPlayer = new Map<string, PlayerPracticeEntry[]>();
  const clipsByVideoId = new Map<string, VideoClip[]>();

  for (const row of practiceRows ?? []) {
    const current = practiceEntriesByPlayer.get(row.player_id) ?? [];
    current.push(toPracticeEntry(row));
    practiceEntriesByPlayer.set(row.player_id, current);
  }

  for (const row of filmClipRows ?? []) {
    const current = clipsByVideoId.get(row.video_id) ?? [];
    current.push(toVideoClip(row));
    clipsByVideoId.set(row.video_id, current);
  }

  return {
    filmRoomVideos: (filmVideoRows ?? []).map((row) => toFilmRoomVideo(row, clipsByVideoId.get(row.id) ?? [])),
    formationMasters: (formationMasterRows ?? []).map(toVideoTagMaster),
    players: (playerRows ?? []).map((row) => {
      const practiceEntries = practiceEntriesByPlayer.get(row.id) ?? [];
      const fallbackEntry =
        !practiceEntries.length &&
        (row.offense_goal ||
          row.defense_goal ||
          row.offense_reflection_rating ||
          row.offense_reflection_comment ||
          row.defense_reflection_rating ||
          row.defense_reflection_comment)
          ? [
              {
                practiceDate: getDashboardPracticeDate(),
                offenseGoal: row.offense_goal ?? undefined,
                defenseGoal: row.defense_goal ?? undefined,
                offenseReflectionRating: row.offense_reflection_rating ?? undefined,
                offenseReflectionComment: row.offense_reflection_comment ?? undefined,
                defenseReflectionRating: row.defense_reflection_rating ?? undefined,
                defenseReflectionComment: row.defense_reflection_comment ?? undefined,
              },
            ]
          : [];

      return {
        ...toPlayer(row),
        practiceEntries: practiceEntries.length ? practiceEntries : fallbackEntry,
      };
    }),
    goalTemplates: (templateRows ?? []).map(toGoalTemplate),
    goalLogs: goalEntries,
    materials: (materialRows ?? []).map(toMaterial),
    penaltyTypeMasters: (penaltyTypeMasterRows ?? []).map(toVideoTagMaster),
    playTypeMasters: (playTypeMasterRows ?? []).map(toVideoTagMaster),
    positionMasters: (positionRows ?? []).map(toPositionMaster),
    seasons: (seasonRows ?? []).map(toSeason),
    seasonGoals: (seasonGoalRows ?? []).map(toSeasonGoal),
  };
}

export async function fetchCurrentTeamRole(supabase: SupabaseClient): Promise<TeamRole | null> {
  const membership = await fetchCurrentTeamMember(supabase);
  return membership?.role ?? null;
}

export async function fetchCurrentTeamMember(supabase: SupabaseClient): Promise<TeamMember | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(authError.message);
  }

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("team_members")
    .select("user_id, email, role, status, player_ids, registration_message")
    .eq("user_id", user.id)
    .maybeSingle<TeamMemberRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    userId: data.user_id,
    email: data.email ?? undefined,
    role: data.role,
    status: data.status,
    playerIds: data.player_ids ?? [],
    registrationMessage: data.registration_message ?? undefined,
  };
}

export async function ensurePendingTeamMember(supabase: SupabaseClient): Promise<TeamMember> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error(authError?.message ?? "ユーザー情報を取得できませんでした。");
  }

  const email = user.email?.trim().toLowerCase();

  if (email) {
    const { data: claimedRows, error: claimError } = await supabase.rpc("claim_team_member_by_email", {
      login_email: email,
    });

    if (claimError) {
      throw new Error(claimError.message);
    }

    const claimed = Array.isArray(claimedRows) ? claimedRows[0] : claimedRows;

    if (claimed) {
      return {
        userId: claimed.user_id,
        email: claimed.email ?? undefined,
        role: claimed.role,
        status: claimed.status,
        playerIds: claimed.player_ids ?? [],
        registrationMessage: claimed.registration_message ?? undefined,
      };
    }
  }

  const existing = await fetchCurrentTeamMember(supabase);

  if (existing) {
    return existing;
  }

  const { data, error } = await supabase
    .from("team_members")
    .insert({
      user_id: user.id,
      email: email ?? null,
      role: "guardian",
      status: "pending",
      player_ids: [],
    })
    .select("user_id, email, role, status, player_ids, registration_message")
    .single<TeamMemberRow>();

  if (error) {
    throw new Error(error.message);
  }

  return {
    userId: data.user_id,
    email: data.email ?? undefined,
    role: data.role,
    status: data.status,
    playerIds: data.player_ids ?? [],
    registrationMessage: data.registration_message ?? undefined,
  };
}

export async function fetchPendingTeamMembers(supabase: SupabaseClient): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("user_id, email, role, status, player_ids, registration_message")
    .eq("status", "pending");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((member) => ({
    userId: member.user_id,
    email: member.email ?? undefined,
    role: member.role,
    status: member.status,
    playerIds: member.player_ids ?? [],
    registrationMessage: member.registration_message ?? undefined,
  }));
}

export async function fetchTeamMembersForAdmin(supabase: SupabaseClient): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("user_id, email, role, status, player_ids, registration_message")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((member) => ({
    userId: member.user_id,
    email: member.email ?? undefined,
    role: member.role,
    status: member.status,
    playerIds: member.player_ids ?? [],
    registrationMessage: member.registration_message ?? undefined,
  }));
}

export async function updateRegistrationMessage(
  supabase: SupabaseClient,
  message: string,
): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error(authError?.message ?? "ユーザー情報を取得できませんでした。");
  }

  const { error } = await supabase
    .from("team_members")
    .update({ registration_message: message })
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateTeamMemberStatus(
  supabase: SupabaseClient,
  userId: string,
  status: MembershipStatus,
  role?: TeamRole,
): Promise<void> {
  const payload: { status: MembershipStatus; role?: TeamRole } = { status };

  if (role) {
    payload.role = role;
  }

  const { error } = await supabase.from("team_members").update(payload).eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateTeamMemberPlayerIds(
  supabase: SupabaseClient,
  userId: string,
  playerIds: string[],
): Promise<void> {
  const { error } = await supabase.from("team_members").update({ player_ids: playerIds }).eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function insertPlayer(supabase: SupabaseClient, player: Omit<Player, "id">): Promise<Player> {
  const { data, error } = await supabase
    .from("players")
    .insert({
      name: player.name,
      jersey_number: player.jerseyNumber || null,
      grade_label: player.gradeLabel,
      guardian_name: player.guardianName,
      favorite_skill: player.favoriteSkill,
      offense_position_ids: player.offensePositionIds,
      defense_position_ids: player.defensePositionIds,
      offense_goal: player.offenseGoal ?? null,
      defense_goal: player.defenseGoal ?? null,
      offense_reflection_rating: player.offenseReflectionRating ?? null,
      offense_reflection_comment: player.offenseReflectionComment ?? null,
      defense_reflection_rating: player.defenseReflectionRating ?? null,
      defense_reflection_comment: player.defenseReflectionComment ?? null,
      active: player.active,
    })
    .select(
      "id, name, jersey_number, grade_label, guardian_name, favorite_skill, offense_position_ids, defense_position_ids, offense_goal, defense_goal, offense_reflection_rating, offense_reflection_comment, defense_reflection_rating, defense_reflection_comment, active",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toPlayer(data);
}

export async function upsertPracticeEntry(
  supabase: SupabaseClient,
  playerId: string,
  entry: PlayerPracticeEntry,
): Promise<void> {
  const { error } = await supabase.from("practice_entries").upsert(
    {
      player_id: playerId,
      practice_date: entry.practiceDate,
      offense_goal: entry.offenseGoal ?? null,
      defense_goal: entry.defenseGoal ?? null,
      offense_reflection_rating: entry.offenseReflectionRating ?? null,
      offense_reflection_comment: entry.offenseReflectionComment ?? null,
      defense_reflection_rating: entry.defenseReflectionRating ?? null,
      defense_reflection_comment: entry.defenseReflectionComment ?? null,
    },
    { onConflict: "player_id,practice_date" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function updatePlayer(supabase: SupabaseClient, player: Player): Promise<void> {
  const { error } = await supabase
    .from("players")
    .update({
      name: player.name,
      jersey_number: player.jerseyNumber || null,
      grade_label: player.gradeLabel,
      guardian_name: player.guardianName,
      favorite_skill: player.favoriteSkill,
      offense_position_ids: player.offensePositionIds,
      defense_position_ids: player.defensePositionIds,
      offense_goal: player.offenseGoal ?? null,
      defense_goal: player.defenseGoal ?? null,
      offense_reflection_rating: player.offenseReflectionRating ?? null,
      offense_reflection_comment: player.offenseReflectionComment ?? null,
      defense_reflection_rating: player.defenseReflectionRating ?? null,
      defense_reflection_comment: player.defenseReflectionComment ?? null,
      active: player.active,
    })
    .eq("id", player.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function insertGoalLog(
  supabase: SupabaseClient,
  log: Omit<GoalLog, "id">,
): Promise<GoalLog> {
  const { data, error } = await supabase
    .from("goal_logs")
    .insert({
      player_id: log.playerId,
      goal_text: log.goalText,
      goal_template_id: log.goalTemplateId ?? null,
      log_date: log.date,
      note: log.note ?? null,
      submitted_by_role: log.by,
    })
    .select("id, player_id, goal_text, goal_template_id, log_date, note, submitted_by_role")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toGoalLog(data);
}

export async function insertMaterial(
  supabase: SupabaseClient,
  material: Omit<Material, "id" | "updatedAt">,
): Promise<Material> {
  const { data, error } = await supabase
    .from("materials")
    .insert({
      title: material.title,
      description: material.description,
      material_type: material.type,
      audience: material.audience,
      google_url: material.url,
    })
    .select("id, title, description, material_type, audience, google_url, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toMaterial(data);
}

export async function insertFilmRoomVideo(
  supabase: SupabaseClient,
  video: Omit<FilmRoomVideo, "id" | "updatedAt" | "clips">,
): Promise<FilmRoomVideo> {
  const { data, error } = await supabase
    .from("film_videos")
    .insert({
      title: video.title,
      description: video.description,
      youtube_url: video.youtubeUrl,
      audience: video.audience,
      source_label: video.sourceLabel,
      match_date: video.matchDate ?? null,
    })
    .select("id, title, description, youtube_url, audience, source_label, match_date, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toFilmRoomVideo(data, []);
}

export async function insertFilmClip(
  supabase: SupabaseClient,
  clip: Omit<VideoClip, "id"> & { videoId: string; sortOrder: number },
): Promise<{ clip: VideoClip; videoId: string }> {
  const { data, error } = await supabase
    .from("film_clips")
    .insert({
      video_id: clip.videoId,
      title: clip.title,
      start_seconds: clip.startSeconds,
      end_seconds: clip.endSeconds,
      down: clip.down ?? null,
      to_go_yards: clip.toGoYards ?? null,
      penalty_type: clip.penaltyType ?? null,
      formation: clip.formation,
      play_type: clip.playType,
      comment: clip.comment,
      coach_comment: clip.coachComment ?? null,
      player_links: clip.playerLinks,
      sort_order: clip.sortOrder,
    })
    .select("id, video_id, title, start_seconds, end_seconds, down, to_go_yards, penalty_type, formation, play_type, comment, coach_comment, player_links, sort_order")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    videoId: data.video_id,
    clip: toVideoClip(data),
  };
}

export async function updateFilmClip(
  supabase: SupabaseClient,
  clip: VideoClip & { videoId: string },
): Promise<{ clip: VideoClip; videoId: string }> {
  const { data, error } = await supabase
    .from("film_clips")
    .update({
      title: clip.title,
      start_seconds: clip.startSeconds,
      end_seconds: clip.endSeconds,
      down: clip.down ?? null,
      to_go_yards: clip.toGoYards ?? null,
      penalty_type: clip.penaltyType ?? null,
      formation: clip.formation,
      play_type: clip.playType,
      comment: clip.comment,
      coach_comment: clip.coachComment ?? null,
      player_links: clip.playerLinks,
    })
    .eq("id", clip.id)
    .select("id, video_id, title, start_seconds, end_seconds, down, to_go_yards, penalty_type, formation, play_type, comment, coach_comment, player_links, sort_order")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    videoId: data.video_id,
    clip: toVideoClip(data),
  };
}

export async function deleteFilmClip(
  supabase: SupabaseClient,
  clipId: string,
): Promise<void> {
  const { error } = await supabase.from("film_clips").delete().eq("id", clipId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function upsertPositionMasters(
  supabase: SupabaseClient,
  positions: PositionMaster[],
): Promise<void> {
  const { error } = await supabase.from("position_masters").upsert(
    positions.map((position) => ({
      id: position.id,
      label: position.label,
      side: position.side,
    })),
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function deletePositionMasters(
  supabase: SupabaseClient,
  positionIds: string[],
): Promise<void> {
  if (!positionIds.length) {
    return;
  }

  const { error } = await supabase.from("position_masters").delete().in("id", positionIds);

  if (error) {
    throw new Error(error.message);
  }
}

export async function upsertGoalTemplates(
  supabase: SupabaseClient,
  templates: GoalTemplate[],
): Promise<void> {
  const { error } = await supabase.from("goal_templates").upsert(
    templates.map((template) => ({
      id: template.id,
      side: template.side,
      title: template.title,
      prompt: template.prompt,
      emoji: template.emoji,
      color: template.color,
      template_text: template.templateText,
      input_placeholder: template.inputPlaceholder ?? null,
    })),
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function upsertFormationMasters(
  supabase: SupabaseClient,
  masters: VideoTagMaster[],
): Promise<void> {
  const { error } = await supabase.from("formation_masters").upsert(
    masters.map((master) => ({
      id: master.id,
      label: master.label,
    })),
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteFormationMasters(
  supabase: SupabaseClient,
  masterIds: string[],
): Promise<void> {
  if (!masterIds.length) {
    return;
  }

  const { error } = await supabase.from("formation_masters").delete().in("id", masterIds);

  if (error) {
    throw new Error(error.message);
  }
}

export async function upsertPlayTypeMasters(
  supabase: SupabaseClient,
  masters: VideoTagMaster[],
): Promise<void> {
  const { error } = await supabase.from("play_type_masters").upsert(
    masters.map((master) => ({
      id: master.id,
      label: master.label,
    })),
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function deletePlayTypeMasters(
  supabase: SupabaseClient,
  masterIds: string[],
): Promise<void> {
  if (!masterIds.length) {
    return;
  }

  const { error } = await supabase.from("play_type_masters").delete().in("id", masterIds);

  if (error) {
    throw new Error(error.message);
  }
}

export async function upsertPenaltyTypeMasters(
  supabase: SupabaseClient,
  masters: VideoTagMaster[],
): Promise<void> {
  const { error } = await supabase.from("penalty_type_masters").upsert(
    masters.map((master) => ({
      id: master.id,
      label: master.label,
    })),
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function deletePenaltyTypeMasters(
  supabase: SupabaseClient,
  masterIds: string[],
): Promise<void> {
  if (!masterIds.length) {
    return;
  }

  const { error } = await supabase.from("penalty_type_masters").delete().in("id", masterIds);

  if (error) {
    throw new Error(error.message);
  }
}

export function getFallbackTeamSnapshot(): TeamSnapshot {
  return {
    filmRoomVideos: mockFilmRoomVideos,
    formationMasters: mockFormationMasters,
    players: mockPlayers,
    goalTemplates: mockGoalTemplates,
    goalLogs: mockGoalLogs,
    materials: mockMaterials,
    penaltyTypeMasters: mockPenaltyTypeMasters,
    playTypeMasters: mockPlayTypeMasters,
    positionMasters: mockPositionMasters,
    seasons: mockSeasons,
    seasonGoals: mockSeasonGoals,
  };
}

export async function upsertSeasonGoal(
  supabase: SupabaseClient,
  goal: SeasonGoal,
): Promise<SeasonGoal> {
  const payload: Record<string, unknown> = {
    player_id: goal.playerId,
    season_id: goal.seasonId,
    offense_goal: goal.offenseGoal ?? null,
    defense_goal: goal.defenseGoal ?? null,
    offense_reflection_rating: goal.offenseReflectionRating ?? null,
    offense_reflection_comment: goal.offenseReflectionComment ?? null,
    defense_reflection_rating: goal.defenseReflectionRating ?? null,
    defense_reflection_comment: goal.defenseReflectionComment ?? null,
  };

  // Only include id when it's a real UUID (i.e. previously saved to DB)
  if (goal.id && !goal.id.startsWith("sg-")) {
    payload.id = goal.id;
  }

  const { data, error } = await supabase
    .from("season_goals")
    .upsert(payload, { onConflict: "player_id,season_id" })
    .select("id, player_id, season_id, offense_goal, defense_goal, offense_reflection_rating, offense_reflection_comment, defense_reflection_rating, defense_reflection_comment, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toSeasonGoal(data);
}
