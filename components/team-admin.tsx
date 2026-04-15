"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import { Section } from "@/components/section";
import { fetchTeamMembersForAdmin, insertPlayer, updatePlayer, updateTeamMemberPlayerIds } from "@/lib/data-store";
import { Player, PositionMaster, TeamMember } from "@/lib/types";
import { getPositionLabels, getPositionsBySide } from "@/lib/utils";

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
  offensePositionIds: string[];
  defensePositionIds: string[];
  active: boolean;
};

function createInitialPlayerForm(positionMasters: PositionMaster[]): PlayerForm {
  return {
    name: "",
    jerseyNumber: "",
    gradeLabel: "1ねん",
    guardianName: "",
    favoriteSkill: "",
    offensePositionIds: getPositionsBySide("offense", positionMasters)[0]?.id
      ? [getPositionsBySide("offense", positionMasters)[0]!.id]
      : [],
    defensePositionIds: getPositionsBySide("defense", positionMasters)[0]?.id
      ? [getPositionsBySide("defense", positionMasters)[0]!.id]
      : [],
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
    offensePositionIds: player.offensePositionIds,
    defensePositionIds: player.defensePositionIds,
    active: player.active,
  };
}

export function TeamAdmin({
  canManageTeam,
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
  const [guardianMembers, setGuardianMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    setCreateForm((current) => ({
      ...current,
      offensePositionIds: current.offensePositionIds.length ? current.offensePositionIds : defaultForm.offensePositionIds,
      defensePositionIds: current.defensePositionIds.length ? current.defensePositionIds : defaultForm.defensePositionIds,
    }));
    setEditForm((current) => ({
      ...current,
      offensePositionIds: current.offensePositionIds.length ? current.offensePositionIds : defaultForm.offensePositionIds,
      defensePositionIds: current.defensePositionIds.length ? current.defensePositionIds : defaultForm.defensePositionIds,
    }));
  }, [defaultForm.defensePositionIds, defaultForm.offensePositionIds]);

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

  useEffect(() => {
    if (!supabase || !usingRemoteData || !canManageTeam) {
      setGuardianMembers([]);
      return;
    }

    fetchTeamMembersForAdmin(supabase)
      .then((members) => {
        setGuardianMembers(members.filter((member) => member.role === "guardian" && member.status === "approved"));
      })
      .catch((error) => {
        setTeamMessage(error instanceof Error ? error.message : "保護者一覧の取得に失敗しました。");
      });
  }, [canManageTeam, setTeamMessage, supabase, usingRemoteData]);

  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? null;

  function updateCreateForm<Key extends keyof PlayerForm>(key: Key, value: PlayerForm[Key]) {
    setCreateForm((current) => ({ ...current, [key]: value }));
  }

  function updateEditForm<Key extends keyof PlayerForm>(key: Key, value: PlayerForm[Key]) {
    setEditForm((current) => ({ ...current, [key]: value }));
  }

  function togglePosition(
    formKey: "create" | "edit",
    side: "offensePositionIds" | "defensePositionIds",
    positionId: string,
  ) {
    const updater = formKey === "create" ? setCreateForm : setEditForm;

    updater((current) => {
      const currentIds = current[side];
      const nextIds = currentIds.includes(positionId)
        ? currentIds.filter((id) => id !== positionId)
        : [...currentIds, positionId];

      return {
        ...current,
        [side]: nextIds,
      };
    });
  }

  function toggleGuardianAssignment(userId: string, playerId: string) {
    setGuardianMembers((current) =>
      current.map((member) =>
        member.userId === userId
          ? {
              ...member,
              playerIds: member.playerIds.includes(playerId)
                ? member.playerIds.filter((id) => id !== playerId)
                : [...member.playerIds, playerId],
            }
          : member,
      ),
    );
  }

  async function handleCreatePlayer() {
    if (
      !canManageTeam ||
      syncing ||
      !createForm.name.trim() ||
      !createForm.guardianName.trim() ||
      !createForm.offensePositionIds.length ||
      !createForm.defensePositionIds.length
    ) {
      return;
    }

    const nextPlayer = {
      ...createForm,
      name: createForm.name.trim(),
      gradeLabel: createForm.gradeLabel.trim(),
      guardianName: createForm.guardianName.trim(),
      favoriteSkill: createForm.favoriteSkill.trim() || "これから見つける",
      practiceEntries: [],
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

    if (
      !nextPlayer.name ||
      !nextPlayer.guardianName ||
      !nextPlayer.offensePositionIds.length ||
      !nextPlayer.defensePositionIds.length
    ) {
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

  async function handleSaveGuardianLinks() {
    if (!supabase || !usingRemoteData || !canManageTeam || !selectedPlayer) {
      return;
    }

    try {
      setSyncing(true);
      await Promise.all(
        guardianMembers.map((member) => updateTeamMemberPlayerIds(supabase, member.userId, member.playerIds)),
      );
      setTeamMessage(`「${selectedPlayer.name}」の保護者ひもづけを更新しました。`);
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : "保護者ひもづけの保存に失敗しました。");
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
                  <label className="field-stack">
                    <span className="field-label">選手名</span>
                    <input type="text" placeholder="例: たろう" value={createForm.name} onChange={(event) => updateCreateForm("name", event.target.value)} disabled={!canManageTeam || syncing} />
                  </label>
                  <label className="field-stack">
                    <span className="field-label">背番号</span>
                    <input type="text" placeholder="例: 12" value={createForm.jerseyNumber} onChange={(event) => updateCreateForm("jerseyNumber", event.target.value)} disabled={!canManageTeam || syncing} />
                  </label>
                  <label className="field-stack">
                    <span className="field-label">学年</span>
                    <input type="text" placeholder="例: 1ねん / 2ねん" value={createForm.gradeLabel} onChange={(event) => updateCreateForm("gradeLabel", event.target.value)} disabled={!canManageTeam || syncing} />
                  </label>
                  <label className="field-stack">
                    <span className="field-label">保護者名</span>
                    <input type="text" placeholder="例: 田中さん" value={createForm.guardianName} onChange={(event) => updateCreateForm("guardianName", event.target.value)} disabled={!canManageTeam || syncing} />
                  </label>
                  <label className="field-stack">
                    <span className="field-label">とくいなこと</span>
                    <input type="text" placeholder="例: キャッチ" value={createForm.favoriteSkill} onChange={(event) => updateCreateForm("favoriteSkill", event.target.value)} disabled={!canManageTeam || syncing} />
                  </label>
                  <label className="field-stack">
                    <span className="field-label">オフェンスポジション</span>
                    <div className="position-picker">
                      {offensePositions.map((position) => (
                        <label className="checkbox-row" key={position.id}>
                          <input
                            type="checkbox"
                            checked={createForm.offensePositionIds.includes(position.id)}
                            onChange={() => togglePosition("create", "offensePositionIds", position.id)}
                            disabled={!canManageTeam || syncing}
                          />
                          {position.label}
                        </label>
                      ))}
                    </div>
                  </label>
                  <label className="field-stack">
                    <span className="field-label">ディフェンスポジション</span>
                    <div className="position-picker">
                      {defensePositions.map((position) => (
                        <label className="checkbox-row" key={position.id}>
                          <input
                            type="checkbox"
                            checked={createForm.defensePositionIds.includes(position.id)}
                            onChange={() => togglePosition("create", "defensePositionIds", position.id)}
                            disabled={!canManageTeam || syncing}
                          />
                          {position.label}
                        </label>
                      ))}
                    </div>
                  </label>
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
                <label className="field-stack">
                  <span className="field-label">選手名</span>
                  <input type="text" value={editForm.name} onChange={(event) => updateEditForm("name", event.target.value)} disabled={!canManageTeam || syncing} />
                </label>
                <label className="field-stack">
                  <span className="field-label">背番号</span>
                  <input type="text" value={editForm.jerseyNumber} onChange={(event) => updateEditForm("jerseyNumber", event.target.value)} disabled={!canManageTeam || syncing} />
                </label>
                <label className="field-stack">
                  <span className="field-label">学年</span>
                  <input type="text" value={editForm.gradeLabel} onChange={(event) => updateEditForm("gradeLabel", event.target.value)} disabled={!canManageTeam || syncing} />
                </label>
                <label className="field-stack">
                  <span className="field-label">保護者名</span>
                  <input type="text" value={editForm.guardianName} onChange={(event) => updateEditForm("guardianName", event.target.value)} disabled={!canManageTeam || syncing} />
                </label>
                <label className="field-stack">
                  <span className="field-label">とくいなこと</span>
                  <input type="text" value={editForm.favoriteSkill} onChange={(event) => updateEditForm("favoriteSkill", event.target.value)} disabled={!canManageTeam || syncing} />
                </label>
                <label className="field-stack">
                  <span className="field-label">オフェンスポジション</span>
                  <div className="position-picker">
                    {offensePositions.map((position) => (
                      <label className="checkbox-row" key={position.id}>
                        <input
                          type="checkbox"
                          checked={editForm.offensePositionIds.includes(position.id)}
                          onChange={() => togglePosition("edit", "offensePositionIds", position.id)}
                          disabled={!canManageTeam || syncing}
                        />
                        {position.label}
                      </label>
                    ))}
                  </div>
                </label>
                <label className="field-stack">
                  <span className="field-label">ディフェンスポジション</span>
                  <div className="position-picker">
                    {defensePositions.map((position) => (
                      <label className="checkbox-row" key={position.id}>
                        <input
                          type="checkbox"
                          checked={editForm.defensePositionIds.includes(position.id)}
                          onChange={() => togglePosition("edit", "defensePositionIds", position.id)}
                          disabled={!canManageTeam || syncing}
                        />
                        {position.label}
                      </label>
                    ))}
                  </div>
                </label>
                <label className="field-stack">
                  <span className="field-label">在籍状態</span>
                  <span className="checkbox-row">
                    <input type="checkbox" checked={editForm.active} onChange={(event) => updateEditForm("active", event.target.checked)} disabled={!canManageTeam || syncing} />
                    在籍中
                  </span>
                </label>
              </div>

              <div className="chip-row">
                <span className="chip">オフェンス: {getPositionLabels(editForm.offensePositionIds, positionMasters)}</span>
                <span className="chip">ディフェンス: {getPositionLabels(editForm.defensePositionIds, positionMasters)}</span>
              </div>

              <div className="card-actions">
                <button className="button" type="button" onClick={handleSavePlayer} disabled={!canManageTeam || syncing}>
                  変更を保存
                </button>
              </div>

              {usingRemoteData ? (
                <div className="panel inset-panel">
                  <div className="panel-body">
                    <h3 className="section-title">保護者ひもづけ</h3>
                    <p className="subtle">この選手を編集できる保護者を選びます。選ばれていない保護者は閲覧のみです。</p>
                    <div className="position-picker">
                      {guardianMembers.length ? (
                        guardianMembers.map((member) => (
                          <label className="checkbox-row" key={member.userId}>
                            <input
                              type="checkbox"
                              checked={member.playerIds.includes(selectedPlayer.id)}
                              onChange={() => toggleGuardianAssignment(member.userId, selectedPlayer.id)}
                              disabled={syncing}
                            />
                            {member.email ?? member.userId}
                          </label>
                        ))
                      ) : (
                        <span className="subtle">承認済みの保護者がまだいません。</span>
                      )}
                    </div>
                    <div className="card-actions">
                      <button className="button secondary" type="button" onClick={handleSaveGuardianLinks} disabled={syncing || !guardianMembers.length}>
                        保護者ひもづけを保存
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="empty-state">編集する選手を選ぶと、ここで属性を変更できます。</p>
          )}
        </Section>
      </div>
    </div>
  );
}
