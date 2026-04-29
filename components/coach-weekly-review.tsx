"use client";

import { Section } from "@/components/section";
import {
  buildCoachReviewDateOptions,
  classifyCoachReviewEntry,
  type CoachReviewStatus,
  type CoachReviewStatusFilter,
  filterCoachReviewPlayers,
  getCoachReviewSummary,
  sortCoachReviewPlayers,
} from "@/lib/coach-weekly-review";
import { formatDisplayDate, getDashboardPracticeDate } from "@/lib/date";
import type { Player, PlayerPracticeEntry, PositionMaster, TeamRole } from "@/lib/types";
import { getPositionLabels, getPracticeEntry, getReflectionEmoji } from "@/lib/utils";
import Link from "next/link";
import { useMemo, useState } from "react";

type CoachWeeklyReviewProps = {
  players: Player[];
  positionMasters: PositionMaster[];
  linkedPlayerIds: string[];
  teamRole: TeamRole | null;
  teamMessage: string | null;
};

const statusOptions: Array<{ value: CoachReviewStatusFilter; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "needs-attention", label: "確認が必要" },
  { value: "missing-goal", label: "目標なし" },
  { value: "goal-only", label: "目標のみ" },
  { value: "partial-reflection", label: "振り返り途中" },
  { value: "complete", label: "振り返り完了" },
];

const statusLabels: Record<CoachReviewStatus, string> = {
  "missing-goal": "目標なし",
  "goal-only": "目標のみ",
  "partial-reflection": "振り返り途中",
  complete: "振り返り完了",
};

type ReviewSideProps = {
  label: "OF" | "DF";
  goal?: string;
  rating?: PlayerPracticeEntry["offenseReflectionRating"];
  comment?: string;
};

function ReviewSide({ label, goal, rating, comment }: ReviewSideProps) {
  const trimmedGoal = goal?.trim();
  const trimmedComment = comment?.trim();
  const emoji = getReflectionEmoji(rating);

  return (
    <div className="weekly-review-side">
      <span>{label}</span>
      <strong>{trimmedGoal || "未入力"}</strong>
      {rating ? (
        <div className="weekly-review-reflection">
          <span className="chip ok">{emoji ? `${emoji} ` : ""}{rating}</span>
          {trimmedComment ? <p>{trimmedComment}</p> : <p className="subtle">コメントなし</p>}
        </div>
      ) : (
        <p className="subtle">{trimmedGoal ? "振り返り未入力" : "目標を入れると振り返れます"}</p>
      )}
    </div>
  );
}

