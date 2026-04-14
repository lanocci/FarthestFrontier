"use client";

import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { Section } from "@/components/section";
import { updatePlayer } from "@/lib/data-store";
import { GoalTemplate, Player, PositionMaster } from "@/lib/types";
import { buildGoalText, getPositionLabel } from "@/lib/utils";

type PlayerPracticeEditorProps = {
  canManageTeam: boolean;
  goalTemplates: GoalTemplate[];
  player: Player | null;
  positionMasters: PositionMaster[];
  setPlayers: Dispatch<SetStateAction<Player[]>>;
  setTeamMessage: Dispatch<SetStateAction<string | null>>;
  supabase: SupabaseClient | null;
  syncing: boolean;
  setSyncing: Dispatch<SetStateAction<boolean>>;
  teamMessage: string | null;
  usingRemoteData: boolean;
};

function GoalField({
  label,
  currentValue,
  templates,
  disabled,
  onSave,
}: {
  label: string;
  currentValue?: string;
  templates: GoalTemplate[];
  disabled: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [input, setInput] = useState("");

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null;
  const preview = useMemo(() => {
    if (!selectedTemplate) {
      return input.trim();
    }

    return buildGoalText(selectedTemplate, input).trim();
  }, [input, selectedTemplate]);

  async function handleSave() {
    if (!preview) {
      return;
    }

    await onSave(preview);
    setInput("");
    setSelectedTemplateId("");
  }

  return (
    <div className="entry-card">
      <span className="entry-label">{label}</span>
      <strong>{currentValue ?? "未入力"}</strong>
      <div className="template-chips">
        {templates.map((template) => (
          <button
            key={template.id}
            className={`chip-button ${selectedTemplateId === template.id ? "is-active" : ""}`}
            type="button"
            onClick={() => setSelectedTemplateId(selectedTemplateId === template.id ? "" : template.id)}
            disabled={disabled}
          >
            {template.emoji} {template.title}
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder={selectedTemplate?.inputPlaceholder ?? "自由入力"}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        disabled={disabled}
      />
      <div className="preview-card">{preview || "ここに登録内容が表示されます"}</div>
      <button className="button" type="button" onClick={handleSave} disabled={disabled || !preview}>
        保存
      </button>
    </div>
  );
}

function ReflectionField({
  label,
  currentValue,
  disabled,
  onSave,
}: {
  label: string;
  currentValue?: string;
  disabled: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const [input, setInput] = useState("");

  async function handleSave() {
    const trimmed = input.trim();

    if (!trimmed) {
      return;
    }

    await onSave(trimmed);
    setInput("");
  }

  return (
    <div className="entry-card">
      <span className="entry-label">{label}</span>
      <strong>{currentValue ?? "未入力"}</strong>
      <input
        type="text"
        placeholder={`${label}を入力`}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        disabled={disabled}
      />
      <button className="button secondary" type="button" onClick={handleSave} disabled={disabled || !input.trim()}>
        保存
      </button>
    </div>
  );
}

export function PlayerPracticeEditor({
  canManageTeam,
  goalTemplates,
  player,
  positionMasters,
  setPlayers,
  setTeamMessage,
  supabase,
  syncing,
  setSyncing,
  teamMessage,
  usingRemoteData,
}: PlayerPracticeEditorProps) {
  async function persist(nextPlayer: Player, message: string) {
    try {
      setSyncing(true);

      if (usingRemoteData && supabase) {
        await updatePlayer(supabase, nextPlayer);
      }

      setPlayers((current) => current.map((player) => (player.id === nextPlayer.id ? nextPlayer : player)));
      setTeamMessage(message);
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : "保存に失敗しました。");
    } finally {
      setSyncing(false);
    }
  }

  if (!player) {
    return (
      <Section title="選手入力" copy="対象の選手が見つかりませんでした。">
        <Link className="button secondary" href="/">
          トップへ戻る
        </Link>
      </Section>
    );
  }

  return (
    <div className="stack practice-editor-page">
      <Section
        title={player.name}
        copy={`${player.gradeLabel} / OF: ${getPositionLabel(player.offensePositionId, positionMasters)} / DF: ${getPositionLabel(player.defensePositionId, positionMasters)}`}
      >
        <div className="status-strip">
          {teamMessage ? <span className="subtle">{teamMessage}</span> : null}
          <Link className="button secondary" href="/">
            トップへ戻る
          </Link>
        </div>
      </Section>

      <div className="entry-grid">
        <GoalField
          label="オフェンス目標"
          currentValue={player.offenseGoal}
          templates={goalTemplates}
          disabled={!canManageTeam || syncing}
          onSave={(value) => persist({ ...player, offenseGoal: value }, `${player.name}のオフェンス目標を保存しました。`)}
        />
        <GoalField
          label="ディフェンス目標"
          currentValue={player.defenseGoal}
          templates={goalTemplates}
          disabled={!canManageTeam || syncing}
          onSave={(value) => persist({ ...player, defenseGoal: value }, `${player.name}のディフェンス目標を保存しました。`)}
        />
        <ReflectionField
          label="オフェンス振り返り"
          currentValue={player.offenseReflection}
          disabled={!canManageTeam || syncing}
          onSave={(value) =>
            persist({ ...player, offenseReflection: value }, `${player.name}のオフェンス振り返りを保存しました。`)
          }
        />
        <ReflectionField
          label="ディフェンス振り返り"
          currentValue={player.defenseReflection}
          disabled={!canManageTeam || syncing}
          onSave={(value) =>
            persist({ ...player, defenseReflection: value }, `${player.name}のディフェンス振り返りを保存しました。`)
          }
        />
      </div>
    </div>
  );
}
