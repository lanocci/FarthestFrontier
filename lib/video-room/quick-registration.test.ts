import {
  advanceQuickDown,
  buildQuickClipFormFromClip,
  buildQuickClipTitle,
  getQuickClipDefaultsAfterSave,
  initialQuickClipForm,
  isQuickClipDirty,
  nudgeTimestampText,
  shouldDeferQuickClipHydration,
  shouldIgnoreQuickSavePlayerTime,
  shouldPreserveQuickClipDraft,
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

assertDeepEqual(
  buildQuickClipFormFromClip({
    id: "clip-1",
    title: "攻撃 Trips Pass 2nd&8",
    startSeconds: 84,
    endSeconds: 97,
    down: 2,
    toGoYards: "8",
    formation: "Trips",
    playType: "Pass",
    comment: "",
    playerLinks: [],
    focusTargets: [],
    whiteboards: [],
  }),
  {
    startText: "1:24",
    endText: "1:37",
    side: "offense",
    formation: "Trips",
    playType: "Pass",
    down: "2",
    toGoYards: "8",
  },
  "hydrates quick form from an existing offense clip",
);

assertDeepEqual(
  buildQuickClipFormFromClip({
    id: "clip-2",
    title: "守備 Zone 3rd&6",
    startSeconds: 126,
    endSeconds: 139,
    down: 3,
    toGoYards: "6",
    formation: "",
    playType: "Zone",
    comment: "",
    playerLinks: [],
    focusTargets: [],
    whiteboards: [],
  }),
  {
    startText: "2:06",
    endText: "2:19",
    side: "defense",
    formation: "",
    playType: "Zone",
    down: "3",
    toGoYards: "6",
  },
  "hydrates quick form from an existing defense clip",
);

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
  getQuickClipDefaultsAfterSave(savedForm, 70),
  {
    startText: "1:11",
    endText: "",
    side: "offense",
    formation: "Trips",
    playType: "Pass",
    down: "3",
    toGoYards: "8",
  },
  "moves next start to one second after the saved clip end and carries quick metadata",
);

assertEqual(
  shouldIgnoreQuickSavePlayerTime(12, { targetSeconds: 31, previousSeconds: 30 }),
  true,
  "ignores stale player time that jumps behind the quick save target",
);

assertEqual(
  shouldIgnoreQuickSavePlayerTime(12, { targetSeconds: 31, previousSeconds: 30, createdAtMs: 1_000 }, 2_000),
  true,
  "keeps ignoring stale player time while the quick save guard is fresh",
);

assertEqual(
  shouldIgnoreQuickSavePlayerTime(12, { targetSeconds: 31, previousSeconds: 30, createdAtMs: 1_000 }, 4_000),
  false,
  "stops ignoring stale player time after the quick save guard expires",
);

assertEqual(
  shouldIgnoreQuickSavePlayerTime(30.8, { targetSeconds: 31, previousSeconds: 30 }),
  false,
  "accepts player time once it reaches the quick save target",
);

assertEqual(
  shouldIgnoreQuickSavePlayerTime(12, null),
  false,
  "accepts player time when no quick save guard is active",
);

assertEqual(
  shouldDeferQuickClipHydration({ targetSeconds: 31, previousSeconds: 30 }),
  true,
  "defers playback hydration while the quick save seek is settling",
);

assertEqual(
  shouldDeferQuickClipHydration(null),
  false,
  "allows playback hydration when no quick save guard is active",
);

assertEqual(
  shouldPreserveQuickClipDraft(
    {
      startText: "0:46",
      endText: "",
      side: "offense",
      formation: "",
      playType: "",
      down: "1",
      toGoYards: "10",
    },
    null,
  ),
  true,
  "preserves an unsourced quick draft instead of hydrating an overlapping playback clip",
);

assertEqual(
  shouldPreserveQuickClipDraft(initialQuickClipForm, null),
  false,
  "does not preserve an empty quick draft",
);

assertEqual(
  shouldPreserveQuickClipDraft(savedForm, "clip-1"),
  false,
  "allows hydration when the current quick form came from a playback clip",
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
