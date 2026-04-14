import type { SupabaseClient } from "@supabase/supabase-js";
import {
  goalLogs as mockGoalLogs,
  goalTemplates as mockGoalTemplates,
  materials as mockMaterials,
  players as mockPlayers,
  positionMasters as mockPositionMasters,
} from "@/lib/mock-data";
import { GoalLog, GoalTemplate, Material, Player, PositionMaster } from "@/lib/types";

type PlayerRow = {
  id: string;
  name: string;
  grade_label: string;
  grade_band: Player["gradeBand"];
  guardian_name: string;
  favorite_skill: string | null;
  offense_position_id: string;
  defense_position_id: string;
  active: boolean;
};

type GoalTemplateRow = {
  id: string;
  title: string;
  prompt: string;
  emoji: string;
  color: GoalTemplate["color"];
  template_text: string;
  input_placeholder: string | null;
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

type PositionMasterRow = {
  id: string;
  label: string;
  side: PositionMaster["side"];
};

export type TeamSnapshot = {
  goalLogs: GoalLog[];
  goalTemplates: GoalTemplate[];
  materials: Material[];
  players: Player[];
  positionMasters: PositionMaster[];
};

function toPlayer(row: PlayerRow, recentGoalText?: string): Player {
  return {
    id: row.id,
    name: row.name,
    gradeLabel: row.grade_label,
    gradeBand: row.grade_band,
    guardianName: row.guardian_name,
    favoriteSkill: row.favorite_skill ?? "これから見つける",
    offensePositionId: row.offense_position_id,
    defensePositionId: row.defense_position_id,
    active: row.active,
    recentGoalText,
  };
}

function toGoalTemplate(row: GoalTemplateRow): GoalTemplate {
  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt,
    emoji: row.emoji,
    color: row.color,
    templateText: row.template_text,
    inputPlaceholder: row.input_placeholder ?? undefined,
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

function toPositionMaster(row: PositionMasterRow): PositionMaster {
  return {
    id: row.id,
    label: row.label,
    side: row.side,
  };
}

function buildRecentGoalMap(goalEntries: GoalLog[]) {
  const recentGoalMap = new Map<string, { date: string; goalText: string }>();

  goalEntries.forEach((entry) => {
    const current = recentGoalMap.get(entry.playerId);

    if (!current || entry.date >= current.date) {
      recentGoalMap.set(entry.playerId, { date: entry.date, goalText: entry.goalText });
    }
  });

  return recentGoalMap;
}

export async function fetchTeamSnapshot(supabase: SupabaseClient): Promise<TeamSnapshot> {
  const [
    { data: playerRows, error: playerError },
    { data: templateRows, error: templateError },
    { data: logRows, error: logError },
    { data: materialRows, error: materialError },
    { data: positionRows, error: positionError },
  ] = await Promise.all([
    supabase
      .from("players")
      .select(
        "id, name, grade_label, grade_band, guardian_name, favorite_skill, offense_position_id, defense_position_id, active",
      )
      .order("created_at", { ascending: true }),
    supabase
      .from("goal_templates")
      .select("id, title, prompt, emoji, color, template_text, input_placeholder")
      .order("created_at", { ascending: true }),
    supabase
      .from("goal_logs")
      .select("id, player_id, goal_text, goal_template_id, log_date, note, submitted_by_role")
      .order("log_date", { ascending: false }),
    supabase
      .from("materials")
      .select("id, title, description, material_type, audience, google_url, updated_at")
      .order("updated_at", { ascending: false }),
    supabase.from("position_masters").select("id, label, side").order("label", { ascending: true }),
  ]);

  const firstError =
    playerError ?? templateError ?? logError ?? materialError ?? positionError;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const goalEntries = (logRows ?? []).map(toGoalLog);
  const recentGoalMap = buildRecentGoalMap(goalEntries);

  return {
    players: (playerRows ?? []).map((row) => toPlayer(row, recentGoalMap.get(row.id)?.goalText)),
    goalTemplates: (templateRows ?? []).map(toGoalTemplate),
    goalLogs: goalEntries,
    materials: (materialRows ?? []).map(toMaterial),
    positionMasters: (positionRows ?? []).map(toPositionMaster),
  };
}

export async function insertPlayer(supabase: SupabaseClient, player: Omit<Player, "id">): Promise<Player> {
  const { data, error } = await supabase
    .from("players")
    .insert({
      name: player.name,
      grade_label: player.gradeLabel,
      grade_band: player.gradeBand,
      guardian_name: player.guardianName,
      favorite_skill: player.favoriteSkill,
      offense_position_id: player.offensePositionId,
      defense_position_id: player.defensePositionId,
      active: player.active,
    })
    .select(
      "id, name, grade_label, grade_band, guardian_name, favorite_skill, offense_position_id, defense_position_id, active",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toPlayer(data, player.recentGoalText);
}

export async function updatePlayer(supabase: SupabaseClient, player: Player): Promise<void> {
  const { error } = await supabase
    .from("players")
    .update({
      name: player.name,
      grade_label: player.gradeLabel,
      grade_band: player.gradeBand,
      guardian_name: player.guardianName,
      favorite_skill: player.favoriteSkill,
      offense_position_id: player.offensePositionId,
      defense_position_id: player.defensePositionId,
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

export async function upsertGoalTemplates(
  supabase: SupabaseClient,
  templates: GoalTemplate[],
): Promise<void> {
  const { error } = await supabase.from("goal_templates").upsert(
    templates.map((template) => ({
      id: template.id,
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

export function getFallbackTeamSnapshot(): TeamSnapshot {
  return {
    players: mockPlayers,
    goalTemplates: mockGoalTemplates,
    goalLogs: mockGoalLogs,
    materials: mockMaterials,
    positionMasters: mockPositionMasters,
  };
}
