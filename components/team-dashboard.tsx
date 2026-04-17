"use client";

import { formatDisplayDate, getDashboardPracticeDate } from "@/lib/date";
import { Player, PositionMaster, Season, SeasonGoal, TeamRole } from "@/lib/types";
import { getPositionLabels, getPracticeEntry, getReflectionEmoji } from "@/lib/utils";
import Link from "next/link";
import { useMemo, useState } from "react";

type TeamDashboardProps = {
  players: Player[];
  positionMasters: PositionMaster[];
  linkedPlayerIds: string[];
  teamRole: TeamRole | null;
  teamMessage: string | null;
  usingRemoteData: boolean;
  seasons: Season[];
  seasonGoals: SeasonGoal[];
  onResetLocalMode: () => void;
};

export function TeamDashboard({
  players,
  positionMasters,
  linkedPlayerIds,
  teamRole,
  teamMessage,
  usingRemoteData,
  seasons,
  seasonGoals,
  onResetLocalMode,
}: TeamDashboardProps) {
  const [searchText, setSearchText] = useState("");
  const practiceDate = getDashboardPracticeDate();

  const filteredPlayers = useMemo(() => {
    const normalizedSearch = searchText.trim();

    return players
      .filter((player) => player.name.includes(normalizedSearch))
      .sort((left, right) => {
        const leftOwn = linkedPlayerIds.includes(left.id) ? 1 : 0;
        const rightOwn = linkedPlayerIds.includes(right.id) ? 1 : 0;

        if (leftOwn !== rightOwn) {
          return rightOwn - leftOwn;
        }

        const leftNumber = Number(left.jerseyNumber);
        const rightNumber = Number(right.jerseyNumber);
        const leftHasNumber = Number.isFinite(leftNumber) && left.jerseyNumber !== "";
        const rightHasNumber = Number.isFinite(rightNumber) && right.jerseyNumber !== "";

        if (leftHasNumber && rightHasNumber && leftNumber !== rightNumber) {
          return leftNumber - rightNumber;
        }

        if (leftHasNumber !== rightHasNumber) {
          return leftHasNumber ? -1 : 1;
        }

        return left.name.localeCompare(right.name, "ja");
      });
  }, [linkedPlayerIds, players, searchText]);

  const activePlayerCount = players.filter((player) => player.active).length;
  const activeSeason = seasons.find((s) => s.active);
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
            <article className={`practice-card ${(getPracticeEntry(player, practiceDate)?.offenseGoal || getPracticeEntry(player, practiceDate)?.defenseGoal) ? "has-goal" : "is-missing-goal"} ${linkedPlayerIds.includes(player.id) ? "is-linked-player" : ""}`} key={player.id}>
              <div className="practice-card-link">
                <div className="practice-card-head">
                  <div>
                    <strong>
                      {linkedPlayerIds.includes(player.id) ? (
                        <span className="player-name-mark" title="うちの子" aria-label="うちの子">⭐️</span>
                      ) : null}
                      {player.jerseyNumber ? `#${player.jerseyNumber} ${player.name}` : player.name}
                    </strong>
                    <div className="subtle">
                      {getPositionLabels(player.offensePositionIds, positionMasters)} / {getPositionLabels(player.defensePositionIds, positionMasters)}
                    </div>
                  </div>
                  <span className={`chip ${player.active ? "ok" : "warn"}`}>
                    {player.active ? "在籍中" : "休会"}
                  </span>
                </div>

                <div className="chip-row compact-chip-row">
                  {(getPracticeEntry(player, practiceDate)?.offenseGoal || getPracticeEntry(player, practiceDate)?.defenseGoal) ? (
                    <span className="chip ok icon-chip" title="目標できた" aria-label="目標できた">
                      👏
                    </span>
                  ) : (
                    <span className="chip warn icon-chip" title="これからかく" aria-label="これからかく">
                      ✏️
                    </span>
                  )}
                </div>

                <div className="practice-summary">
                  <div>
                    <span>OF目標</span>
                    <strong>
                      {getPracticeEntry(player, practiceDate)?.offenseGoal ?? "未入力"}
                      {getReflectionEmoji(getPracticeEntry(player, practiceDate)?.offenseReflectionRating) ? (
                        <span className="reflection-emoji" title={`振り返り: ${getReflectionEmoji(getPracticeEntry(player, practiceDate)?.offenseReflectionRating)}`}>
                          {" "}{getReflectionEmoji(getPracticeEntry(player, practiceDate)?.offenseReflectionRating)}
                        </span>
                      ) : null}
                    </strong>
                  </div>
                  <div>
                    <span>DF目標</span>
                    <strong>
                      {getPracticeEntry(player, practiceDate)?.defenseGoal ?? "未入力"}
                      {getReflectionEmoji(getPracticeEntry(player, practiceDate)?.defenseReflectionRating) ? (
                        <span className="reflection-emoji" title={`振り返り: ${getReflectionEmoji(getPracticeEntry(player, practiceDate)?.defenseReflectionRating)}`}>
                          {" "}{getReflectionEmoji(getPracticeEntry(player, practiceDate)?.defenseReflectionRating)}
                        </span>
                      ) : null}
                    </strong>
                  </div>
                </div>

                <div className="practice-actions">
                  <Link className="button secondary button-compact" href={`/players/${player.id}/goals?date=${practiceDate}`}>
                    {teamRole === "guardian" && !linkedPlayerIds.includes(player.id) ? "目標を見る" : "週次目標"}
                  </Link>
                  {getPracticeEntry(player, practiceDate)?.offenseGoal || getPracticeEntry(player, practiceDate)?.defenseGoal ? (
                    <Link className="button button-compact" href={`/players/${player.id}/reflections?date=${practiceDate}`}>
                      {teamRole === "guardian" && !linkedPlayerIds.includes(player.id) ? "振り返りを見る" : "振り返り"}
                    </Link>
                  ) : (
                    <span className="button button-compact is-disabled">振り返り</span>
                  )}
                </div>

                {activeSeason ? (() => {
                  const sg = seasonGoals.find((g) => g.playerId === player.id && g.seasonId === activeSeason.id);
                  return (
                    <div className="season-goal-summary">
                      <span className="season-goal-label">🏆 {activeSeason.label}</span>
                      {sg?.offenseGoal || sg?.defenseGoal ? (
                        <span className="season-goal-text">{sg.offenseGoal ?? ""}{sg.offenseGoal && sg.defenseGoal ? " / " : ""}{sg.defenseGoal ?? ""}</span>
                      ) : null}
                      <Link className="button secondary button-compact" href={`/players/${player.id}/season-goals`}>
                        {sg ? "シーズン目標" : "シーズン目標を設定"}
                      </Link>
                    </div>
                  );
                })() : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
