"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import { Section } from "@/components/section";
import { insertPlayer, updatePlayer } from "@/lib/data-store";
import { Player, PositionMaster } from "@/lib/types";
import { getPositionLabel, getPositionsBySide } from "@/lib/utils";

type TeamAdminProps = {
  canManageTeam: boolean;
  dataLoading: boolean;
  players: Player[];
  positionMasters: PositionMaster[];
  setPlayers: Dispatch<SetStateAction<Player[]>>;
  setTeamMessage: Dispatch<SetStateAction<string | null>>;
  supabase: SupabaseClient | null;
  syncing: boolean;
  setSyncing: Dispatch<SetStateAction<boolean>>;
  teamMessage: string | null;
  usingRemoteData: boolean;
  onResetLocalMode: () => void;
};

type PlayerForm = {
  name: string;
  jerseyNumber: string;
  gradeLabel: string;
  guardianName: string;
  favoriteSkill: string;
  offensePositionId: string;
  defensePositionId: string;
  active: boolean;
};

function createInitialPlayerForm(positionMasters: PositionMaster[]): PlayerForm {
  return {
    name: "",
    jerseyNumber: "",
    gradeLabel: "1ねん",
    guardianName: "",
    favoriteSkill: "",
    offensePositionId: getPositionsBySide("offense", positionMasters)[0]?.id ?? "",
    defensePositionId: getPositionsBySide("defense", positionMasters)[0]?.id ?? "",
    active: true,
  };
}

function createFormFromPlayer(player: Player): PlayerForm {
  return {
    name: player.name,
    jerseyNumber: player.jerseyNumber,
    gradeLabel: player.gradeLabel,
    guardianName: player.guardianName,
    favoriteSkill: player.favoriteSkill,
    offensePositionId: player.offensePositionId,
    defensePositionId: player.defensePositionId,
    active: player.active,
  };
}

