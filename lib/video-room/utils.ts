import type { FilmRoomVideo, VideoClip, VideoClipPlayerLink } from "@/lib/types";
import type { ParsedImportRow } from "@/components/video-room/types";

export function parseTimestamp(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }

  const parts = trimmed.split(":").map((part) => part.trim());

  if (parts.some((part) => !/^\d+$/.test(part))) {
    return null;
  }

  if (parts.length === 2) {
    return Number.parseInt(parts[0], 10) * 60 + Number.parseInt(parts[1], 10);
  }

  if (parts.length === 3) {
    return Number.parseInt(parts[0], 10) * 3600 + Number.parseInt(parts[1], 10) * 60 + Number.parseInt(parts[2], 10);
  }

  return null;
}

export function sortClips(clips: VideoClip[]): VideoClip[] {
  return [...clips].sort((left, right) => left.startSeconds - right.startSeconds);
}

export function sanitizePlayerLinks(playerLinks: VideoClipPlayerLink[]): VideoClipPlayerLink[] {
  return playerLinks
    .filter((link) => link.playerId)
    .map((link) => ({
      playerId: link.playerId,
      positionId: link.positionId || undefined,
    }));
}

export function formatMatchDate(matchDate?: string): string {
  if (!matchDate) {
    return "試合日未設定";
  }

  const parsed = new Date(`${matchDate}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return matchDate;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

export function parseDown(value: string): number | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number.parseInt(normalized.replace(/\D/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function formatDownLabel(down?: number): string | null {
  if (!down || down < 1) {
    return null;
  }

  const mod10 = down % 10;
  const mod100 = down % 100;
  const suffix =
    mod10 === 1 && mod100 !== 11 ? "st" :
    mod10 === 2 && mod100 !== 12 ? "nd" :
    mod10 === 3 && mod100 !== 13 ? "rd" :
    "th";

  return `${down}${suffix} ダウン`;
}

export function formatSituationText(clip: VideoClip): string | null {
  const parts = [formatDownLabel(clip.down), clip.toGoYards ? `To Go ${clip.toGoYards}` : null].filter(Boolean);
  return parts.length ? parts.join(" / ") : null;
}

export function getVideoSearchText(video: FilmRoomVideo): string {
  return [
    video.title,
    video.description,
    video.sourceLabel,
    video.matchDate ?? "",
    ...video.clips.map((clip) =>
      [clip.title, formatDownLabel(clip.down) ?? "", clip.toGoYards ?? "", clip.penaltyType ?? "", clip.formation, clip.playType, clip.comment].join(" "),
    ),
  ]
    .join(" ")
    .toLowerCase();
}

export function parseDelimitedText(rawText: string): ParsedImportRow[] {
  const trimmed = rawText.replace(/\r\n/g, "\n").trim();

  if (!trimmed) {
    return [];
  }

  const lines = trimmed.split("\n").filter(Boolean);
  const separator = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(separator).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const cells = line.split(separator).map((cell) => cell.trim());
    return headers.reduce<ParsedImportRow>((row, header, index) => {
      row[header] = cells[index] ?? "";
      return row;
    }, {});
  });
}

export function getImportCell(row: ParsedImportRow, keys: string[]): string {
  const match = Object.entries(row).find(([header]) =>
    keys.some((key) => header.trim().toLowerCase() === key.trim().toLowerCase()),
  );

  return match?.[1]?.trim() ?? "";
}

export function splitImportList(value: string): string[] {
  return value
    .split(/[;,、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
