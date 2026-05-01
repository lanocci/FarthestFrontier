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
