# Coach Weekly Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a coach-only weekly review page where coaches can scan every player's weekly goals and reflections from one card list.

**Architecture:** Add pure review helper functions under `lib/coach-weekly-review.ts`, test them with the existing compile-and-run TypeScript test style, then add a `CoachWeeklyReview` client component wired through `AppShell` and `/weekly-review`. The view is read-only and links to existing per-player goal and reflection pages for edits.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, existing local/Supabase team context, CSS in `app/globals.css`.

---

## File Structure

- Create `lib/coach-weekly-review.ts`: pure helpers for date options, player sorting, entry status classification, filtering, and summary counts.
- Create `lib/coach-weekly-review.test.ts`: direct TypeScript tests that throw on failure, matching the existing `lib/video-room/*.test.ts` style.
- Modify `tsconfig.playbook-test.json`: include the new helper and test files so they can compile to `/private/tmp/ff-playbook-test`.
- Create `components/coach-weekly-review.tsx`: read-only coach weekly review UI.
- Modify `components/app-shell.tsx`: add `weekly-review` view and authorization wiring.
- Modify `components/team-dashboard.tsx`: add coach-only entry link from the weekly panel.
- Modify `components/global-header.tsx`: include `weekly-review` in the view type and keep home active.
- Create `app/weekly-review/page.tsx`: route entry for the review page.
- Modify `app/globals.css`: add scoped weekly review card/list styles.

---

### Task 1: Review Helper Tests

**Files:**
- Create: `lib/coach-weekly-review.test.ts`
- Modify: `tsconfig.playbook-test.json`

- [ ] **Step 1: Write the failing test**

Create `lib/coach-weekly-review.test.ts` with:

```ts
import {
  buildCoachReviewDateOptions,
  classifyCoachReviewEntry,
  filterCoachReviewPlayers,
  getCoachReviewSummary,
  sortCoachReviewPlayers,
} from "./coach-weekly-review.js";
import type { Player } from "@/lib/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const players: Player[] = [
  {
    id: "p2",
    name: "佐藤 杏",
    jerseyNumber: "12",
    gradeLabel: "4年",
    active: true,
    guardianName: "佐藤",
    favoriteSkill: "キャッチ",
    offensePositionIds: ["wr"],
    defensePositionIds: ["s"],
    practiceEntries: [
      {
        practiceDate: "2026-05-02",
        offenseGoal: "声を3回出す",
        offenseReflectionRating: 5,
        offenseReflectionComment: "よく声が出た",
      },
    ],
  },
  {
    id: "p1",
    name: "高橋 蓮",
    jerseyNumber: "7",
    gradeLabel: "5年",
    active: true,
    guardianName: "高橋",
    favoriteSkill: "ラン",
    offensePositionIds: ["qb"],
    defensePositionIds: ["db"],
    practiceEntries: [
      {
        practiceDate: "2026-05-02",
        offenseGoal: "最初の1歩を速く出す",
        defenseGoal: "相手の腰を見る",
        offenseReflectionRating: 4,
        defenseReflectionRating: 3,
        defenseReflectionComment: "途中で見失った",
      },
      {
        practiceDate: "2026-04-25",
        defenseGoal: "横に流れすぎない",
      },
    ],
  },
  {
    id: "p3",
    name: "山田 海",
    jerseyNumber: "",
    gradeLabel: "3年",
    active: false,
    guardianName: "山田",
    favoriteSkill: "フラッグ",
    offensePositionIds: [],
    defensePositionIds: [],
    practiceEntries: [],
  },
];

const sorted = sortCoachReviewPlayers(players, ["p2"]);
assert(sorted.map((player) => player.id).join(",") === "p2,p1,p3", `Unexpected sort order: ${sorted.map((player) => player.id).join(",")}`);

const dateOptions = buildCoachReviewDateOptions(players, "2026-05-02", 2);
assert(dateOptions.includes("2026-05-02"), "Date options should include anchor date");
assert(dateOptions.includes("2026-04-25"), "Date options should include practice entry date");
assert(dateOptions[0] === "2026-05-02", `Newest date should be first, got ${dateOptions[0]}`);

assert(classifyCoachReviewEntry(players[0].practiceEntries[0]).status === "partial-reflection", "Single-side reflection should be partial");
assert(classifyCoachReviewEntry(players[1].practiceEntries[0]).status === "complete", "Both sides reflected should be complete");
assert(classifyCoachReviewEntry(undefined).status === "missing-goal", "Missing entry should be missing-goal");

const summary = getCoachReviewSummary(players, "2026-05-02");
assert(summary.activePlayers === 2, `Expected 2 active players, got ${summary.activePlayers}`);
assert(summary.playersWithGoal === 2, `Expected 2 players with goals, got ${summary.playersWithGoal}`);
assert(summary.playersWithAnyReflection === 2, `Expected 2 players with reflection, got ${summary.playersWithAnyReflection}`);
assert(summary.playersComplete === 1, `Expected 1 complete player, got ${summary.playersComplete}`);
assert(summary.playersNeedingAttention === 1, `Expected 1 attention player, got ${summary.playersNeedingAttention}`);

const filteredByName = filterCoachReviewPlayers(players, "高橋", "all", "2026-05-02");
assert(filteredByName.length === 1 && filteredByName[0].id === "p1", "Name filter should return 高橋");

const filteredByStatus = filterCoachReviewPlayers(players, "", "partial-reflection", "2026-05-02");
assert(filteredByStatus.length === 1 && filteredByStatus[0].id === "p2", "Status filter should return partial reflection player");
```

