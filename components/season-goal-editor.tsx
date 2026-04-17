"use client";

import { Section } from "@/components/section";
import { upsertSeasonGoal } from "@/lib/data-store";
import { formatDisplayDate } from "@/lib/date";
import { Player, PositionMaster, ReflectionRating, Season, SeasonGoal } from "@/lib/types";
import { getPositionLabels } from "@/lib/utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";

type SeasonGoalEditorProps = {
  canEditPlayer: boolean;
  player: Player | null;
  positionMasters: PositionMaster[];
  seasons: Season[];
  seasonGoals: SeasonGoal[];
  setSeasonGoals: Dispatch<SetStateAction<SeasonGoal[]>>;
  setTeamMessage: Dispatch<SetStateAction<string | null>>;
  supabase: SupabaseClient | null;
  syncing: boolean;
  setSyncing: Dispatch<SetStateAction<boolean>>;
  teamMessage: string | null;
  usingRemoteData: boolean;
  linkedPlayerIds: string[];
};

const reflectionChoices: Array<{ value: ReflectionRating; label: string; emoji: string }> = [
  { value: 5, label: "かんぺき", emoji: "🏆" },
  { value: 4, label: "すごくできた", emoji: "🌟" },
  { value: 3, label: "できた", emoji: "👏" },
  { value: 2, label: "もうすこし", emoji: "🙂" },
  { value: 1, label: "いまから", emoji: "🌱" },
];

