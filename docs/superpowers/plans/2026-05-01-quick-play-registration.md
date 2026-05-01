# Quick Play Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a coach-only editing mode with a compact video-under quick registration bar for first-pass play capture.

**Architecture:** Keep existing full clip editing intact. Add pure quick-registration helpers under `lib/video-room`, add a focused `QuickClipRegistrationBar` component under `components/video-room`, and wire it into `AudiovisualRoom` behind a `view` / `edit` UI mode. Reuse the existing clip persistence path by letting quick save populate `clipForm`-compatible data and call the same save helper.

**Tech Stack:** Next.js 15, React 19, TypeScript, existing CSS in `app/globals.css`, Node/TypeScript script tests using `tsc`.

---

## File Structure

- Create `lib/video-room/quick-registration.ts`
  - Pure helpers for generated titles, down advancement, timestamp nudging, dirty checks, and quick-form defaults.
- Create `lib/video-room/quick-registration.test.ts`
  - Script-style TypeScript test matching the existing `playbook-matching.test.ts` pattern.
- Create `components/video-room/quick-clip-registration-bar.tsx`
  - Coach-only compact form rendered below the player in editing mode.
- Modify `components/audiovisual-room.tsx`
  - Add `videoRoomMode`, localStorage persistence, mode toggle, quick-form state, quick-save flow, and hide editing controls in viewing mode.
- Modify `app/globals.css`
  - Add compact segmented control, quick-registration bar, and responsive layouts.
- Modify `tsconfig.playbook-test.json`
  - Include the new quick-registration test file.

## Task 1: Pure Quick Registration Helpers

**Files:**
- Create: `lib/video-room/quick-registration.ts`
- Test: `lib/video-room/quick-registration.test.ts`
- Modify: `tsconfig.playbook-test.json`

- [ ] **Step 1: Write the failing helper tests**

Create `lib/video-room/quick-registration.test.ts`:

```ts
import {
  advanceQuickDown,
  buildQuickClipTitle,
  getQuickClipDefaultsAfterSave,
  isQuickClipDirty,
  nudgeTimestampText,
} from "./quick-registration.js";
import type { QuickClipForm } from "./quick-registration.js";

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}: expected ${expectedJson}, got ${actualJson}`);
  }
}

assertEqual(
  buildQuickClipTitle({
    side: "offense",
    formation: "I-Formation",
    playType: "Run",
    down: "1",
    toGoYards: "10",
  }),
  "攻撃 I-Formation Run 1st&10",
  "builds offense title",
);

assertEqual(
  buildQuickClipTitle({
    side: "defense",
    formation: "Nickel",
    playType: "Zone",
    down: "3",
    toGoYards: "6",
  }),
  "守備 Nickel Zone 3rd&6",
  "builds defense title",
);

assertEqual(
  buildQuickClipTitle({
    side: "",
    formation: "",
    playType: "Pass",
    down: "",
    toGoYards: "",
  }),
  "Pass",
  "omits missing title segments",
);

assertEqual(advanceQuickDown(""), "", "blank down stays blank");
assertEqual(advanceQuickDown("1"), "2", "first down advances to second");
assertEqual(advanceQuickDown("2"), "3", "second down advances to third");
assertEqual(advanceQuickDown("3"), "4", "third down advances to fourth");
assertEqual(advanceQuickDown("4"), "1", "fourth down cycles to first");
assertEqual(advanceQuickDown("0"), "0", "TFP stays TFP");

assertEqual(nudgeTimestampText("1:24", 1), "1:25", "nudges timestamp up");
assertEqual(nudgeTimestampText("1:24", -30), "0:54", "nudges timestamp down");
assertEqual(nudgeTimestampText("0:03", -10), "0:00", "clamps timestamp at zero");
assertEqual(nudgeTimestampText("bad", 1), "bad", "invalid timestamp remains unchanged");

const savedForm: QuickClipForm = {
  startText: "1:00",
  endText: "1:10",
  side: "offense",
  formation: "Trips",
  playType: "Pass",
  down: "2",
  toGoYards: "8",
};

assertDeepEqual(
  getQuickClipDefaultsAfterSave(savedForm),
  {
    startText: "",
    endText: "",
    side: "offense",
    formation: "Trips",
    playType: "Pass",
    down: "3",
    toGoYards: "8",
  },
  "resets timestamps and carries quick metadata",
);