export function CoachWeeklyReview({
  players,
  positionMasters,
  linkedPlayerIds,
  teamRole,
  teamMessage,
}: CoachWeeklyReviewProps) {
  const defaultPracticeDate = getDashboardPracticeDate();
  const [selectedPracticeDate, setSelectedPracticeDate] = useState(defaultPracticeDate);
  const [statusFilter, setStatusFilter] = useState<CoachReviewStatusFilter>("all");
  const [searchText, setSearchText] = useState("");

  const dateOptions = useMemo(
    () => buildCoachReviewDateOptions(players, defaultPracticeDate),
    [defaultPracticeDate, players],
  );

  const visiblePlayers = useMemo(() => {
    const sortedPlayers = sortCoachReviewPlayers(players, linkedPlayerIds);
    return filterCoachReviewPlayers(sortedPlayers, searchText, statusFilter, selectedPracticeDate);
  }, [linkedPlayerIds, players, searchText, selectedPracticeDate, statusFilter]);

  const summary = useMemo(
    () => getCoachReviewSummary(players, selectedPracticeDate),
    [players, selectedPracticeDate],
  );

  if (teamRole === "guardian") {
    return (
      <Section title="週次レビュー" copy="この画面はコーチ向けです。">
        <Link className="button secondary" href="/">
          ホームへ戻る
        </Link>
      </Section>
    );
  }

  return (
    <div className="stack weekly-review-page">
      <section className="week-panel weekly-review-hero">
        <div className="week-panel-header">
          <div>
            <span className="eyebrow">Coach review</span>
            <h2>週次レビュー</h2>
            <p>{formatDisplayDate(selectedPracticeDate)}週の目標と振り返り</p>
          </div>
          <Link className="button secondary button-compact" href="/">
            ホームへ戻る
          </Link>
        </div>

        <div className="weekly-review-summary">
          <span className="chip ok">目標 {summary.playersWithGoal} / {summary.activePlayers}</span>
          <span className="chip ok">振り返り {summary.playersWithAnyReflection} / {summary.activePlayers}</span>
          <span className="chip warn">確認が必要 {summary.playersNeedingAttention}</span>
        </div>
      </section>

      {teamMessage ? (
        <div className="status-strip dashboard-status weekly-review-message">
          <span className="subtle compact-message">{teamMessage}</span>
        </div>
      ) : null}

      <section className="player-section">
        <div className="toolbar weekly-review-toolbar">
          <label className="field-stack">
            <span className="field-label">練習日</span>
            <select value={selectedPracticeDate} onChange={(event) => setSelectedPracticeDate(event.target.value)}>
              {dateOptions.map((practiceDate) => (
                <option key={practiceDate} value={practiceDate}>
                  {formatDisplayDate(practiceDate)}
                </option>
              ))}
            </select>
          </label>

          <label className="field-stack">
            <span className="field-label">状態</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as CoachReviewStatusFilter)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <input
            type="search"
            placeholder="選手名・背番号で検索"
            aria-label="選手名・背番号で検索"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <div className="toolbar-count">表示 {visiblePlayers.length}人</div>
        </div>

        <div className="weekly-review-grid">
          {visiblePlayers.map((player) => {
            const entry = getPracticeEntry(player, selectedPracticeDate);
            const classification = classifyCoachReviewEntry(entry);
            const canOpenReflection = Boolean(entry?.offenseGoal?.trim() || entry?.defenseGoal?.trim());

            return (
              <article
                className={`practice-card weekly-review-card is-${classification.status} ${
                  linkedPlayerIds.includes(player.id) ? "is-linked-player" : ""
                }`}
                key={player.id}
              >
                <div className="practice-card-head">
                  <div>
                    <strong>
                      {linkedPlayerIds.includes(player.id) ? (
                        <span className="player-name-mark" title="担当選手" aria-label="担当選手">
                          ⭐️
                        </span>
                      ) : null}
                      {player.jerseyNumber ? `#${player.jerseyNumber} ${player.name}` : player.name}
                    </strong>
                    <div className="subtle weekly-review-player-meta">
                      {player.gradeLabel} / OF: {getPositionLabels(player.offensePositionIds, positionMasters)} / DF:{" "}
                      {getPositionLabels(player.defensePositionIds, positionMasters)}
                    </div>
                  </div>

                  <div className="weekly-review-card-chips">
                    <span className={`chip ${player.active ? "ok" : "warn"}`}>
                      {player.active ? "在籍中" : "休会"}
                    </span>
                    <span className={`chip ${classification.status === "complete" ? "ok" : "warn"}`}>
                      {statusLabels[classification.status]}
                    </span>
                  </div>
                </div>

                <div className="weekly-review-sides">
                  <ReviewSide
                    label="OF"
                    goal={entry?.offenseGoal}
                    rating={entry?.offenseReflectionRating}
                    comment={entry?.offenseReflectionComment}
                  />
                  <ReviewSide
                    label="DF"
                    goal={entry?.defenseGoal}
                    rating={entry?.defenseReflectionRating}
                    comment={entry?.defenseReflectionComment}
                  />
                </div>

                <div className="practice-actions">
                  <Link
                    className="button secondary button-compact"
                    href={`/players/${player.id}/goals?date=${selectedPracticeDate}`}
                  >
                    目標を見る
                  </Link>
                  {canOpenReflection ? (
                    <Link
                      className="button button-compact"
                      href={`/players/${player.id}/reflections?date=${selectedPracticeDate}`}
                    >
                      振り返りを見る
                    </Link>
                  ) : (
                    <span className="button button-compact is-disabled">振り返り</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {visiblePlayers.length ? null : (
          <p className="empty-state">条件に合う選手がいません。検索条件や状態を変えて確認してください。</p>
        )}
      </section>
    </div>
  );
}
