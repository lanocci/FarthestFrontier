"use client";

import type { QuickClipForm, QuickClipSide } from "@/lib/video-room/quick-registration";
import { buildQuickClipTitle } from "@/lib/video-room/quick-registration";
import { Clock3, Save } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useId } from "react";

type QuickClipRegistrationBarProps = {
  availableFormations: string[];
  availablePlayTypes: string[];
  disabled: boolean;
  formationListId: string;
  form: QuickClipForm;
  onNudgeTimestamp: (field: "startText" | "endText", deltaSeconds: number) => void;
  onSave: () => void;
  onSetCurrentTime: (field: "startText" | "endText") => void;
  onUpdate: <Key extends keyof QuickClipForm>(key: Key, value: QuickClipForm[Key]) => void;
  playTypeListId: string;
};

function handleTimestampKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  field: "startText" | "endText",
  onNudgeTimestamp: QuickClipRegistrationBarProps["onNudgeTimestamp"],
) {
  if (event.key === "ArrowUp" || event.key === "ArrowRight") {
    event.preventDefault();
    onNudgeTimestamp(field, 1);
  }

  if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
    event.preventDefault();
    onNudgeTimestamp(field, -1);
  }
}

export function QuickClipRegistrationBar({
  availableFormations,
  availablePlayTypes,
  disabled,
  formationListId,
  form,
  onNudgeTimestamp,
  onSave,
  onSetCurrentTime,
  onUpdate,
  playTypeListId,
}: QuickClipRegistrationBarProps) {
  const generatedTitle = buildQuickClipTitle(form);
  const startInputId = useId();
  const endInputId = useId();

  return (
    <div className="film-quick-register" aria-label="クイックプレー登録">
      <div className="film-quick-register-head">
        <div>
          <strong>クイック登録</strong>
          <span>時間を切って、最小情報だけ保存します。</span>
        </div>
        <div className="film-quick-title-preview">
          {generatedTitle ? `仮タイトル: ${generatedTitle}` : "仮タイトルは保存時に自動作成"}
        </div>
      </div>

      <div className="film-quick-grid">
        <div className="field-stack film-quick-time-field">
          <label className="field-label" htmlFor={startInputId}>開始</label>
          <div className="film-quick-time-row">
            <input
              id={startInputId}
              type="text"
              inputMode="numeric"
              placeholder="1:24"
              value={form.startText}
              onChange={(event) => onUpdate("startText", event.target.value)}
              onKeyDown={(event) => handleTimestampKeyDown(event, "startText", onNudgeTimestamp)}
              disabled={disabled}
            />
            <button
              className="button secondary button-compact"
              type="button"
              onClick={() => onSetCurrentTime("startText")}
              disabled={disabled}
            >
              <Clock3 aria-hidden="true" />
              現在
            </button>
          </div>
        </div>

        <div className="field-stack film-quick-time-field">
          <label className="field-label" htmlFor={endInputId}>終了</label>
          <div className="film-quick-time-row">
            <input
              id={endInputId}
              type="text"
              inputMode="numeric"
              placeholder="1:37"
              value={form.endText}
              onChange={(event) => onUpdate("endText", event.target.value)}
              onKeyDown={(event) => handleTimestampKeyDown(event, "endText", onNudgeTimestamp)}
              disabled={disabled}
            />
            <button
              className="button secondary button-compact"
              type="button"
              onClick={() => onSetCurrentTime("endText")}
              disabled={disabled}
            >
              <Clock3 aria-hidden="true" />
              現在
            </button>
          </div>
        </div>

        <div className="field-stack">
          <span className="field-label">攻守</span>
          <div className="film-quick-side-row">
            {[
              ["offense", "攻撃"],
              ["defense", "守備"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`button secondary button-compact ${form.side === value ? "is-selected" : ""}`}
                type="button"
                aria-pressed={form.side === value}
                onClick={() => onUpdate("side", value as QuickClipSide)}
                disabled={disabled}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="field-stack">
          <span className="field-label">隊形</span>
          <input
            type="text"
            list={formationListId}
            placeholder="候補から選択"
            value={form.formation}
            onChange={(event) => onUpdate("formation", event.target.value)}
            disabled={disabled}
          />
          <datalist id={formationListId}>
            {availableFormations.map((formation) => (
              <option key={formation} value={formation}>
                {formation}
              </option>
            ))}
          </datalist>
        </label>

        <label className="field-stack">
          <span className="field-label">プレー種類</span>
          <input
            type="text"
            list={playTypeListId}
            placeholder="候補から選択"
            value={form.playType}
            onChange={(event) => onUpdate("playType", event.target.value)}
            disabled={disabled}
          />
          <datalist id={playTypeListId}>
            {availablePlayTypes.map((playType) => (
              <option key={playType} value={playType}>
                {playType}
              </option>
            ))}
          </datalist>
        </label>

        <label className="field-stack">
          <span className="field-label">ダウン</span>
          <select value={form.down} onChange={(event) => onUpdate("down", event.target.value)} disabled={disabled}>
            <option value="">未指定</option>
            <option value="1">1st</option>
            <option value="2">2nd</option>
            <option value="3">3rd</option>
            <option value="4">4th</option>
            <option value="0">TFP</option>
          </select>
        </label>

        <label className="field-stack">
          <span className="field-label">距離</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="10"
            value={form.toGoYards}
            onChange={(event) => onUpdate("toGoYards", event.target.value)}
            disabled={disabled}
          />
        </label>
      </div>

      <div className="film-quick-actions">
        <span className="subtle">時刻欄は矢印キーで 1 秒ずつ調整できます。</span>
        <button className="button" type="button" onClick={onSave} disabled={disabled}>
          <Save aria-hidden="true" />
          保存
        </button>
      </div>
    </div>
  );
}