assertEqual(
  isQuickClipDirty({
    startText: "",
    endText: "",
    side: "",
    formation: "",
    playType: "",
    down: "",
    toGoYards: "",
  }),
  false,
  "empty quick form is not dirty",
);

assertEqual(
  isQuickClipDirty({
    startText: "1:00",
    endText: "",
    side: "",
    formation: "",
    playType: "",
    down: "",
    toGoYards: "",
  }),
  true,
  "timestamp makes quick form dirty",
);
```

- [ ] **Step 2: Add the new test to the script tsconfig**

Modify `tsconfig.playbook-test.json` so `include` contains both script tests:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": ".tmp/playbook-test",
    "noEmit": false
  },
  "include": [
    "lib/video-room/playbook-matching.test.ts",
    "lib/video-room/playbook-matching.ts",
    "lib/video-room/quick-registration.test.ts",
    "lib/video-room/quick-registration.ts",
    "lib/types.ts"
  ]
}
```

- [ ] **Step 3: Run the test build and verify it fails**

Run: `npx tsc -p tsconfig.playbook-test.json`

Expected: FAIL with an error that `./quick-registration.js` or its exported members cannot be found.

- [ ] **Step 4: Implement the helper module**

Create `lib/video-room/quick-registration.ts`:

```ts
import { formatSecondsAsTime } from "@/lib/utils";
import { formatDownLabel, parseTimestamp } from "@/lib/video-room/utils";

export type QuickClipSide = "" | "offense" | "defense";

export type QuickClipForm = {
  startText: string;
  endText: string;
  side: QuickClipSide;
  formation: string;
  playType: string;
  down: string;
  toGoYards: string;
};

export const initialQuickClipForm: QuickClipForm = {
  startText: "",
  endText: "",
  side: "",
  formation: "",
  playType: "",
  down: "",
  toGoYards: "",
};

export function formatQuickSideLabel(side: QuickClipSide): string {
  if (side === "offense") {
    return "攻撃";
  }

  if (side === "defense") {
    return "守備";
  }

  return "";
}

function formatTitleDownDistance(down: string, toGoYards: string): string {
  const normalizedDown = down.trim();
  const normalizedDistance = toGoYards.trim();

  if (!normalizedDown && !normalizedDistance) {
    return "";
  }

  if (normalizedDown === "0") {
    return "TFP";
  }

  const downNumber = Number.parseInt(normalizedDown, 10);
  const downLabel = Number.isFinite(downNumber) ? formatDownLabel(downNumber)?.replace(" ダウン", "") ?? "" : "";

  if (downLabel && normalizedDistance) {
    return `${downLabel}&${normalizedDistance}`;
  }

  return downLabel || (normalizedDistance ? `To Go ${normalizedDistance}` : "");
}

export function buildQuickClipTitle(form: Pick<QuickClipForm, "side" | "formation" | "playType" | "down" | "toGoYards">): string {
  return [
    formatQuickSideLabel(form.side),
    form.formation.trim(),
    form.playType.trim(),
    formatTitleDownDistance(form.down, form.toGoYards),
  ]
    .filter(Boolean)
    .join(" ");
}

export function advanceQuickDown(down: string): string {
  const normalized = down.trim();

  if (!normalized || normalized === "0") {
    return normalized;
  }

  const parsed = Number.parseInt(normalized, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return normalized;
  }

  return parsed >= 4 ? "1" : String(parsed + 1);
}

export function nudgeTimestampText(value: string, deltaSeconds: number): string {
  const parsed = parseTimestamp(value);

  if (parsed === null) {
    return value;
  }

  return formatSecondsAsTime(Math.max(0, parsed + deltaSeconds));
}

export function getQuickClipDefaultsAfterSave(form: QuickClipForm): QuickClipForm {
  return {
    ...form,
    startText: "",
    endText: "",
    down: advanceQuickDown(form.down),
  };
}

export function isQuickClipDirty(form: QuickClipForm): boolean {
  return Object.values(form).some((value) => value.trim().length > 0);
}
```

- [ ] **Step 5: Run helper tests and verify they pass**