Modify `tsconfig.playbook-test.json` include list:

```json
  "include": [
    "lib/video-room/playbook-matching.ts",
    "lib/video-room/playbook-matching.test.ts",
    "lib/video-room/utils.ts",
    "lib/video-room/utils.test.ts",
    "lib/coach-weekly-review.ts",
    "lib/coach-weekly-review.test.ts"
  ]
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx tsc -p tsconfig.playbook-test.json
```

Expected: FAIL because `lib/coach-weekly-review.ts` does not exist or does not export the helper functions.

- [ ] **Step 3: Commit**

Do not commit yet. Keep the failing test uncommitted until Task 2 passes.

---

### Task 2: Review Helper Implementation

**Files:**
- Create: `lib/coach-weekly-review.ts`
- Test: `lib/coach-weekly-review.test.ts`

- [ ] **Step 1: Write minimal implementation**

Create `lib/coach-weekly-review.ts`:

```ts
import { getRecentPracticeDates } from "@/lib/date";
import type { Player, PlayerPracticeEntry } from "@/lib/types";
import { getPracticeEntry } from "@/lib/utils";

export type CoachReviewStatus = "missing-goal" | "goal-only" | "partial-reflection" | "complete";

export type CoachReviewStatusFilter = CoachReviewStatus | "all" | "needs-attention";

export type CoachReviewEntryState = {
  status: CoachReviewStatus;
  hasGoal: boolean;
  hasAnyReflection: boolean;
  isComplete: boolean;
};

export type CoachReviewSummary = {
  activePlayers: number;
  playersWithGoal: number;
  playersWithAnyReflection: number;
  playersComplete: number;
  playersNeedingAttention: number;
};

export function classifyCoachReviewEntry(entry?: PlayerPracticeEntry): CoachReviewEntryState {
  const hasOffenseGoal = Boolean(entry?.offenseGoal);
  const hasDefenseGoal = Boolean(entry?.defenseGoal);
  const hasGoal = hasOffenseGoal || hasDefenseGoal;
  const hasOffenseReflection = Boolean(entry?.offenseReflectionRating);
  const hasDefenseReflection = Boolean(entry?.defenseReflectionRating);
  const hasAnyReflection = hasOffenseReflection || hasDefenseReflection;

  const expectedReflectionCount = Number(hasOffenseGoal) + Number(hasDefenseGoal);
  const actualReflectionCount = Number(hasOffenseGoal && hasOffenseReflection) + Number(hasDefenseGoal && hasDefenseReflection);
  const isComplete = hasGoal && expectedReflectionCount === actualReflectionCount;

  if (!hasGoal) {
    return { status: "missing-goal", hasGoal, hasAnyReflection, isComplete: false };
  }

  if (isComplete) {
    return { status: "complete", hasGoal, hasAnyReflection, isComplete };
  }

  if (hasAnyReflection) {
    return { status: "partial-reflection", hasGoal, hasAnyReflection, isComplete };
  }

  return { status: "goal-only", hasGoal, hasAnyReflection, isComplete };
}

export function sortCoachReviewPlayers(players: Player[], linkedPlayerIds: string[]): Player[] {
  return [...players].sort((left, right) => {
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
}

export function buildCoachReviewDateOptions(players: Player[], anchorDate: string, recentCount = 6): string[] {
  return Array.from(
    new Set([
      ...getRecentPracticeDates(recentCount, anchorDate),
      ...players.flatMap((player) => player.practiceEntries.map((entry) => entry.practiceDate)),
    ]),
  ).sort((left, right) => right.localeCompare(left));
}

export function filterCoachReviewPlayers(
  players: Player[],
  searchText: string,
  statusFilter: CoachReviewStatusFilter,
  practiceDate: string,
): Player[] {
  const normalizedSearch = searchText.trim();

  return players.filter((player) => {
    if (normalizedSearch && !player.name.includes(normalizedSearch) && !player.jerseyNumber.includes(normalizedSearch)) {
      return false;
    }

    if (statusFilter === "all") {
      return true;
    }

    const state = classifyCoachReviewEntry(getPracticeEntry(player, practiceDate));

    if (statusFilter === "needs-attention") {
      return state.status !== "complete";
    }

    return state.status === statusFilter;
  });
}

export function getCoachReviewSummary(players: Player[], practiceDate: string): CoachReviewSummary {
  const activePlayers = players.filter((player) => player.active);

  return activePlayers.reduce<CoachReviewSummary>(
    (summary, player) => {
      const state = classifyCoachReviewEntry(getPracticeEntry(player, practiceDate));

      return {
        activePlayers: summary.activePlayers + 1,
        playersWithGoal: summary.playersWithGoal + Number(state.hasGoal),
        playersWithAnyReflection: summary.playersWithAnyReflection + Number(state.hasAnyReflection),
        playersComplete: summary.playersComplete + Number(state.isComplete),
        playersNeedingAttention: summary.playersNeedingAttention + Number(state.status !== "complete"),
      };
    },
    {
      activePlayers: 0,
      playersWithGoal: 0,
      playersWithAnyReflection: 0,
      playersComplete: 0,
      playersNeedingAttention: 0,
    },
  );
}
```

