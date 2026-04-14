"use client";

import { formatDateInput } from "@/lib/date";
import {
  GoalLog,
  GoalTemplate,
  GradeBand,
  Material,
  Player,
  PositionMaster,
} from "@/lib/types";
import { getPositionLabel } from "@/lib/utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";

type TeamDashboardProps = {
  canManageTeam: boolean;
  dataLoading: boolean;
  goalLogs: GoalLog[];
  goalTemplates: GoalTemplate[];
  materials: Material[];
  players: Player[];
  positionMasters: PositionMaster[];
  setTeamMessage: Dispatch<SetStateAction<string | null>>;
  setGoalLogs: Dispatch<SetStateAction<GoalLog[]>>;
  setMaterials: Dispatch<SetStateAction<Material[]>>;
  setPlayers: Dispatch<SetStateAction<Player[]>>;
  supabase: SupabaseClient | null;
  syncing: boolean;
  setSyncing: Dispatch<SetStateAction<boolean>>;
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
  const [gradeFilter, setGradeFilter] = useState<"all" | GradeBand>("all");

  const filteredPlayers = useMemo(
    () =>
      players.filter((player) => {
        const matchesSearch = player.name.includes(searchText.trim());
        const matchesGrade = gradeFilter === "all" ? true : player.gradeBand === gradeFilter;

        return matchesSearch && matchesGrade;
      }),
    [gradeFilter, players, searchText],
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
          {/*<span className="coach-badge">コーチ</span>*/}
        </div>
        <div className="progress-rail">
          <div className="progress-fill" style={{ width: `${completionRatio}%` }} />
        </div>
        <div className="week-panel-footer">
          <span>振り返り完了: {completedReflectionCount} / {activePlayerCount}人</span>
          <span>{dataLoading ? "読込中" : usingRemoteData ? "Supabase同期中" : "ローカル保存中"}</span>
        </div>
      </section>

      <div className="status-strip">
        {teamMessage ? <span className="subtle">{teamMessage}</span> : null}
        <Link className="button secondary" href="/players">
          選手管理
        </Link>
        <Link className="button secondary" href="/masters">
          マスター管理
        </Link>
        {!usingRemoteData ? (
          <button className="button ghost" type="button" onClick={onResetLocalMode}>
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
          <select
            aria-label="学年帯"
            value={gradeFilter}
            onChange={(event) => setGradeFilter(event.target.value as "all" | GradeBand)}
          >
            <option value="all">全学年</option>
            <option value="lower">低学年</option>
            <option value="middle">中学年</option>
            <option value="upper">高学年</option>
          </select>
          <div className="toolbar-count">一覧 {filteredPlayers.length}人</div>
        </div>

        <div className="player-grid">
          {filteredPlayers.map((player) => (
            <Link className="practice-card-link" href={`/players/${player.id}`} key={player.id}>
              <article className="practice-card">
                <div className="practice-card-head">
                  <div>
                    <strong>{player.name}</strong>
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
                  <span className="button">目標 / 振り返り</span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
