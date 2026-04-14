"use client";

import { formatDisplayDate, getDashboardPracticeDate } from "@/lib/date";
import { Player, PositionMaster } from "@/lib/types";
import { getPositionLabel, getPracticeEntry } from "@/lib/utils";
import Link from "next/link";
import { useMemo, useState } from "react";

type TeamDashboardProps = {
  dataLoading: boolean;
  players: Player[];
  positionMasters: PositionMaster[];
  teamMessage: string | null;
  usingRemoteData: boolean;
  onResetLocalMode: () => void;
};

export function TeamDashboard({
  dataLoading,
  players,
  positionMasters,
  teamMessage,
  usingRemoteData,
  onResetLocalMode,
}: TeamDashboardProps) {
  const [searchText, setSearchText] = useState("");
  const practiceDate = getDashboardPracticeDate();

  const filteredPlayers = useMemo(
    () =>
      players.filter((player) => {
        return player.name.includes(searchText.trim());
      }),
    [players, searchText],
  );

  const activePlayerCount = players.filter((player) => player.active).length;
  const completedReflectionCount = players.filter(
    (player) => {
      const entry = getPracticeEntry(player, practiceDate);
      return entry?.offenseReflectionRating && entry?.defenseReflectionRating;
    },
  ).length;
  const completionRatio = activePlayerCount ? Math.round((completedReflectionCount / activePlayerCount) * 100) : 0;

  return (
    <div className="stack dashboard-simple">
      <section className="week-panel">
        <div className="week-panel-header">
          <div>
            <span className="eyebrow">フラッグフットボール</span>
            <h2>今週の練習</h2>
            <p>{formatDisplayDate(practiceDate)}週</p>
          </div>
        </div>
        <div className="progress-rail">
          <div className="progress-fill" style={{ width: `${completionRatio}%` }} />
        </div>
        <div className="week-panel-footer">
          <span>振り返り完了: {completedReflectionCount} / {activePlayerCount}人</span>
          <span>{dataLoading ? "読込中" : usingRemoteData ? "Supabase同期中" : "ローカル保存中"}</span>
        </div>
      </section>

      <div className="status-strip dashboard-status">
        {teamMessage ? <span className="subtle compact-message">{teamMessage}</span> : null}
        {!usingRemoteData ? (
          <button className="button ghost button-compact" type="button" onClick={onResetLocalMode}>
            体験データに戻す
          </button>
        ) : null}
      </div>

      <section className="player-section">
        <div className="toolbar">
          <input
            type="search"
            placeholder="選手名で検索"
            aria-label="選手名で検索"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <div className="toolbar-count">一覧 {filteredPlayers.length}人</div>
        </div>

        <div className="player-grid">
          {filteredPlayers.map((player) => (
            <article className={`practice-card ${(getPracticeEntry(player, practiceDate)?.offenseGoal || getPracticeEntry(player, practiceDate)?.defenseGoal) ? "has-goal" : "is-missing-goal"}`} key={player.id}>
              <div className="practice-card-link">
                <div className="practice-card-head">
                  <div>
                    <strong>{player.jerseyNumber ? `#${player.jerseyNumber} ${player.name}` : player.name}</strong>
                    <div className="subtle">
                      {getPositionLabel(player.offensePositionId, positionMasters)} / {getPositionLabel(player.defensePositionId, positionMasters)}
                    </div>
                  </div>
                  <span className={`chip ${player.active ? "ok" : "warn"}`}>
                    {player.active ? "在籍中" : "休会"}
                  </span>
                </div>

                <div className="chip-row compact-chip-row">
                  <span className={`chip ${(getPracticeEntry(player, practiceDate)?.offenseGoal || getPracticeEntry(player, practiceDate)?.defenseGoal) ? "ok" : "warn"}`}>
                    {(getPracticeEntry(player, practiceDate)?.offenseGoal || getPracticeEntry(player, practiceDate)?.defenseGoal) ? "目標設定済み" : "目標未設定"}
                  </span>
                </div>

                <div className="practice-summary">
                  <div>
                    <span>OF目標</span>
                    <strong>{getPracticeEntry(player, practiceDate)?.offenseGoal ?? "未入力"}</strong>
                  </div>
                  <div>
                    <span>DF目標</span>
                    <strong>{getPracticeEntry(player, practiceDate)?.defenseGoal ?? "未入力"}</strong>
                  </div>
                </div>

                <div className="practice-actions">
                  <Link className="button secondary button-compact" href={`/players/${player.id}/goals?date=${practiceDate}`}>
                    目標
                  </Link>
                  {getPracticeEntry(player, practiceDate)?.offenseGoal || getPracticeEntry(player, practiceDate)?.defenseGoal ? (
                    <Link className="button button-compact" href={`/players/${player.id}/reflections?date=${practiceDate}`}>
                      振り返り
                    </Link>
                  ) : (
                    <span className="button button-compact is-disabled">振り返り</span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
