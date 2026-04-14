"use client";

import { formatDateInput } from "@/lib/date";
import { Player, PositionMaster } from "@/lib/types";
import { getPositionLabel } from "@/lib/utils";
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

function getWeekLabel() {
  return `${formatDateInput().replace(/-/g, "/")}週`;
}

export function TeamDashboard({
  dataLoading,
  players,
  positionMasters,
  teamMessage,
  usingRemoteData,
  onResetLocalMode,
}: TeamDashboardProps) {
  const [searchText, setSearchText] = useState("");

  const filteredPlayers = useMemo(
    () =>
      players.filter((player) => {
        return player.name.includes(searchText.trim());
      }),
    [players, searchText],
  );

  const activePlayerCount = players.filter((player) => player.active).length;
  const completedReflectionCount = players.filter(
    (player) => player.offenseReflection?.trim() && player.defenseReflection?.trim(),
  ).length;
  const completionRatio = activePlayerCount ? Math.round((completedReflectionCount / activePlayerCount) * 100) : 0;

  return (
    <div className="stack dashboard-simple">
      <section className="week-panel">
        <div className="week-panel-header">
          <div>
            <span className="eyebrow">フラッグフットボール</span>
            <h2>今週の練習</h2>
            <p>{getWeekLabel()}</p>
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
            <Link className="practice-card-link" href={`/players/${player.id}`} key={player.id}>
              <article className="practice-card">
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

                <div className="practice-summary">
                  <div>
                    <span>OF目標</span>
                    <strong>{player.offenseGoal ?? "未入力"}</strong>
                  </div>
                  <div>
                    <span>DF目標</span>
                    <strong>{player.defenseGoal ?? "未入力"}</strong>
                  </div>
                </div>

                <div className="practice-actions">
                  <span className="button button-compact">入力する</span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