Run:

```bash
npx tsc -p tsconfig.playbook-test.json
node .tmp/playbook-test/lib/video-room/playbook-matching.test.js
node .tmp/playbook-test/lib/video-room/quick-registration.test.js
```

Expected: all commands exit 0 with no thrown errors.

- [ ] **Step 6: Commit helper changes**

Run:

```bash
git add lib/video-room/quick-registration.ts lib/video-room/quick-registration.test.ts tsconfig.playbook-test.json
git commit -m "feat: add quick clip registration helpers"
```

## Task 2: Quick Registration Bar Component

**Files:**
- Create: `components/video-room/quick-clip-registration-bar.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Create the component**

Create `components/video-room/quick-clip-registration-bar.tsx`:

```tsx
"use client";

import type { QuickClipForm, QuickClipSide } from "@/lib/video-room/quick-registration";
import { buildQuickClipTitle } from "@/lib/video-room/quick-registration";
import { Clock3, Save } from "lucide-react";
import type { KeyboardEvent } from "react";

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
        <label className="field-stack film-quick-time-field">
          <span className="field-label">開始</span>
          <div className="film-quick-time-row">
            <input
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
        </label>

        <label className="field-stack film-quick-time-field">
          <span className="field-label">終了</span>
          <div className="film-quick-time-row">
            <input
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
        </label>

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
```

- [ ] **Step 2: Add quick bar styles**

Append near the existing film styles in `app/globals.css`:

```css
.film-quick-register {
  display: grid;
  gap: 12px;
  margin-top: 14px;
  padding: 14px;
  border: 1px solid rgba(23, 50, 77, 0.14);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
}

.film-quick-register-head,
.film-quick-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.film-quick-register-head strong {
  display: block;
  color: var(--ink);
}

.film-quick-register-head span,
.film-quick-title-preview {
  color: var(--muted);
  font-size: 0.84rem;
  line-height: 1.5;
}

.film-quick-title-preview {
  padding: 8px 10px;
  border: 1px solid rgba(23, 50, 77, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.7);
  font-weight: 800;
}

.film-quick-grid {
  display: grid;
  grid-template-columns: minmax(138px, 1fr) minmax(138px, 1fr) minmax(112px, 0.7fr) minmax(140px, 1fr) minmax(140px, 1fr) minmax(96px, 0.6fr) minmax(86px, 0.55fr);
  gap: 10px;
  align-items: end;
}

.film-quick-time-row,
.film-quick-side-row {
  display: flex;
  gap: 6px;
}

.film-quick-time-row input {
  min-width: 72px;
}

.film-quick-time-row .button,
.film-quick-side-row .button {
  flex: 1;
  justify-content: center;
  min-height: 42px;
}