export function TeamAdmin({
  canManageTeam,
  dataLoading,
  players,
  positionMasters,
  setPlayers,
  setTeamMessage,
  supabase,
  syncing,
  setSyncing,
  teamMessage,
  usingRemoteData,
  onResetLocalMode,
}: TeamAdminProps) {
  const offensePositions = getPositionsBySide("offense", positionMasters);
  const defensePositions = getPositionsBySide("defense", positionMasters);
  const defaultForm = useMemo(() => createInitialPlayerForm(positionMasters), [positionMasters]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [createForm, setCreateForm] = useState<PlayerForm>(defaultForm);
  const [editForm, setEditForm] = useState<PlayerForm>(defaultForm);

  useEffect(() => {
    setCreateForm((current) => ({
      ...current,
      offensePositionId: current.offensePositionId || defaultForm.offensePositionId,
      defensePositionId: current.defensePositionId || defaultForm.defensePositionId,
    }));
    setEditForm((current) => ({
      ...current,
      offensePositionId: current.offensePositionId || defaultForm.offensePositionId,
      defensePositionId: current.defensePositionId || defaultForm.defensePositionId,
    }));
  }, [defaultForm.defensePositionId, defaultForm.offensePositionId]);

  useEffect(() => {
    if (selectedPlayerId && players.some((player) => player.id === selectedPlayerId)) {
      return;
    }

    setSelectedPlayerId(players[0]?.id ?? "");
  }, [players, selectedPlayerId]);

  useEffect(() => {
    const selectedPlayer = players.find((player) => player.id === selectedPlayerId);

    if (!selectedPlayer) {
      setEditForm(defaultForm);
      return;
    }

    setEditForm(createFormFromPlayer(selectedPlayer));
  }, [defaultForm, players, selectedPlayerId]);

  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? null;

  function updateCreateForm<Key extends keyof PlayerForm>(key: Key, value: PlayerForm[Key]) {
    setCreateForm((current) => ({ ...current, [key]: value }));
  }

  function updateEditForm<Key extends keyof PlayerForm>(key: Key, value: PlayerForm[Key]) {
    setEditForm((current) => ({ ...current, [key]: value }));
  }

  async function handleCreatePlayer() {
    if (!canManageTeam || syncing || !createForm.name.trim() || !createForm.guardianName.trim()) {
      return;
    }

    const nextPlayer = {
      ...createForm,
      name: createForm.name.trim(),
      gradeLabel: createForm.gradeLabel.trim(),
      guardianName: createForm.guardianName.trim(),
      favoriteSkill: createForm.favoriteSkill.trim() || "これから見つける",
    };

    try {
      setSyncing(true);

      const savedPlayer =
        usingRemoteData && supabase
          ? await insertPlayer(supabase, nextPlayer)
          : { id: `p${Date.now()}`, ...nextPlayer };

      setPlayers((current) => [savedPlayer, ...current]);
      setSelectedPlayerId(savedPlayer.id);
      setCreateForm(defaultForm);
      setTeamMessage(`選手「${savedPlayer.name}」を追加しました。`);
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : "選手の追加に失敗しました。");
    } finally {
      setSyncing(false);
    }
  }

  async function handleSavePlayer() {
    if (!canManageTeam || syncing || !selectedPlayer) {
      return;
    }

    const nextPlayer: Player = {
      ...selectedPlayer,
      ...editForm,
      name: editForm.name.trim(),
      gradeLabel: editForm.gradeLabel.trim(),
      guardianName: editForm.guardianName.trim(),
      favoriteSkill: editForm.favoriteSkill.trim() || "これから見つける",
    };

    if (!nextPlayer.name || !nextPlayer.guardianName) {
      return;
    }

    try {
      setSyncing(true);

      if (usingRemoteData && supabase) {
        await updatePlayer(supabase, nextPlayer);
      }

      setPlayers((current) => current.map((player) => (player.id === nextPlayer.id ? nextPlayer : player)));
      setTeamMessage(`選手「${nextPlayer.name}」の属性を更新しました。`);
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : "選手の更新に失敗しました。");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="dashboard dashboard-wide">
      <div className="stack">
        <Section
          title="選手管理"
          copy="追加、学年、保護者、とくいなこと、攻守ポジションをこのページで管理できます。ポジション候補はマスター管理ページで変更できます。"
        >
          <div className="status-strip">
            <span className={`chip ${usingRemoteData ? "ok" : "warn"}`}>
              {dataLoading ? "読込中" : usingRemoteData ? "Supabase同期中" : "ローカル保存中"}
            </span>
            {syncing ? <span className="chip">保存しています…</span> : null}
            {teamMessage ? <span className="subtle">{teamMessage}</span> : null}
            {!usingRemoteData ? (
              <button className="button ghost" type="button" onClick={onResetLocalMode} disabled={syncing}>
                体験データに戻す
              </button>
            ) : null}
          </div>

          <div className="admin-grid">
            <div className="panel inset-panel">
              <div className="panel-body">
                <h3 className="section-title">新しい選手を追加</h3>
                <div className="admin-form">
                  <input type="text" placeholder="選手名" value={createForm.name} onChange={(event) => updateCreateForm("name", event.target.value)} disabled={!canManageTeam || syncing} />
                  <input type="text" placeholder="背番号" value={createForm.jerseyNumber} onChange={(event) => updateCreateForm("jerseyNumber", event.target.value)} disabled={!canManageTeam || syncing} />
                  <input type="text" placeholder="1ねん / 2ねん" value={createForm.gradeLabel} onChange={(event) => updateCreateForm("gradeLabel", event.target.value)} disabled={!canManageTeam || syncing} />
                  <input type="text" placeholder="保護者名" value={createForm.guardianName} onChange={(event) => updateCreateForm("guardianName", event.target.value)} disabled={!canManageTeam || syncing} />
                  <input type="text" placeholder="とくいなこと" value={createForm.favoriteSkill} onChange={(event) => updateCreateForm("favoriteSkill", event.target.value)} disabled={!canManageTeam || syncing} />
                  <select value={createForm.offensePositionId} onChange={(event) => updateCreateForm("offensePositionId", event.target.value)} disabled={!canManageTeam || syncing}>
                    {offensePositions.map((position) => (
                      <option key={position.id} value={position.id}>{position.label}</option>
                    ))}
                  </select>
                  <select value={createForm.defensePositionId} onChange={(event) => updateCreateForm("defensePositionId", event.target.value)} disabled={!canManageTeam || syncing}>
                    {defensePositions.map((position) => (
                      <option key={position.id} value={position.id}>{position.label}</option>
                    ))}
                  </select>
                  <button className="button" type="button" onClick={handleCreatePlayer} disabled={!canManageTeam || syncing}>
                    選手を追加
                  </button>
                </div>
              </div>
            </div>

            <div className="panel inset-panel">
              <div className="panel-body">
                <h3 className="section-title">登録済み選手</h3>
                {players.length ? (
                  <div className="admin-player-list">
                    {players.map((player) => (
                      <button key={player.id} className={`admin-player-item ${player.id === selectedPlayerId ? "is-selected" : ""}`} type="button" onClick={() => setSelectedPlayerId(player.id)}>
                        <strong>{player.name}</strong>
                        <span>{player.jerseyNumber ? `#${player.jerseyNumber} / ${player.gradeLabel}` : player.gradeLabel}</span>
                        <span className={`chip ${player.active ? "ok" : "warn"}`}>{player.active ? "在籍中" : "休会"}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">まだ選手がいません。</p>
                )}
              </div>
            </div>
          </div>
        </Section>

        <Section title="選手属性の編集" copy="選手を選ぶと、担当ポジションや在籍状態をまとめて変更できます。">
          {selectedPlayer ? (
            <div className="admin-edit-card">
              <div className="admin-form">
                <input type="text" value={editForm.name} onChange={(event) => updateEditForm("name", event.target.value)} disabled={!canManageTeam || syncing} />
                <input type="text" value={editForm.jerseyNumber} onChange={(event) => updateEditForm("jerseyNumber", event.target.value)} disabled={!canManageTeam || syncing} />
                <input type="text" value={editForm.gradeLabel} onChange={(event) => updateEditForm("gradeLabel", event.target.value)} disabled={!canManageTeam || syncing} />
                <input type="text" value={editForm.guardianName} onChange={(event) => updateEditForm("guardianName", event.target.value)} disabled={!canManageTeam || syncing} />
                <input type="text" value={editForm.favoriteSkill} onChange={(event) => updateEditForm("favoriteSkill", event.target.value)} disabled={!canManageTeam || syncing} />
                <select value={editForm.offensePositionId} onChange={(event) => updateEditForm("offensePositionId", event.target.value)} disabled={!canManageTeam || syncing}>
                  {offensePositions.map((position) => (
                    <option key={position.id} value={position.id}>{position.label}</option>
                  ))}
                </select>
                <select value={editForm.defensePositionId} onChange={(event) => updateEditForm("defensePositionId", event.target.value)} disabled={!canManageTeam || syncing}>
                  {defensePositions.map((position) => (
                    <option key={position.id} value={position.id}>{position.label}</option>
                  ))}
                </select>
                <label className="checkbox-row">
                  <input type="checkbox" checked={editForm.active} onChange={(event) => updateEditForm("active", event.target.checked)} disabled={!canManageTeam || syncing} />
                  在籍中
                </label>
              </div>

              <div className="chip-row">
                <span className="chip">オフェンス: {getPositionLabel(editForm.offensePositionId, positionMasters)}</span>
                <span className="chip">ディフェンス: {getPositionLabel(editForm.defensePositionId, positionMasters)}</span>
              </div>

              <div className="card-actions">
                <button className="button" type="button" onClick={handleSavePlayer} disabled={!canManageTeam || syncing}>
                  変更を保存
                </button>
              </div>
            </div>
          ) : (
            <p className="empty-state">編集する選手を選ぶと、ここで属性を変更できます。</p>
          )}
        </Section>
      </div>
    </div>
  );
}