- [ ] **Step 2: Run test to verify it passes**

Run:

```bash
npx tsc -p tsconfig.playbook-test.json && node /private/tmp/ff-playbook-test/lib/coach-weekly-review.test.js
```

Expected: PASS with no output and exit code `0`.

- [ ] **Step 3: Commit**

Run:

```bash
git add lib/coach-weekly-review.ts lib/coach-weekly-review.test.ts tsconfig.playbook-test.json
git commit -m "feat: add coach weekly review helpers"
```

---

### Task 3: Coach Weekly Review Component

**Files:**
- Create: `components/coach-weekly-review.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Create the component**

Create `components/coach-weekly-review.tsx`:

```tsx
"use client";

import { Section } from "@/components/section";
import {
  buildCoachReviewDateOptions,
  classifyCoachReviewEntry,
  CoachReviewStatusFilter,
  filterCoachReviewPlayers,
  getCoachReviewSummary,
  sortCoachReviewPlayers,
} from "@/lib/coach-weekly-review";
import { formatDisplayDate, getDashboardPracticeDate } from "@/lib/date";
import type { Player, PlayerPracticeEntry, PositionMaster, TeamRole } from "@/lib/types";
import { getPositionLabels, getPracticeEntry, getReflectionEmoji } from "@/lib/utils";
import Link from "next/link";
import { useMemo, useState } from "react";

type CoachWeeklyReviewProps = {
  players: Player[];
  positionMasters: PositionMaster[];
  linkedPlayerIds: string[];
  teamRole: TeamRole | null;
  teamMessage: string | null;
};