@media (max-width: 1100px) {
  .film-quick-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .film-quick-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 4: Commit the component**

Run:

```bash
git add components/video-room/quick-clip-registration-bar.tsx app/globals.css
git commit -m "feat: add quick clip registration bar"
```

## Task 3: Editing and Viewing Mode Wiring

**Files:**
- Modify: `components/audiovisual-room.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Add imports and mode state**

In `components/audiovisual-room.tsx`, update imports:

```ts
import { QuickClipRegistrationBar } from "@/components/video-room/quick-clip-registration-bar";
import {
  buildQuickClipTitle,
  getQuickClipDefaultsAfterSave,
  initialQuickClipForm,
  isQuickClipDirty,
  nudgeTimestampText,
  type QuickClipForm,
} from "@/lib/video-room/quick-registration";
import { Edit3, MonitorPlay } from "lucide-react";
```

Keep existing lucide imports and add `Edit3` and `MonitorPlay` to the existing import list instead of creating a duplicate lucide import.

Add types near the local form types:

```ts
type VideoRoomMode = "view" | "edit";
```

Add state near the other `useState` declarations:

```ts
const [videoRoomMode, setVideoRoomMode] = useState<VideoRoomMode>("view");
const [quickClipForm, setQuickClipForm] = useState<QuickClipForm>(initialQuickClipForm);
const isEditingMode = canManageTeam && videoRoomMode === "edit";
```

- [ ] **Step 2: Persist coach mode locally**

Add an effect after existing state/effects setup:

```ts
useEffect(() => {
  if (!canManageTeam || typeof window === "undefined") {
    return;
  }

  const savedMode = window.localStorage.getItem("farthest-frontier-video-room-mode");
  if (savedMode === "view" || savedMode === "edit") {
    setVideoRoomMode(savedMode);
  }
}, [canManageTeam]);

useEffect(() => {
  if (!canManageTeam || typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem("farthest-frontier-video-room-mode", videoRoomMode);
}, [canManageTeam, videoRoomMode]);

useEffect(() => {
  if (!canManageTeam && videoRoomMode !== "view") {
    setVideoRoomMode("view");
  }
}, [canManageTeam, videoRoomMode]);
```

- [ ] **Step 3: Add quick form update helpers**

Add these functions near `updateClipForm`:

```ts
function updateQuickClipForm<Key extends keyof QuickClipForm>(key: Key, value: QuickClipForm[Key]) {
  setQuickClipForm((current) => ({ ...current, [key]: value }));
}

function setQuickClipTimeFromCurrent(field: "startText" | "endText") {
  setQuickClipForm((current) => ({
    ...current,
    [field]: formatSecondsAsTime(currentTime),
  }));
}

function nudgeQuickClipTimestamp(field: "startText" | "endText", deltaSeconds: number) {
  setQuickClipForm((current) => ({
    ...current,
    [field]: nudgeTimestampText(current[field], deltaSeconds),
  }));
}
```

- [ ] **Step 4: Add safe mode switching**

Add:

```ts
function hasDirtyDetailedClipForm() {
  return Boolean(editingClipId || showClipComposer);
}

function switchVideoRoomMode(nextMode: VideoRoomMode) {
  if (!canManageTeam || nextMode === videoRoomMode) {
    return;
  }

  if (nextMode === "view" && (isQuickClipDirty(quickClipForm) || hasDirtyDetailedClipForm())) {
    const shouldDiscard = window.confirm("未保存の編集内容を破棄して視聴モードに切り替えますか？");
    if (!shouldDiscard) {
      return;
    }

    if (selectedVideo) {
      resetClipForm(selectedVideo.id);
    }
    setShowClipComposer(false);
    setQuickClipForm(initialQuickClipForm);
  }

  setVideoRoomMode(nextMode);
}
```

- [ ] **Step 5: Hide management controls in viewing mode**

Replace coach-only render checks that expose editing controls from `canManageTeam` to `isEditingMode` where the action modifies data. Use these exact targets:

- In the detail sheet condition, keep the panel visible for reading, but change the edit-form branch from `canManageTeam && selectedVideo && editingClipId === detailClip.id` to `isEditingMode && selectedVideo && editingClipId === detailClip.id`.
- In the detail action branch, change `canManageTeam && selectedVideo ?` to `isEditingMode && selectedVideo ?` so `リンクをコピー` remains visible through the existing `selectedVideo ?` fallback.
- In the whiteboard area, change the editor composer branch from `canManageTeam ?` to `isEditingMode ?`.
- In each saved whiteboard card, change the edit/delete action branch from `canManageTeam ?` to `isEditingMode ?`.
- In the inline add-annotation area below playback, change `canManageTeam && selectedVideo ?` to `isEditingMode && selectedVideo ?`.
- In the lower management panels for video creation, clip import, and playbook asset management, change the outer coach-only render gates from `canManageTeam ?` to `isEditingMode ?`.

Do not change read-only playback, clip list, filters, detail viewing, saved whiteboard viewing, or copy-link actions.

- [ ] **Step 6: Add the mode toggle UI**

Near the video room header or the selected-video section header, render only for coaches:

```tsx
{canManageTeam ? (
  <div className="film-mode-toggle" role="group" aria-label="動画ルームのモード">
    <button
      className={`button secondary button-compact ${videoRoomMode === "view" ? "is-selected" : ""}`}
      type="button"
      onClick={() => switchVideoRoomMode("view")}
    >
      <MonitorPlay aria-hidden="true" />
      視聴
    </button>
    <button
      className={`button secondary button-compact ${videoRoomMode === "edit" ? "is-selected" : ""}`}
      type="button"
      onClick={() => switchVideoRoomMode("edit")}
    >
      <Edit3 aria-hidden="true" />
      編集
    </button>
  </div>
) : null}
```

- [ ] **Step 7: Add mode toggle CSS**

Add to `app/globals.css` near film styles:

```css
.film-mode-toggle {
  display: inline-flex;
  gap: 6px;
  padding: 4px;
  border: 1px solid rgba(23, 50, 77, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.68);
}

.button.is-selected {
  border-color: rgba(232, 96, 45, 0.38);
  background: rgba(232, 96, 45, 0.14);
  color: var(--accent-strong);
}
```

- [ ] **Step 8: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 9: Commit mode wiring**

Run:

```bash
git add components/audiovisual-room.tsx app/globals.css
git commit -m "feat: add video room viewing and editing modes"
```

## Task 4: Quick Save Flow Integration

**Files:**
- Modify: `components/audiovisual-room.tsx`

- [ ] **Step 1: Extract a reusable clip-save function**

Refactor `handleSaveClip` so the core save logic accepts a `ClipForm` argument and an optional `afterSave` callback:

```ts
async function saveClipFromForm(sourceForm: ClipForm, options?: { afterSave?: (savedClipId: string) => void }) {
  const startSeconds = parseTimestamp(sourceForm.startText);
  const endSeconds = parseTimestamp(sourceForm.endText);
  const targetVideoId = sourceForm.videoId || selectedVideo?.id || "";

  if (!canManageTeam || syncing || !targetVideoId) {
    return;
  }

  const nextClipBase = {
    title: sourceForm.title.trim(),
    formation: sourceForm.formation.trim(),
    playType: sourceForm.playType.trim(),
    down: parseDown(sourceForm.down),
    toGoYards: sourceForm.toGoYards.trim() || undefined,
    penaltyType: sourceForm.penaltyType.trim() || undefined,
    playerLinks: sanitizePlayerLinks(sourceForm.playerLinks),
    comment: sourceForm.comment.trim(),
    coachComment: canManageTeam ? sourceForm.coachComment.trim() || undefined : undefined,
  };

  if (!nextClipBase.title || startSeconds === null || endSeconds === null) {
    setTeamMessage("プレータイトルと開始/終了時刻を入れてください。時刻は 1:23 のように指定できます。");
    return;
  }

  if (endSeconds <= startSeconds) {
    setTeamMessage("終了時刻は開始時刻より後にしてください。");
    return;
  }

  const currentVideo = filmRoomVideos.find((video) => video.id === targetVideoId);
  const nextClip = {
    ...nextClipBase,
    startSeconds,
    endSeconds,
    whiteboards: editingClipId
      ? currentVideo?.clips.find((clip) => clip.id === editingClipId)?.whiteboards ?? []
      : [],
    focusTargets: sourceForm.focusTargets,
  };

  try {
    setSyncing(true);
    const saved =
      editingClipId
        ? usingRemoteData && supabase
          ? await updateFilmClip(supabase, { id: editingClipId, ...nextClip, videoId: targetVideoId })
          : {
              videoId: targetVideoId,
              clip: {
                id: editingClipId,
                ...nextClip,
              },
            }
        : usingRemoteData && supabase
          ? await insertFilmClip(supabase, { ...nextClip, videoId: targetVideoId, sortOrder: (currentVideo?.clips.length ?? 0) + 1 })
          : {
              videoId: targetVideoId,
              clip: {
                id: `fc-${Date.now()}`,
                ...nextClip,
              },
            };

    setFilmRoomVideos((current) =>
      current.map((video) =>
        video.id === saved.videoId
          ? {
              ...video,
              clips: sortClips(
                editingClipId
                  ? video.clips.map((clip) => (clip.id === saved.clip.id ? saved.clip : clip))
                  : [...video.clips, saved.clip],
              ),
              updatedAt: new Date().toISOString().slice(0, 10),
            }
          : video,
      ),
    );
    resetClipForm(targetVideoId);
    setShowClipComposer(false);
    setSelectedVideoId(targetVideoId);
    setSelectedClipId(saved.clip.id);
    options?.afterSave?.(saved.clip.id);
    setTeamMessage(`プレー「${saved.clip.title}」を${editingClipId ? "更新" : "追加"}しました。`);
  } catch (error) {
    setTeamMessage(error instanceof Error ? error.message : `プレーの${editingClipId ? "更新" : "追加"}に失敗しました。`);
  } finally {
    setSyncing(false);
  }
}

async function handleSaveClip() {
  await saveClipFromForm(clipForm);
}
```

- [ ] **Step 2: Add quick-save handler**

Add:

```ts
async function handleSaveQuickClip() {
  if (!selectedVideo || !isEditingMode) {
    return;
  }

  const title = buildQuickClipTitle(quickClipForm);
  const quickSourceForm: ClipForm = {
    ...initialClipForm,
    videoId: selectedVideo.id,
    title,
    startText: quickClipForm.startText,
    endText: quickClipForm.endText,
    down: quickClipForm.down,
    toGoYards: quickClipForm.toGoYards,
    formation: quickClipForm.formation,
    playType: quickClipForm.playType,
  };

  await saveClipFromForm(quickSourceForm, {
    afterSave: () => setQuickClipForm(getQuickClipDefaultsAfterSave(quickClipForm)),
  });
}
```

- [ ] **Step 3: Render the quick bar below playback**

In the editing-only inline editor area, render `QuickClipRegistrationBar` as the first child of `.film-inline-editor-wrap`, before the existing `.film-inline-actions` block. Keep the existing add-annotation button and `VideoClipEditor` composer JSX immediately after this new component without changing their body.

```tsx
{isEditingMode && selectedVideo ? (
  <div className="film-inline-editor-wrap">
    <QuickClipRegistrationBar
      availableFormations={availableFormations}
      availablePlayTypes={availablePlayTypes}
      disabled={syncing || Boolean(editingClipId)}
      formationListId={`${formationListId}-quick`}
      form={quickClipForm}
      onNudgeTimestamp={nudgeQuickClipTimestamp}
      onSave={() => void handleSaveQuickClip()}
      onSetCurrentTime={setQuickClipTimeFromCurrent}
      onUpdate={updateQuickClipForm}
      playTypeListId={`${playTypeListId}-quick`}
    />
  </div>
) : null}
```

- [ ] **Step 4: Run helper tests and typecheck**

Run:

```bash
npx tsc -p tsconfig.playbook-test.json
node .tmp/playbook-test/lib/video-room/quick-registration.test.js
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit quick-save integration**

Run:

```bash
git add components/audiovisual-room.tsx
git commit -m "feat: wire quick clip save flow"
```

## Task 5: Final Verification and Browser QA

**Files:**
- Modify only if verification finds issues.

- [ ] **Step 1: Run full verification**

Run:

```bash
npx tsc -p tsconfig.playbook-test.json
node .tmp/playbook-test/lib/video-room/playbook-matching.test.js
node .tmp/playbook-test/lib/video-room/quick-registration.test.js
npm run typecheck
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`

Expected: Next.js starts and prints a local URL, usually `http://localhost:3000`.

- [ ] **Step 3: Open the app in the in-app browser**

Open the local URL. Navigate to the audiovisual/video room.

Expected in coach session:

- A `視聴` / `編集` segmented control is visible.
- Viewing mode hides quick registration and edit/delete/create controls.
- Editing mode shows the quick registration bar below the player.
- Switching back to viewing mode with unsaved quick fields prompts before discarding.

- [ ] **Step 4: Manual quick-save smoke test**

In editing mode:

1. Click `現在` for start.
2. Move the video forward or type an end time after start.
3. Choose `攻撃`, enter a formation, enter a play type, set `1st`, and distance `10`.
4. Click `保存`.

Expected:

- A clip is added to the selected video.
- Its title follows the generated pattern, such as `攻撃 Trips Pass 1st&10`.
- The quick form clears start/end.
- Down advances to `2`.
- Side, formation, play type, and distance remain filled.

- [ ] **Step 5: Commit any QA fixes**

If QA required code changes, run the targeted verification again, then commit:

```bash
git add components/audiovisual-room.tsx components/video-room/quick-clip-registration-bar.tsx app/globals.css lib/video-room/quick-registration.ts lib/video-room/quick-registration.test.ts tsconfig.playbook-test.json
git commit -m "fix: polish quick play registration flow"
```

If no changes were needed, do not create an empty commit.
