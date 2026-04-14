"use client";

import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { Section } from "@/components/section";
import { updatePlayer } from "@/lib/data-store";
import { GoalTemplate, Player, PositionMaster, PositionSide, ReflectionRating } from "@/lib/types";
import { buildGoalText, getPositionLabel } from "@/lib/utils";

type EditorMode = "goal" | "reflection";

type PlayerPracticeEditorProps = {
  mode: EditorMode;
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

const reflectionChoices: Array<{
  value: ReflectionRating;
  label: string;
  emoji: string;
}> = [
  { value: 5, label: "かんぺき", emoji: "🏆" },
  { value: 4, label: "すごくできた", emoji: "🌟" },
  { value: 3, label: "できた", emoji: "👏" },
  { value: 2, label: "もうすこし", emoji: "🙂" },
  { value: 1, label: "いまから", emoji: "🌱" },
];

function GoalField({
  label,
  side,
  currentValue,
  templates,
  disabled,
  onSave,
}: {
  label: string;
  side: PositionSide;
  currentValue?: string;
  templates: GoalTemplate[];
  disabled: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [input, setInput] = useState("");

  const scopedTemplates = templates.filter((template) => template.side === side);
  const selectedTemplate = scopedTemplates.find((template) => template.id === selectedTemplateId) ?? null;
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
        {scopedTemplates.map((template) => (
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
  goal,
  rating,
  comment,
  disabled,
  onSave,
}: {
  label: string;
  goal?: string;
  rating?: ReflectionRating;
  comment?: string;
  disabled: boolean;
  onSave: (payload: { rating: ReflectionRating; comment: string }) => Promise<void>;
}) {
  const [selectedRating, setSelectedRating] = useState<ReflectionRating | undefined>(rating);
  const [input, setInput] = useState(comment ?? "");

  async function handleSave() {
    if (!selectedRating) {
      return;
    }

    await onSave({ rating: selectedRating, comment: input.trim() });
  }

  return (
    <div className="entry-card">
      <span className="entry-label">{label}</span>
      <div className="goal-preview-block">
        <span>目標</span>
        <strong>{goal ?? "先に目標を入れてください"}</strong>
      </div>
      <div className="rating-grid">
        {reflectionChoices.map((choice) => (
          <button
            key={choice.value}
            className={`rating-button ${selectedRating === choice.value ? "is-active" : ""}`}
            type="button"
            disabled={disabled || !goal}
            onClick={() => setSelectedRating(choice.value)}
          >
            <span>{choice.emoji}</span>
            <strong>{choice.label}</strong>
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder="コメントは任意"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        disabled={disabled || !goal}
      />
      <button
        className="button secondary"
        type="button"
        onClick={handleSave}
        disabled={disabled || !goal || !selectedRating}
      >
        振り返りを保存
      </button>
    </div>
  );
}

export function PlayerPracticeEditor({
  mode,
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

      setPlayers((current) => current.map((currentPlayer) => (currentPlayer.id === nextPlayer.id ? nextPlayer : currentPlayer)));
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

  const pageTitle = mode === "goal" ? "目標入力" : "振り返り入力";
  const pageCopy = `${player.jerseyNumber ? `#${player.jerseyNumber} / ` : ""}${player.gradeLabel} / OF: ${getPositionLabel(player.offensePositionId, positionMasters)} / DF: ${getPositionLabel(player.defensePositionId, positionMasters)}`;
  const canOpenReflection = Boolean(player.offenseGoal || player.defenseGoal);

  if (mode === "reflection" && !canOpenReflection) {
    return (
      <div className="stack practice-editor-page">
        <Section title={`${player.name}の振り返り入力`} copy={pageCopy}>
          <div className="status-strip">
            <span className="subtle">先に目標を入れると振り返りが使えます。</span>
            <Link className="button secondary is-current" href={`/players/${player.id}/goals`}>
              目標を入れる
            </Link>
            <Link className="button secondary" href="/">
              トップへ戻る
            </Link>
          </div>
        </Section>
      </div>
    );
  }

  return (
    <div className="stack practice-editor-page">
      <Section title={`${player.name}の${pageTitle}`} copy={pageCopy}>
        <div className="status-strip">
          {teamMessage ? <span className="subtle">{teamMessage}</span> : null}
          <Link className={`button secondary ${mode === "goal" ? "is-current" : ""}`} href={`/players/${player.id}/goals`}>
            目標
          </Link>
          {canOpenReflection ? (
            <Link className={`button secondary ${mode === "reflection" ? "is-current" : ""}`} href={`/players/${player.id}/reflections`}>
              振り返り
            </Link>
          ) : (
            <span className="button secondary is-disabled">振り返り</span>
          )}
          <Link className="button secondary" href="/">
            トップへ戻る
          </Link>
        </div>
      </Section>

      {mode === "goal" ? (
        <div className="entry-grid">
          <GoalField
            label="オフェンス目標"
            side="offense"
            currentValue={player.offenseGoal}
            templates={goalTemplates}
            disabled={!canManageTeam || syncing}
            onSave={(value) => persist({ ...player, offenseGoal: value }, `${player.name}のオフェンス目標を保存しました。`)}
          />
          <GoalField
            label="ディフェンス目標"
            side="defense"
            currentValue={player.defenseGoal}
            templates={goalTemplates}
            disabled={!canManageTeam || syncing}
            onSave={(value) => persist({ ...player, defenseGoal: value }, `${player.name}のディフェンス目標を保存しました。`)}
          />
        </div>
      ) : (
        <div className="entry-grid">
          <ReflectionField
            label="オフェンス振り返り"
            goal={player.offenseGoal}
            rating={player.offenseReflectionRating}
            comment={player.offenseReflectionComment}
            disabled={!canManageTeam || syncing}
            onSave={({ rating, comment }) =>
              persist(
                { ...player, offenseReflectionRating: rating, offenseReflectionComment: comment || undefined },
                `${player.name}のオフェンス振り返りを保存しました。`,
              )
            }
          />
          <ReflectionField
            label="ディフェンス振り返り"
            goal={player.defenseGoal}
            rating={player.defenseReflectionRating}
            comment={player.defenseReflectionComment}
            disabled={!canManageTeam || syncing}
            onSave={({ rating, comment }) =>
              persist(
                { ...player, defenseReflectionRating: rating, defenseReflectionComment: comment || undefined },
                `${player.name}のディフェンス振り返りを保存しました。`,
              )
            }
          />
        </div>
      )}
    </div>
  );
}
