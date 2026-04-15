"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";
import { Section } from "@/components/section";
import { deletePositionMasters, upsertGoalTemplates, upsertPositionMasters } from "@/lib/data-store";
import { GoalTemplate, Player, PositionMaster, PositionSide } from "@/lib/types";

type MastersAdminProps = {
  canManageTeam: boolean;
  dataLoading: boolean;
  goalTemplates: GoalTemplate[];
  players: Player[];
  positionMasters: PositionMaster[];
  setGoalTemplates: Dispatch<SetStateAction<GoalTemplate[]>>;
  setPositionMasters: Dispatch<SetStateAction<PositionMaster[]>>;
  setTeamMessage: Dispatch<SetStateAction<string | null>>;
  supabase: SupabaseClient | null;
  syncing: boolean;
  setSyncing: Dispatch<SetStateAction<boolean>>;
  teamMessage: string | null;
  usingRemoteData: boolean;
  onResetLocalMode: () => void;
};

export function MastersAdmin({
  canManageTeam,
  dataLoading,
  goalTemplates,
  players,
  positionMasters,
  setGoalTemplates,
  setPositionMasters,
  setTeamMessage,
  supabase,
  syncing,
  setSyncing,
  teamMessage,
  usingRemoteData,
  onResetLocalMode,
}: MastersAdminProps) {
  const [draftPositions, setDraftPositions] = useState<PositionMaster[]>(positionMasters);
  const [draftTemplates, setDraftTemplates] = useState<GoalTemplate[]>(goalTemplates);

  useEffect(() => {
    setDraftPositions(positionMasters);
  }, [positionMasters]);

  useEffect(() => {
    setDraftTemplates(goalTemplates);
  }, [goalTemplates]);

  function updatePosition(index: number, key: keyof PositionMaster, value: string) {
    setDraftPositions((current) =>
      current.map((position, currentIndex) =>
        currentIndex === index ? { ...position, [key]: value } : position,
      ),
    );
  }

  function updateTemplate(index: number, key: keyof GoalTemplate, value: string) {
    setDraftTemplates((current) =>
      current.map((template, currentIndex) =>
        currentIndex === index ? { ...template, [key]: value } : template,
      ),
    );
  }

  function addPosition(side: PositionSide) {
    setDraftPositions((current) => [
      ...current,
      { id: `pos-${Date.now()}-${side}`, label: side === "offense" ? "新しい攻撃ポジション" : "新しい守備ポジション", side },
    ]);
  }

  function addTemplateBySide(side: "offense" | "defense") {
    setDraftTemplates((current) => [
      ...current,
      {
        id: `goal-${Date.now()}-${side}`,
        side,
        title: side === "offense" ? "新しい攻撃テンプレート" : "新しい守備テンプレート",
        prompt: "説明を入れてください",
        emoji: "⭐",
        color: "orange",
        templateText: "{input}をやってみる",
        inputPlaceholder: "やること",
      },
    ]);
  }

  function removePosition(positionId: string) {
    setDraftPositions((current) => current.filter((position) => position.id !== positionId));
  }

  function renderPositionGroup(side: PositionSide, title: string) {
    const positions = draftPositions.filter((position) => position.side === side);

    return (
      <div className="master-group">
        <div className="section-row compact-row">
          <div>
            <h4 className="section-title">{title}</h4>
            <p className="subtle">名前を変えたあと、保存ボタンで反映されます。</p>
          </div>
          <button className="button secondary" type="button" onClick={() => addPosition(side)}>
            追加
          </button>
        </div>

        <div className="masters-list">
          {positions.length ? (
            positions.map((position) => (
              <div className="master-row" key={position.id}>
                <span className="master-label">{title}</span>
                <input
                  type="text"
                  value={position.label}
                  onChange={(event) =>
                    updatePosition(
                      draftPositions.findIndex((item) => item.id === position.id),
                      "label",
                      event.target.value,
                    )
                  }
                />
                <button
                  className="button ghost"
                  type="button"
                  onClick={() => removePosition(position.id)}
                  disabled={isPositionUsed(position.id)}
                >
                  削除
                </button>
              </div>
            ))
          ) : (
            <p className="subtle">まだ登録がありません。</p>
          )}
        </div>
      </div>
    );
  }

  async function handleSaveMasters() {
    if (!canManageTeam || syncing) {
      return;
    }

    try {
      setSyncing(true);

      const deletedPositionIds = positionMasters
        .filter((position) => !draftPositions.some((draft) => draft.id === position.id))
        .map((position) => position.id);

      if (usingRemoteData && supabase) {
        await deletePositionMasters(supabase, deletedPositionIds);
        await upsertPositionMasters(supabase, draftPositions);
        await upsertGoalTemplates(supabase, draftTemplates);
      }

      setPositionMasters(draftPositions);
      setGoalTemplates(draftTemplates);
      setTeamMessage("ポジションと目標テンプレートのマスターを更新しました。");
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : "マスター更新に失敗しました。");
    } finally {
      setSyncing(false);
    }
  }

  const offenseTemplates = draftTemplates.filter((template) => template.side === "offense");
  const defenseTemplates = draftTemplates.filter((template) => template.side === "defense");
  const templateGroups: Array<{
    side: "offense" | "defense";
    title: string;
    templates: GoalTemplate[];
  }> = [
    { side: "offense", title: "オフェンステンプレート", templates: offenseTemplates },
    { side: "defense", title: "ディフェンステンプレート", templates: defenseTemplates },
  ];

  function isPositionUsed(positionId: string) {
    return players.some(
      (player) =>
        player.offensePositionId === positionId || player.defensePositionId === positionId,
    );
  }

  return (
    <div className="dashboard dashboard-wide">
      <div className="stack">
        <Section
          title="マスター管理"
          copy="ポジション候補と目標テンプレートをここで管理します。ホームや選手管理の入力候補にそのまま反映されます。"
        >
          <div className="status-strip">
            <span className={`chip ${usingRemoteData ? "ok" : "warn"}`}>
              {dataLoading ? "読込中" : usingRemoteData ? "Supabase同期中" : "ローカル保存中"}
            </span>
            {syncing ? <span className="chip">保存しています…</span> : null}
            {teamMessage ? <span className="subtle">{teamMessage}</span> : null}
            <span className="subtle">変更後は「マスターを保存」で反映されます。</span>
            {!usingRemoteData ? (
              <button className="button ghost" type="button" onClick={onResetLocalMode} disabled={syncing}>
                体験データに戻す
              </button>
            ) : null}
          </div>

          <div className="masters-grid">
            <div className="panel inset-panel">
              <div className="panel-body">
                <div className="section-row">
                  <h3 className="section-title">ポジションマスター</h3>
                  <button className="button" type="button" onClick={handleSaveMasters} disabled={!canManageTeam || syncing}>
                    マスターを保存
                  </button>
                </div>

                {renderPositionGroup("offense", "オフェンス")}
                <div className="divider" />
                {renderPositionGroup("defense", "ディフェンス")}
                <p className="footer-note">選手に割り当て済みのポジションは削除できません。</p>
              </div>
            </div>

            <div className="panel inset-panel">
              <div className="panel-body">
                <div className="section-row">
                  <h3 className="section-title">目標テンプレート</h3>
                  <div className="card-actions">
                    <button className="button secondary" type="button" onClick={() => addTemplateBySide("offense")}>
                      攻撃テンプレ追加
                    </button>
                    <button className="button secondary" type="button" onClick={() => addTemplateBySide("defense")}>
                      守備テンプレ追加
                    </button>
                  </div>
                </div>

                <div className="masters-list">
                  {templateGroups.map(({ side, title, templates }) => (
                    <div className="master-group" key={side}>
                      <div className="section-row compact-row">
                        <div>
                          <h4 className="section-title">{title}</h4>
                          <p className="subtle">`{"{input}"}` を入れると差し込み入力つきになります。</p>
                        </div>
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => addTemplateBySide(side)}
                        >
                          追加
                        </button>
                      </div>

                      <div className="masters-list">
                        {templates.length ? (
                          templates.map((template) => {
                            const index = draftTemplates.findIndex((item) => item.id === template.id);

                            return (
                              <div className="template-editor" key={template.id}>
                                <div className="template-grid">
                                  <input type="text" value={template.title} onChange={(event) => updateTemplate(index, "title", event.target.value)} />
                                  <input type="text" value={template.emoji} onChange={(event) => updateTemplate(index, "emoji", event.target.value)} />
                                  <input type="text" value={template.prompt} onChange={(event) => updateTemplate(index, "prompt", event.target.value)} />
                                  <input type="text" value={template.templateText} onChange={(event) => updateTemplate(index, "templateText", event.target.value)} />
                                  <input type="text" value={template.inputPlaceholder ?? ""} onChange={(event) => updateTemplate(index, "inputPlaceholder", event.target.value)} />
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="subtle">まだ登録がありません。</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card-actions sticky-actions">
            <button className="button" type="button" onClick={handleSaveMasters} disabled={!canManageTeam || syncing}>
              マスターを保存
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}