export function SeasonGoalEditor({
  canEditPlayer,
  player,
  positionMasters,
  seasons,
  seasonGoals,
  setSeasonGoals,
  setTeamMessage,
  supabase,
  syncing,
  setSyncing,
  teamMessage,
  usingRemoteData,
  linkedPlayerIds,
}: SeasonGoalEditorProps) {
  const activeSeason = seasons.find((s) => s.active);
  const [selectedSeasonId, setSelectedSeasonId] = useState(activeSeason?.id ?? seasons[0]?.id ?? "");
  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId);
  const existingGoal = seasonGoals.find((g) => g.playerId === player?.id && g.seasonId === selectedSeasonId);

  const isPastTarget = selectedSeason ? selectedSeason.targetDate < new Date().toISOString().slice(0, 10) : false;
  const showReflection = isPastTarget || Boolean(existingGoal?.offenseReflectionRating || existingGoal?.defenseReflectionRating);

  const [offGoal, setOffGoal] = useState(existingGoal?.offenseGoal ?? "");
  const [defGoal, setDefGoal] = useState(existingGoal?.defenseGoal ?? "");
  const [offRating, setOffRating] = useState<ReflectionRating | undefined>(existingGoal?.offenseReflectionRating);
  const [offComment, setOffComment] = useState(existingGoal?.offenseReflectionComment ?? "");
  const [defRating, setDefRating] = useState<ReflectionRating | undefined>(existingGoal?.defenseReflectionRating);
  const [defComment, setDefComment] = useState(existingGoal?.defenseReflectionComment ?? "");

  function syncFormFromGoal(goal: SeasonGoal | undefined) {
    setOffGoal(goal?.offenseGoal ?? "");
    setDefGoal(goal?.defenseGoal ?? "");
    setOffRating(goal?.offenseReflectionRating);
    setOffComment(goal?.offenseReflectionComment ?? "");
    setDefRating(goal?.defenseReflectionRating);
    setDefComment(goal?.defenseReflectionComment ?? "");
  }

  function handleSeasonChange(id: string) {
    setSelectedSeasonId(id);
    const goal = seasonGoals.find((g) => g.playerId === player?.id && g.seasonId === id);
    syncFormFromGoal(goal);
  }

  async function handleSave() {
    if (!player || !selectedSeasonId) return;
    const now = new Date().toISOString().slice(0, 10);
    const next: SeasonGoal = {
      id: existingGoal?.id ?? `sg-${Date.now()}`,
      playerId: player.id,
      seasonId: selectedSeasonId,
      offenseGoal: offGoal.trim() || undefined,
      defenseGoal: defGoal.trim() || undefined,
      offenseReflectionRating: offRating,
      offenseReflectionComment: offComment.trim() || undefined,
      defenseReflectionRating: defRating,
      defenseReflectionComment: defComment.trim() || undefined,
      createdAt: existingGoal?.createdAt ?? now,
      updatedAt: now,
    };

    try {
      setSyncing(true);
      if (usingRemoteData && supabase) {
        const saved = await upsertSeasonGoal(supabase, next);
        setSeasonGoals((prev) => {
          const without = prev.filter((g) => !(g.playerId === saved.playerId && g.seasonId === saved.seasonId));
          return [saved, ...without];
        });
      } else {
        setSeasonGoals((prev) => {
          const without = prev.filter((g) => !(g.playerId === next.playerId && g.seasonId === next.seasonId));
          return [next, ...without];
        });
      }
      setTeamMessage(`${player.name}のシーズン目標を保存しました。`);
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : "保存に失敗しました。");
    } finally {
      setSyncing(false);
    }
  }

  if (!player) {
    return (
      <Section title="シーズン目標" copy="対象の選手が見つかりませんでした。">
        <Link className="button secondary" href="/">トップへ戻る</Link>
      </Section>
    );
  }

  if (!seasons.length) {
    return (
      <Section title="シーズン目標" copy="シーズンがまだ登録されていません。コーチに確認してください。">
        <Link className="button secondary" href="/">トップへ戻る</Link>
      </Section>
    );
  }

  const pageCopy = `${player.jerseyNumber ? `#${player.jerseyNumber} / ` : ""}${player.gradeLabel} / OF: ${getPositionLabels(player.offensePositionIds, positionMasters)} / DF: ${getPositionLabels(player.defensePositionIds, positionMasters)}`;
  const isLinked = linkedPlayerIds.includes(player.id);
  const disabled = !canEditPlayer || syncing;

  return (
    <div className="stack practice-editor-page">
      <Section title={`${player.name}のシーズン目標`} copy={pageCopy}>
        <div className="status-strip">
          {teamMessage ? <span className="subtle compact-message">{teamMessage}</span> : null}
          {!canEditPlayer ? <span className="chip">閲覧のみ</span> : null}
          {isLinked ? (
            <span className="chip ok icon-chip" title="うちの子" aria-label="うちの子">
              ⭐
            </span>
          ) : null}
          <label className="field-stack week-select">
            <span className="field-label">シーズン</span>
            <select value={selectedSeasonId} onChange={(e) => handleSeasonChange(e.target.value)}>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}{s.active ? " (現在)" : ""}
                </option>
              ))}
            </select>
          </label>
          {selectedSeason ? (
            <span className="chip">{formatDisplayDate(selectedSeason.startDate)} 〜 {formatDisplayDate(selectedSeason.targetDate)}</span>
          ) : null}
          <Link className="button secondary" href="/">トップへ戻る</Link>
        </div>
      </Section>

      <div className="season-goal-form">
        <div className="entry-card">
          <span className="entry-label">🏈 オフェンス目標</span>
          <input type="text" placeholder="大会までに達成したいこと" value={offGoal} onChange={(e) => setOffGoal(e.target.value)} disabled={disabled} />
          <span className="entry-label">🛡️ ディフェンス目標</span>
          <input type="text" placeholder="大会までに達成したいこと" value={defGoal} onChange={(e) => setDefGoal(e.target.value)} disabled={disabled} />

          {showReflection ? (
            <>
              <div className="divider" />
              <span className="entry-label">オフェンス振り返り</span>
              <div className="rating-grid">
                {reflectionChoices.map((c) => (
                  <button key={c.value} className={`rating-button ${offRating === c.value ? "is-active" : ""}`} type="button" disabled={disabled} onClick={() => setOffRating(c.value)}>
                    <span>{c.emoji}</span>
                    <strong>{c.label}</strong>
                  </button>
                ))}
              </div>
              <input type="text" placeholder="コメント（任意）" value={offComment} onChange={(e) => setOffComment(e.target.value)} disabled={disabled} />

              <span className="entry-label">ディフェンス振り返り</span>
              <div className="rating-grid">
                {reflectionChoices.map((c) => (
                  <button key={c.value} className={`rating-button ${defRating === c.value ? "is-active" : ""}`} type="button" disabled={disabled} onClick={() => setDefRating(c.value)}>
                    <span>{c.emoji}</span>
                    <strong>{c.label}</strong>
                  </button>
                ))}
              </div>
              <input type="text" placeholder="コメント（任意）" value={defComment} onChange={(e) => setDefComment(e.target.value)} disabled={disabled} />
            </>
          ) : null}

          <button className="button" type="button" onClick={handleSave} disabled={disabled || (!offGoal.trim() && !defGoal.trim())}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
