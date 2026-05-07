import { formatDownLabel, parseTimestamp } from "./utils";
import type { VideoClip } from "../types";

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

function formatQuickSecondsAsTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
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

  return formatQuickSecondsAsTime(Math.max(0, parsed + deltaSeconds));
}

function inferQuickSideFromClipTitle(title: string): QuickClipSide {
  const normalized = title.trim();

  if (normalized.startsWith("攻撃")) {
    return "offense";
  }

  if (normalized.startsWith("守備")) {
    return "defense";
  }

  return "";
}

export function buildQuickClipFormFromClip(clip: VideoClip): QuickClipForm {
  return {
    startText: formatQuickSecondsAsTime(clip.startSeconds),
    endText: formatQuickSecondsAsTime(clip.endSeconds),
    side: inferQuickSideFromClipTitle(clip.title),
    formation: clip.formation,
    playType: clip.playType,
    down: clip.down !== undefined ? String(clip.down) : "",
    toGoYards: clip.toGoYards ?? "",
  };
}

export function getQuickClipDefaultsAfterSave(form: QuickClipForm, savedEndSeconds?: number): QuickClipForm {
  return {
    ...form,
    startText: typeof savedEndSeconds === "number" ? formatQuickSecondsAsTime(savedEndSeconds + 1) : "",
    endText: "",
    down: advanceQuickDown(form.down),
  };
}

export function isQuickClipDirty(form: QuickClipForm): boolean {
  return Object.values(form).some((value) => value.trim().length > 0);
}
