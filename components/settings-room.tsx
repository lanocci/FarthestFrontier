"use client";

import { MemberApprovals } from "@/components/member-approvals";
import { Section } from "@/components/section";
import { formatDisplayDate } from "@/lib/date";
import { Season } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";

type SettingsRoomProps = {
  canManageAdmin: boolean;
  supabase: SupabaseClient | null;
  teamMessage: string | null;
  setTeamMessage: (message: string | null) => void;
  seasons: Season[];
  setSeasons: Dispatch<SetStateAction<Season[]>>;
  syncing: boolean;
  setSyncing: Dispatch<SetStateAction<boolean>>;
  usingRemoteData: boolean;
};

function SeasonManager({
  seasons,
  setSeasons,
  supabase,
  syncing,
  setSyncing,
  setTeamMessage,
  usingRemoteData,
}: {
  seasons: Season[];
  setSeasons: Dispatch<SetStateAction<Season[]>>;
  supabase: SupabaseClient | null;
  syncing: boolean;
  setSyncing: Dispatch<SetStateAction<boolean>>;
  setTeamMessage: (message: string | null) => void;
  usingRemoteData: boolean;
}) {
  const [label, setLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");

  async function handleAdd() {
    if (!label.trim() || !startDate || !targetDate) return;
    const id = `s-${Date.now()}`;
    const next: Season = {
      id,
      label: label.trim(),
      startDate,
      targetDate,
      active: seasons.length === 0,
    };

    try {
      setSyncing(true);
      if (usingRemoteData && supabase) {
        const { data, error } = await supabase
          .from("seasons")
          .insert({ label: next.label, start_date: next.startDate, target_date: next.targetDate, active: next.active })
          .select("id, label, start_date, target_date, active")
          .single();
        if (error) throw new Error(error.message);
        setSeasons((prev) => [{ ...next, id: data.id }, ...prev]);
      } else {
        setSeasons((prev) => [next, ...prev]);
      }
      setLabel("");
      setStartDate("");
      setTargetDate("");
      setTeamMessage("シーズンを追加しました。");
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : "保存に失敗しました。");
    } finally {
      setSyncing(false);
    }
  }

  async function handleToggleActive(seasonId: string) {
    try {
      setSyncing(true);
      const updated = seasons.map((s) => ({ ...s, active: s.id === seasonId ? !s.active : false }));
      if (usingRemoteData && supabase) {
        // Deactivate all first, then activate the selected one
        const { error: resetError } = await supabase.from("seasons").update({ active: false }).neq("id", "");
        if (resetError) throw new Error(resetError.message);
        const target = updated.find((s) => s.id === seasonId);
        if (target?.active) {
          const { error } = await supabase.from("seasons").update({ active: true }).eq("id", seasonId);
          if (error) throw new Error(error.message);
        }
      }
      setSeasons(updated);
      setTeamMessage("アクティブシーズンを変更しました。");
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : "更新に失敗しました。");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Section title="シーズン管理" copy="春季・秋季の公式戦シーズンを登録し、アクティブなシーズンを切り替えます。">
      <div className="admin-form" style={{ marginBottom: 16 }}>
        <label className="field-stack">
          <span className="field-label">シーズン名</span>
          <input type="text" placeholder="2026年春季大会" value={label} onChange={(e) => setLabel(e.target.value)} disabled={syncing} />
        </label>
        <label className="field-stack">
          <span className="field-label">開始日</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={syncing} />
        </label>
        <label className="field-stack">
          <span className="field-label">大会日</span>
          <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} disabled={syncing} />
        </label>
        <div className="field-stack" style={{ justifyContent: "end" }}>
          <button className="button" type="button" onClick={handleAdd} disabled={syncing || !label.trim() || !startDate || !targetDate}>
            追加
          </button>
        </div>
      </div>

      {seasons.length ? (
        <div className="admin-player-list">
          {seasons.map((season) => (
            <div className={`admin-player-item ${season.active ? "is-selected" : ""}`} key={season.id}>
              <div>
                <strong>{season.label}</strong>
                <span className="subtle" style={{ display: "block", fontSize: "0.82rem" }}>
                  {formatDisplayDate(season.startDate)} 〜 {formatDisplayDate(season.targetDate)}
                </span>
              </div>
              <span className={`chip ${season.active ? "ok" : ""}`}>{season.active ? "アクティブ" : "非アクティブ"}</span>
              <button
                className={`button ${season.active ? "secondary" : ""} button-compact`}
                type="button"
                onClick={() => handleToggleActive(season.id)}
                disabled={syncing}
              >
                {season.active ? "無効にする" : "有効にする"}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-state">シーズンがまだ登録されていません。上のフォームから追加してください。</p>
      )}
    </Section>
  );
}

export function SettingsRoom({ canManageAdmin, supabase, teamMessage, setTeamMessage, seasons, setSeasons, syncing, setSyncing, usingRemoteData }: SettingsRoomProps) {
  return (
    <div className="dashboard dashboard-wide">
      <div className="stack">
        <Section
          title="設定"
          copy="ふだんは使わない管理系の画面を、ここにまとめています。選手、資料、マスターの編集が必要なときだけ開いてください。"
        >
          {canManageAdmin ? (
            <div className="settings-grid">
              <Link className="settings-card" href="/materials/manage">
                <strong>資料管理</strong>
                <span>共有資料の追加や確認を行います。Google 資料の URL もここから登録します。</span>
              </Link>

              <Link className="settings-card" href="/players">
                <strong>選手管理</strong>
                <span>選手の追加、背番号、学年、攻守ポジション、在籍状態を変更します。</span>
              </Link>

              <Link className="settings-card" href="/masters">
                <strong>マスター管理</strong>
                <span>ポジションや目標テンプレートの候補を調整します。</span>
              </Link>
            </div>
          ) : (
            <p className="empty-state">この画面はコーチ権限のあるアカウントだけが利用できます。</p>
          )}
        </Section>

        {canManageAdmin ? (
          <>
            <SeasonManager
              seasons={seasons}
              setSeasons={setSeasons}
              supabase={supabase}
              syncing={syncing}
              setSyncing={setSyncing}
              setTeamMessage={setTeamMessage}
              usingRemoteData={usingRemoteData}
            />
            <MemberApprovals
              supabase={supabase}
              teamMessage={teamMessage}
              setTeamMessage={setTeamMessage}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
