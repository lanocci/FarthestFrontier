"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { MaterialsPanel } from "@/components/materials-panel";
import { Section } from "@/components/section";
import { insertMaterial } from "@/lib/data-store";
import { isValidUrl } from "@/lib/utils";
import { Material, MaterialAudience, MaterialType } from "@/lib/types";

type MaterialsRoomProps = {
  canManageTeam: boolean;
  dataLoading: boolean;
  materials: Material[];
  setMaterials: Dispatch<SetStateAction<Material[]>>;
  setTeamMessage: Dispatch<SetStateAction<string | null>>;
  supabase: SupabaseClient | null;
  syncing: boolean;
  setSyncing: Dispatch<SetStateAction<boolean>>;
  teamMessage: string | null;
  usingRemoteData: boolean;
  onResetLocalMode: () => void;
};

type MaterialForm = {
  title: string;
  description: string;
  type: MaterialType;
  audience: MaterialAudience;
  url: string;
};

const initialForm: MaterialForm = {
  title: "",
  description: "",
  type: "slide",
  audience: "all",
  url: "",
};

export function MaterialsRoom({
  canManageTeam,
  dataLoading,
  materials,
  setMaterials,
  setTeamMessage,
  supabase,
  syncing,
  setSyncing,
  teamMessage,
  usingRemoteData,
  onResetLocalMode,
}: MaterialsRoomProps) {
  const [form, setForm] = useState<MaterialForm>(initialForm);

  function updateForm<Key extends keyof MaterialForm>(key: Key, value: MaterialForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleAddMaterial() {
    const nextMaterial = {
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      audience: form.audience,
      url: form.url.trim(),
    };

    if (!canManageTeam || syncing || !nextMaterial.title || !nextMaterial.url) {
      return;
    }

    if (!isValidUrl(nextMaterial.url)) {
      setTeamMessage("資料URLは https:// から始まる正しいURLを入れてください。");
      return;
    }

    try {
      setSyncing(true);

      const savedMaterial =
        usingRemoteData && supabase
          ? await insertMaterial(supabase, nextMaterial)
          : { id: `m${Date.now()}`, updatedAt: new Date().toISOString().slice(0, 10), ...nextMaterial };

      setMaterials((current) => [savedMaterial, ...current]);
      setForm(initialForm);
      setTeamMessage(`資料「${savedMaterial.title}」を追加しました。`);
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : "資料の追加に失敗しました。");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="dashboard dashboard-wide">
      <div className="stack">
        <Section
          title="資料管理"
          copy="コーチ向けの管理画面です。共有資料の追加や確認をここで行います。"
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

          <div className="admin-grid materials-grid">
            <div className="panel inset-panel">
              <div className="panel-body">
                <h3 className="section-title">資料を追加</h3>
                <div className="admin-form">
                  <label className="field-stack">
                    <span className="field-label">タイトル</span>
                    <input
                      type="text"
                      placeholder="例: 4月のれんしゅうメニュー"
                      value={form.title}
                      onChange={(event) => updateForm("title", event.target.value)}
                      disabled={!canManageTeam || syncing}
                    />
                  </label>
                  <label className="field-stack">
                    <span className="field-label">資料タイプ</span>
                    <select
                      value={form.type}
                      onChange={(event) => updateForm("type", event.target.value as MaterialType)}
                      disabled={!canManageTeam || syncing}
                    >
                      <option value="slide">Google Slides</option>
                      <option value="sheet">Google Sheets</option>
                      <option value="doc">Google Docs</option>
                    </select>
                  </label>
                  <label className="field-stack">
                    <span className="field-label">説明</span>
                    <input
                      type="text"
                      placeholder="何の資料かひとこと"
                      value={form.description}
                      onChange={(event) => updateForm("description", event.target.value)}
                      disabled={!canManageTeam || syncing}
                    />
                  </label>
                  <label className="field-stack">
                    <span className="field-label">公開先</span>
                    <select
                      value={form.audience}
                      onChange={(event) => updateForm("audience", event.target.value as MaterialAudience)}
                      disabled={!canManageTeam || syncing}
                    >
                      <option value="all">チーム全体</option>
                      <option value="guardians">保護者のみ</option>
                      <option value="coaches">コーチのみ</option>
                    </select>
                  </label>
                  <label className="field-stack admin-form-full">
                    <span className="field-label">資料URL</span>
                    <input
                      type="url"
                      placeholder="https://docs.google.com/..."
                      value={form.url}
                      onChange={(event) => updateForm("url", event.target.value)}
                      disabled={!canManageTeam || syncing}
                    />
                  </label>
                  <button className="button" type="button" onClick={handleAddMaterial} disabled={!canManageTeam || syncing}>
                    資料を追加
                  </button>
                </div>
              </div>
            </div>

            <div className="panel inset-panel">
              <div className="panel-body">
                <h3 className="section-title">共有中の資料</h3>
                <MaterialsPanel materials={materials} />
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
