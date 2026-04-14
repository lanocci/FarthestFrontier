"use client";

import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import { GoalBoard } from "@/components/goal-board";
import { MaterialsPanel } from "@/components/materials-panel";
import { PlayerList } from "@/components/player-list";
import { Section } from "@/components/section";
import { insertGoalLog, insertMaterial } from "@/lib/data-store";
import { formatDateInput } from "@/lib/date";
import {
  GoalLog,
  GoalTemplate,
  GradeBand,
  Material,
  MaterialAudience,
  MaterialType,
  Player,
  PositionMaster,
} from "@/lib/types";
import { buildGoalText, isValidUrl } from "@/lib/utils";

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

type NewMaterialForm = {
  title: string;
  description: string;
  type: MaterialType;
  audience: MaterialAudience;
  url: string;
};

const initialMaterialForm: NewMaterialForm = {
  title: "",
  description: "",
  type: "slide",
  audience: "all",
  url: "",
};

export function TeamDashboard({
  canManageTeam,
  dataLoading,
  goalLogs,
  goalTemplates,
  materials,
  players,
  positionMasters,
  setTeamMessage,
  setGoalLogs,
  setMaterials,
  setPlayers,
  supabase,
  syncing,
  setSyncing,
  teamMessage,
  usingRemoteData,
  onResetLocalMode,
}: TeamDashboardProps) {
  const [searchText, setSearchText] = useState("");
  const [gradeFilter, setGradeFilter] = useState<"all" | GradeBand>("all");
  const [materialAudience, setMaterialAudience] = useState<"all" | "guardians" | "coaches">("all");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState(goalTemplates[0]?.id ?? "");
  const [goalInput, setGoalInput] = useState("");
  const [materialForm, setMaterialForm] = useState<NewMaterialForm>(initialMaterialForm);

  useEffect(() => {
    if (selectedPlayerId && players.some((player) => player.id === selectedPlayerId)) {
      return;
    }

    const fallbackPlayer = players.find((player) => player.active) ?? players[0];
    setSelectedPlayerId(fallbackPlayer?.id ?? "");
  }, [players, selectedPlayerId]);

  useEffect(() => {
    if (!goalTemplates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId("");
    }
  }, [goalTemplates, selectedTemplateId]);

  const filteredPlayers = players.filter((player) => {
    const matchesSearch = player.name.includes(searchText.trim());
    const matchesGrade = gradeFilter === "all" ? true : player.gradeBand === gradeFilter;

    return matchesSearch && matchesGrade;
  });

  const filteredMaterials =
    materialAudience === "all"
      ? materials
      : materials.filter((material) => material.audience === materialAudience);

  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? null;
  const selectedTemplate = goalTemplates.find((template) => template.id === selectedTemplateId) ?? null;
  const today = formatDateInput();
  const activePlayerCount = players.filter((player) => player.active).length;
  const goalsTodayCount = goalLogs.filter((log) => log.date === today).length;
  const templatePreview = useMemo(
    () => (selectedTemplate ? buildGoalText(selectedTemplate, goalInput).trim() : goalInput.trim()),
    [goalInput, selectedTemplate],
  );

  function handleMaterialFormChange<Key extends keyof NewMaterialForm>(
    key: Key,
    value: NewMaterialForm[Key],
  ) {
    setMaterialForm((current) => ({ ...current, [key]: value }));
  }

  async function saveGoalLog(nextLog: Omit<GoalLog, "id">) {
    try {
      setSyncing(true);

      const savedLog =
        usingRemoteData && supabase
          ? await insertGoalLog(supabase, nextLog)
          : { id: `l${Date.now()}`, ...nextLog };

      setPlayers((current) =>
        current.map((player) =>
          player.id === nextLog.playerId ? { ...player, recentGoalText: nextLog.goalText } : player,
        ),
      );

      setGoalLogs((current) => [savedLog, ...current]);
      setTeamMessage(`「${selectedPlayer?.name ?? "選手"}」の今日の目標を登録しました。`);
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : "目標登録に失敗しました。");
    } finally {
      setSyncing(false);
    }
  }

  async function handleSubmitGoal() {
    if (!canManageTeam || !selectedPlayer || syncing || !templatePreview) {
      return;
    }

    await saveGoalLog({
      playerId: selectedPlayer.id,
      goalText: templatePreview,
      goalTemplateId: selectedTemplate?.id,
      date: today,
      by: "coach",
      note: selectedTemplate
        ? usingRemoteData
          ? "テンプレートからSupabase登録"
          : "テンプレートからローカル登録"
        : usingRemoteData
          ? "自由入力でSupabase登録"
          : "自由入力でローカル登録",
    });

    setGoalInput("");
  }

  async function handleAddMaterial() {
    if (
      !canManageTeam ||
      !materialForm.title.trim() ||
      !materialForm.url.trim() ||
      !isValidUrl(materialForm.url.trim()) ||
      syncing
    ) {
      return;
    }

    const nextMaterial = {
      title: materialForm.title.trim(),
      description: materialForm.description.trim() || "説明はまだありません。",
      type: materialForm.type,
      audience: materialForm.audience,
      url: materialForm.url.trim(),
    };

    try {
      setSyncing(true);

      const savedMaterial =
        usingRemoteData && supabase
          ? await insertMaterial(supabase, nextMaterial)
          : { id: `m${Date.now()}`, updatedAt: today, ...nextMaterial };

      setMaterials((current) => [savedMaterial, ...current]);
      setMaterialForm(initialMaterialForm);
      setTeamMessage(`資料「${savedMaterial.title}」を追加しました。`);
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : "資料の追加に失敗しました。");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="dashboard">
      <div className="stack">
        <Section
          title="選手一覧"
          copy="ホーム画面では選手を選んで今日の目標を登録できます。追加や属性変更は選手管理、テンプレートやポジション候補はマスター管理に分けています。"
        >
          <div className="status-strip">
            <span className={`chip ${usingRemoteData ? "ok" : "warn"}`}>
              {dataLoading ? "読込中" : usingRemoteData ? "Supabase同期中" : "ローカル保存中"}
            </span>
            {syncing ? <span className="chip">保存しています…</span> : null}
            {teamMessage ? <span className="subtle">{teamMessage}</span> : null}
            <Link className="button secondary" href="/players">
              選手管理へ
            </Link>
            <Link className="button secondary" href="/masters">
              マスター管理へ
            </Link>
            {!usingRemoteData ? (
              <button className="button ghost" type="button" onClick={onResetLocalMode} disabled={syncing}>
                体験データに戻す
              </button>
            ) : null}
          </div>

          <div className="toolbar">
            <input type="search" placeholder="選手名で検索" aria-label="選手名で検索" value={searchText} onChange={(event) => setSearchText(event.target.value)} />
            <select aria-label="学年帯" value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value as "all" | GradeBand)}>
              <option value="all">全学年</option>
              <option value="lower">低学年</option>
              <option value="middle">中学年</option>
              <option value="upper">高学年</option>
            </select>
            <div className="toolbar-count">在籍 {activePlayerCount}人</div>
          </div>

          {!canManageTeam ? (
            <p className="footer-note">Supabase認証を有効にした場合、ログイン後に管理ページから選手やマスターを編集できます。</p>
          ) : null}

          <PlayerList
            players={filteredPlayers}
            positionMasters={positionMasters}
            selectedPlayerId={selectedPlayerId}
            onSelectPlayer={setSelectedPlayerId}
          />
        </Section>

        <Section title="共有資料" copy="Google Slides / Sheets のURLを登録して、公開対象をチーム単位で整理できます。">
          <div className="inline-form">
            <input type="text" placeholder="資料名" value={materialForm.title} onChange={(event) => handleMaterialFormChange("title", event.target.value)} disabled={!canManageTeam} />
            <select aria-label="資料タイプ" value={materialForm.type} onChange={(event) => handleMaterialFormChange("type", event.target.value as MaterialType)} disabled={!canManageTeam}>
              <option value="slide">Slides</option>
              <option value="sheet">Sheets</option>
              <option value="doc">Docs</option>
            </select>
            <select aria-label="公開範囲" value={materialForm.audience} onChange={(event) => handleMaterialFormChange("audience", event.target.value as MaterialAudience)} disabled={!canManageTeam}>
              <option value="all">チーム全体</option>
              <option value="guardians">保護者のみ</option>
              <option value="coaches">コーチのみ</option>
            </select>
            <input type="url" placeholder="Google資料のURL" value={materialForm.url} onChange={(event) => handleMaterialFormChange("url", event.target.value)} disabled={!canManageTeam} />
            <input type="text" placeholder="説明" value={materialForm.description} onChange={(event) => handleMaterialFormChange("description", event.target.value)} disabled={!canManageTeam} />
            <button className="button" type="button" onClick={handleAddMaterial} disabled={!canManageTeam || syncing}>
              資料を追加
            </button>
          </div>

          <div className="segmented">
            <button className={`button ${materialAudience === "all" ? "" : "secondary"}`} type="button" onClick={() => setMaterialAudience("all")}>すべて</button>
            <button className={`button ${materialAudience === "guardians" ? "" : "secondary"}`} type="button" onClick={() => setMaterialAudience("guardians")}>保護者向け</button>
            <button className={`button ${materialAudience === "coaches" ? "" : "secondary"}`} type="button" onClick={() => setMaterialAudience("coaches")}>コーチ向け</button>
          </div>
          <MaterialsPanel materials={filteredMaterials} />
        </Section>
      </div>

      <Section title="今日の目標" copy="テンプレートを選んで1語だけ入れるか、必要なら自由入力でそのまま登録できます。">
        <div className="selected-player-banner">
          {selectedPlayer ? (
            <>
              <div>
                <strong>{selectedPlayer.name}</strong>
                <span>{selectedPlayer.gradeLabel} / 保護者: {selectedPlayer.guardianName}</span>
              </div>
              <span className="chip ok">今日の登録 {goalsTodayCount}件</span>
            </>
          ) : (
            <span>まず選手管理で追加するか、一覧から選んでください。</span>
          )}
        </div>
        <GoalBoard
          goalTemplates={goalTemplates}
          goalLogs={goalLogs}
          players={players}
          selectedTemplateId={selectedTemplateId}
          goalInput={goalInput}
          onSelectTemplate={setSelectedTemplateId}
          onGoalInputChange={setGoalInput}
          onSubmitGoal={handleSubmitGoal}
          disabled={!selectedPlayer || syncing}
        />
      </Section>
    </div>
  );
}