const statusOptions: Array<{ value: CoachReviewStatusFilter; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "needs-attention", label: "確認が必要" },
  { value: "missing-goal", label: "目標なし" },
  { value: "goal-only", label: "目標のみ" },
  { value: "partial-reflection", label: "振り返り途中" },
  { value: "complete", label: "振り返り完了" },
];

function ReviewSide({
  label,
  goal,
  rating,
  comment,
}: {
  label: string;
  goal?: string;
  rating?: PlayerPracticeEntry["offenseReflectionRating"];
  comment?: string;
}) {
  const emoji = getReflectionEmoji(rating);

  return (
    <div className="weekly-review-side">
      <span>{label}</span>
      <strong>{goal ?? "未入力"}</strong>
      {rating ? (
        <div className="weekly-review-reflection">
          <span className="chip ok">{emoji} {rating}</span>
          {comment ? <p>{comment}</p> : <p className="subtle">コメントなし</p>}
        </div>
      ) : (
        <p className="subtle">{goal ? "振り返り未入力" : "目標を入れると振り返れます"}</p>
      )}
    </div>
  );
}

export function CoachWeeklyReview({
  players,
  positionMasters,
  linkedPlayerIds,
  teamRole,
  teamMessage,
}: CoachWeeklyReviewProps) {
  const defaultPracticeDate = getDashboardPracticeDate();
  const [selectedPracticeDate, setSelectedPracticeDate] = useState(defaultPracticeDate);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<CoachReviewStatusFilter>("all");

  const dateOptions = useMemo(
    () => buildCoachReviewDateOptions(players, defaultPracticeDate),
    [defaultPracticeDate, players],
  );

  const visiblePlayers = useMemo(() => {
    const sortedPlayers = sortCoachReviewPlayers(players, linkedPlayerIds);
    return filterCoachReviewPlayers(sortedPlayers, searchText, statusFilter, selectedPracticeDate);
  }, [linkedPlayerIds, players, searchText, selectedPracticeDate, statusFilter]);

  const summary = useMemo(
    () => getCoachReviewSummary(players, selectedPracticeDate),
    [players, selectedPracticeDate],
  );

  if (teamRole === "guardian") {
    return (
      <Section title="週次レビュー" copy="この画面はコーチ向けです。">
        <Link className="button secondary" href="/">
          ホームへ戻る
        </Link>
      </Section>
    );
  }

  return (
    <div className="stack weekly-review-page">
      <section className="week-panel weekly-review-hero">
        <div className="week-panel-header">
          <div>
            <span className="eyebrow">Coach review</span>
            <h2>週次レビュー</h2>
            <p>{formatDisplayDate(selectedPracticeDate)}週の目標と振り返り</p>
          </div>
          <Link className="button secondary button-compact" href="/">
            ホームへ戻る
          </Link>
        </div>
        <div className="weekly-review-stats">
          <span className="chip ok">目標 {summary.playersWithGoal} / {summary.activePlayers}</span>
          <span className="chip ok">振り返り {summary.playersWithAnyReflection} / {summary.activePlayers}</span>
          <span className="chip warn">確認が必要 {summary.playersNeedingAttention}</span>
        </div>
      </section>

      <div className="status-strip dashboard-status">
        {teamMessage ? <span className="subtle compact-message">{teamMessage}</span> : null}
      </div>

      <section className="player-section">
        <div className="toolbar weekly-review-toolbar">
          <label className="field-stack">
            <span className="field-label">練習日</span>
            <select value={selectedPracticeDate} onChange={(event) => setSelectedPracticeDate(event.target.value)}>
              {dateOptions.map((practiceDate) => (
                <option key={practiceDate} value={practiceDate}>
                  {formatDisplayDate(practiceDate)}
                </option>
              ))}
            </select>
          </label>
          <label className="field-stack">
            <span className="field-label">状態</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as CoachReviewStatusFilter)}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <input
            type="search"
            placeholder="選手名・背番号で検索"
            aria-label="選手名・背番号で検索"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <div className="toolbar-count">表示 {visiblePlayers.length}人</div>
        </div>

        {players.length ? (
          <div className="weekly-review-grid">
            {visiblePlayers.map((player) => {
              const entry = getPracticeEntry(player, selectedPracticeDate);
              const state = classifyCoachReviewEntry(entry);
              const canOpenReflection = Boolean(entry?.offenseGoal || entry?.defenseGoal);

              return (
                <article className={`practice-card weekly-review-card is-${state.status}`} key={player.id}>
                  <div className="practice-card-head">
                    <div>
                      <strong>{player.jerseyNumber ? `#${player.jerseyNumber} ${player.name}` : player.name}</strong>
                      <div className="subtle">
                        {player.gradeLabel} / OF: {getPositionLabels(player.offensePositionIds, positionMasters)} / DF: {getPositionLabels(player.defensePositionIds, positionMasters)}
                      </div>
                    </div>
                    <span className={`chip ${player.active ? "ok" : "warn"}`}>{player.active ? "在籍中" : "休会"}</span>
                  </div>

                  <div className="chip-row compact-chip-row">
                    <span className={`chip ${state.status === "complete" ? "ok" : "warn"}`}>
                      {statusOptions.find((option) => option.value === state.status)?.label}
                    </span>
                  </div>

                  <div className="weekly-review-sides">
                    <ReviewSide
                      label="OF"
                      goal={entry?.offenseGoal}
                      rating={entry?.offenseReflectionRating}
                      comment={entry?.offenseReflectionComment}
                    />
                    <ReviewSide
                      label="DF"
                      goal={entry?.defenseGoal}
                      rating={entry?.defenseReflectionRating}
                      comment={entry?.defenseReflectionComment}
                    />
                  </div>

                  <div className="practice-actions">
                    <Link className="button secondary button-compact" href={`/players/${player.id}/goals?date=${selectedPracticeDate}`}>
                      目標を見る
                    </Link>
                    {canOpenReflection ? (
                      <Link className="button button-compact" href={`/players/${player.id}/reflections?date=${selectedPracticeDate}`}>
                        振り返りを見る
                      </Link>
                    ) : (
                      <span className="button button-compact is-disabled">振り返り</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="empty-state">まだ選手がいません。選手管理ページから最初の1人を追加できます。</p>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Add component styles**

Append to the dashboard/review area in `app/globals.css`:

```css
.weekly-review-page {
  gap: 18px;
}

.weekly-review-hero {
  min-height: auto;
}

.weekly-review-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.weekly-review-toolbar {
  align-items: end;
}

.weekly-review-toolbar .field-stack {
  min-width: 160px;
}

.weekly-review-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 14px;
}

.weekly-review-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.weekly-review-card.is-complete {
  border-color: rgba(69, 139, 86, 0.45);
}

.weekly-review-card.is-missing-goal,
.weekly-review-card.is-goal-only,
.weekly-review-card.is-partial-reflection {
  border-color: rgba(210, 151, 52, 0.45);
}

.weekly-review-sides {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.weekly-review-side {
  min-height: 148px;
  padding: 12px;
  border: 1px solid rgba(34, 59, 43, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
}

.weekly-review-side > span {
  display: block;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.weekly-review-side > strong {
  display: block;
  margin-top: 6px;
  color: var(--ink);
  line-height: 1.45;
}

.weekly-review-reflection {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}

.weekly-review-reflection p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}

@media (max-width: 640px) {
  .weekly-review-sides {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add components/coach-weekly-review.tsx app/globals.css
git commit -m "feat: add coach weekly review component"
```

---

### Task 4: Routing and App Shell Wiring

**Files:**
- Modify: `components/app-shell.tsx`
- Modify: `components/global-header.tsx`
- Create: `app/weekly-review/page.tsx`

- [ ] **Step 1: Wire the new view**

In `components/app-shell.tsx`, import the component:

```ts
import { CoachWeeklyReview } from "@/components/coach-weekly-review";
```

Extend the `view` union with `"weekly-review"`:

```ts
type AppShellProps = {
  view?: "dashboard" | "weekly-review" | "players" | "masters" | "materials" | "audiovisual" | "materials-manage" | "settings" | "player-goal" | "player-reflection" | "player-season-goal";
  playerId?: string;
  practiceDate?: string;
};
```

Add a branch before the player-specific branches:

```tsx
      ) : view === "weekly-review" ? (
        <CoachWeeklyReview
          players={players}
          positionMasters={positionMasters}
          linkedPlayerIds={linkedPlayerIds}
          teamRole={teamRole}
          teamMessage={teamMessage}
        />
```

- [ ] **Step 2: Keep home active in the header**

In `components/global-header.tsx`, extend the `view` type with `"weekly-review"`:

```ts
type GlobalHeaderProps = {
  view: "dashboard" | "weekly-review" | "players" | "masters" | "materials" | "audiovisual" | "materials-manage" | "settings" | "player-goal" | "player-reflection" | "player-season-goal";
  teamRole?: "coach" | "guardian" | null;
  onSignOut?: () => void;
};
```

Update the active-class condition so the home tab is active for the review view:

```tsx
className={`tab-link ${view === item.view || (view === "weekly-review" && item.view === "dashboard") || ((view === "player-goal" || view === "player-reflection" || view === "player-season-goal") && item.view === "dashboard") || ((view === "players" || view === "masters" || view === "materials-manage") && item.view === "settings") ? "is-active" : ""}`}
```

- [ ] **Step 3: Add the route**

Create `app/weekly-review/page.tsx`:

```tsx
import { AppShell } from "@/components/app-shell";

export default function WeeklyReviewPage() {
  return <AppShell view="weekly-review" />;
}
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add components/app-shell.tsx components/global-header.tsx app/weekly-review/page.tsx
git commit -m "feat: route coach weekly review"
```

---

### Task 5: Dashboard Entry Point

**Files:**
- Modify: `components/team-dashboard.tsx`

- [ ] **Step 1: Add coach-only link**

In the `week-panel-header` actions area of `components/team-dashboard.tsx`, add the link for coaches. Replace the empty header action div:

```tsx
        <div className="week-panel-header">
          <div>
            <span className="eyebrow">フラッグフットボール</span>
            <h2>今週の練習</h2>
            <p>{formatDisplayDate(practiceDate)}週</p>
          </div>
        </div>
```

with:

```tsx
        <div className="week-panel-header">
          <div>
            <span className="eyebrow">フラッグフットボール</span>
            <h2>今週の練習</h2>
            <p>{formatDisplayDate(practiceDate)}週</p>
          </div>
          {teamRole !== "guardian" ? (
            <Link className="button secondary button-compact" href="/weekly-review">
              週次レビュー
            </Link>
          ) : null}
        </div>
```

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

Run:

```bash
git add components/team-dashboard.tsx
git commit -m "feat: link dashboard to weekly review"
```

---

### Task 6: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run helper tests**

Run:

```bash
npx tsc -p tsconfig.playbook-test.json && node /private/tmp/ff-playbook-test/lib/coach-weekly-review.test.js
```

Expected: PASS with no output and exit code `0`.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Start dev server**

Run:

```bash
npm run dev
```

Expected: Next.js starts and prints a local URL, usually `http://localhost:3000`.

- [ ] **Step 4: Browser check desktop**

Open `/weekly-review` in the in-app browser. Verify:

- The page title says `週次レビュー`.
- Summary chips render counts.
- Practice date selector renders.
- Search and status filter render.
- Player cards show OF/DF goals and reflection state.
- Buttons link to `/players/<id>/goals?date=<selectedDate>` and `/players/<id>/reflections?date=<selectedDate>`.

- [ ] **Step 5: Browser check mobile**

Use a narrow viewport or browser screenshot. Verify:

- Cards remain readable.
- OF/DF review blocks stack vertically.
- Buttons do not overlap text.

- [ ] **Step 6: Commit any verification fixes**

If verification finds layout or type issues, fix them and commit:

```bash
git add components/coach-weekly-review.tsx components/app-shell.tsx components/global-header.tsx components/team-dashboard.tsx app/weekly-review/page.tsx app/globals.css lib/coach-weekly-review.ts lib/coach-weekly-review.test.ts tsconfig.playbook-test.json
git commit -m "fix: polish coach weekly review"
```
