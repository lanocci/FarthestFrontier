"use client";

import { Section } from "@/components/section";
import { upsertPracticeEntry } from "@/lib/data-store";
import { formatDisplayDate, getDashboardPracticeDate, getRecentPracticeDates } from "@/lib/date";
import { GoalTemplate, Player, PlayerPracticeEntry, PositionMaster, PositionSide, ReflectionRating, Season, SeasonGoal } from "@/lib/types";
import { buildGoalText, getPositionLabels, getPracticeEntry, upsertPracticeEntryForPlayer } from "@/lib/utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";

type EditorMode = "goal" | "reflection";

type PlayerPracticeEditorProps = {
  mode: EditorMode;
  initialPracticeDate?: string;
  canManageTeam: boolean;
  canEditPlayer: boolean;
  linkedPlayerIds: string[];
  goalTemplates: GoalTemplate[];
  player: Player | null;
  positionMasters: PositionMaster[];
  seasons: Season[];
  seasonGoals: SeasonGoal[];
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
    <div className="entry-card entry-card-compact">
      <span className="entry-label">{label}</span>
      {currentValue ? <strong className="current-goal-value">{currentValue}</strong> : null}
      <select
        value={selectedTemplateId}
        onChange={(e) => setSelectedTemplateId(e.target.value)}
        disabled={disabled}
      >
        <option value="">自由入力</option>
        {scopedTemplates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.emoji} {template.title}
          </option>
        ))}
      </select>
      <input
        type="text"
        placeholder={selectedTemplate?.inputPlaceholder ?? "自由入力"}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        disabled={disabled}
      />
      {preview ? <div className="preview-card preview-card-compact">{preview}</div> : null}
      <button className="button button-compact" type="button" onClick={handleSave} disabled={disabled || !preview}>
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
    <div className="entry-card entry-card-compact">
      <span className="entry-label">{label}</span>
      {goal ? <strong className="current-goal-value">{goal}</strong> : <span className="subtle">先に目標を入れてください</span>}
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
        className="button secondary button-compact"
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
  initialPracticeDate,
  canManageTeam,
  canEditPlayer,
  linkedPlayerIds,
  goalTemplates,
  player,
  positionMasters,
  seasons,
  seasonGoals,
  setPlayers,
  setTeamMessage,
  supabase,
  syncing,
  setSyncing,
  teamMessage,
  usingRemoteData,
}: PlayerPracticeEditorProps) {
  const defaultPracticeDate = initialPracticeDate ?? getDashboardPracticeDate();
  const [selectedPracticeDate, setSelectedPracticeDate] = useState(defaultPracticeDate);

  async function persist(nextPlayer: Player, nextEntry: PlayerPracticeEntry, message: string) {
    if (!canEditPlayer) {
      return;
    }

    try {
      setSyncing(true);

      if (usingRemoteData && supabase) {
        await upsertPracticeEntry(supabase, nextPlayer.id, nextEntry);
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
  const pageCopy = `${player.jerseyNumber ? `#${player.jerseyNumber} / ` : ""}${player.gradeLabel} / OF: ${getPositionLabels(player.offensePositionIds, positionMasters)} / DF: ${getPositionLabels(player.defensePositionIds, positionMasters)}`;
  const isLinkedPlayer = linkedPlayerIds.includes(player.id);
  const selectedEntry = getPracticeEntry(player, selectedPracticeDate);
  const canOpenReflection = Boolean(selectedEntry?.offenseGoal || selectedEntry?.defenseGoal);
  const practiceDateOptions = Array.from(
    new Set([...getRecentPracticeDates(6, defaultPracticeDate), ...player.practiceEntries.map((entry) => entry.practiceDate)]),
  ).sort((left, right) => right.localeCompare(left));

  if (mode === "reflection" && !canOpenReflection) {
    return (
      <div className="stack practice-editor-page">
        <Section title={`${player.name}の振り返り入力`} copy={pageCopy}>
          <div className="status-strip">
            <span className="subtle">先に目標を入れると振り返りが使えます。</span>
            <Link className="button secondary is-current" href={`/players/${player.id}/goals?date=${selectedPracticeDate}`}>
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
        <div className="practice-editor-header">
          <div className="practice-editor-header-main">
            {teamMessage ? <span className="subtle practice-editor-message">{teamMessage}</span> : null}
            <div className="practice-editor-controls">
              {!canEditPlayer ? <span className="chip">閲覧のみ</span> : null}
              <label className="field-stack week-select">
                <span className="field-label">練習日</span>
                <select value={selectedPracticeDate} onChange={(event) => setSelectedPracticeDate(event.target.value)}>
                  {practiceDateOptions.map((practiceDate) => (
                    <option key={practiceDate} value={practiceDate}>
                      {formatDisplayDate(practiceDate)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="practice-editor-actions">
                <Link className={`button secondary ${mode === "goal" ? "is-current" : ""}`} href={`/players/${player.id}/goals?date=${selectedPracticeDate}`}>
                  目標
                </Link>
                {canOpenReflection ? (
                  <Link className={`button secondary ${mode === "reflection" ? "is-current" : ""}`} href={`/players/${player.id}/reflections?date=${selectedPracticeDate}`}>
                    振り返り
                  </Link>
                ) : (
                  <span className="button secondary is-disabled">振り返り</span>
                )}
                <Link className="button secondary" href="/">
                  トップへ戻る
                </Link>
              </div>
            </div>
          </div>
          {isLinkedPlayer ? (
            <span className="chip ok icon-chip practice-editor-badge" title="うちの子" aria-label="うちの子">
              ⭐
            </span>
          ) : null}
        </div>
      </Section>

      {mode === "goal" ? (
        <div className="entry-grid">
          {(() => {
            const activeSeason = seasons.find((s) => s.active);
            const sg = activeSeason ? seasonGoals.find((g) => g.playerId === player.id && g.seasonId === activeSeason.id) : undefined;
            if (!activeSeason || !sg?.offenseGoal && !sg?.defenseGoal) return null;
            return (
              <div className="season-ref-banner" style={{ gridColumn: "1 / -1" }}>
                <span className="entry-label">🏆 {activeSeason.label}の目標</span>
                {sg?.offenseGoal ? <span>OF: {sg.offenseGoal}</span> : null}
                {sg?.defenseGoal ? <span>DF: {sg.defenseGoal}</span> : null}
              </div>
            );
          })()}
          <GoalField
            label="オフェンス目標"
            side="offense"
            currentValue={selectedEntry?.offenseGoal}
            templates={goalTemplates}
            disabled={!canManageTeam || !canEditPlayer || syncing}
            onSave={(value) => {
              const nextEntry = {
                practiceDate: selectedPracticeDate,
                ...selectedEntry,
                offenseGoal: value,
              };
              const nextPlayer = upsertPracticeEntryForPlayer(player, nextEntry);
              return persist(nextPlayer, nextEntry, `${player.name}のオフェンス目標を保存しました。`);
            }}
          />
          <GoalField
            label="ディフェンス目標"
            side="defense"
            currentValue={selectedEntry?.defenseGoal}
            templates={goalTemplates}
            disabled={!canManageTeam || !canEditPlayer || syncing}
            onSave={(value) => {
              const nextEntry = {
                practiceDate: selectedPracticeDate,
                ...selectedEntry,
                defenseGoal: value,
              };
              const nextPlayer = upsertPracticeEntryForPlayer(player, nextEntry);
              return persist(nextPlayer, nextEntry, `${player.name}のディフェンス目標を保存しました。`);
            }}
          />
        </div>
      ) : (
        <div className="entry-grid">
          <ReflectionField
            label="オフェンス振り返り"
            goal={selectedEntry?.offenseGoal}
            rating={selectedEntry?.offenseReflectionRating}
            comment={selectedEntry?.offenseReflectionComment}
            disabled={!canManageTeam || !canEditPlayer || syncing}
            onSave={({ rating, comment }) => {
              const nextEntry = {
                practiceDate: selectedPracticeDate,
                ...selectedEntry,
                offenseReflectionRating: rating,
                offenseReflectionComment: comment || undefined,
              };
              const nextPlayer = upsertPracticeEntryForPlayer(player, nextEntry);
              return persist(nextPlayer, nextEntry, `${player.name}のオフェンス振り返りを保存しました。`);
            }}
          />
          <ReflectionField
            label="ディフェンス振り返り"
            goal={selectedEntry?.defenseGoal}
            rating={selectedEntry?.defenseReflectionRating}
            comment={selectedEntry?.defenseReflectionComment}
            disabled={!canManageTeam || !canEditPlayer || syncing}
            onSave={({ rating, comment }) => {
              const nextEntry = {
                practiceDate: selectedPracticeDate,
                ...selectedEntry,
                defenseReflectionRating: rating,
                defenseReflectionComment: comment || undefined,
              };
              const nextPlayer = upsertPracticeEntryForPlayer(player, nextEntry);
              return persist(nextPlayer, nextEntry, `${player.name}のディフェンス振り返りを保存しました。`);
            }}
          />
        </div>
      )}
    </div>
  );
}
