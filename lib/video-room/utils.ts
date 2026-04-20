import type { ParsedImportRow } from "@/components/video-room/types";
import type { FilmRoomVideo, VideoClip, VideoClipPlayerLink } from "@/lib/types";

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

  if (normalized.toLowerCase() === "tfp" || normalized.toLowerCase() === "try for point") {
    return 0;
  }

  const parsed = Number.parseInt(normalized.replace(/\D/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function formatDownLabel(down?: number): string | null {
  if (down === 0) {
    return "TFP";
  }

  if (down === undefined || down < 1) {
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

/** Strip surrounding double-quotes and unescape inner doubled quotes (RFC 4180). */
function unquoteCsvCell(cell: string): string {
  const t = cell.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).replace(/""/g, '"');
  }
  return t;
}

/** Split a single CSV line respecting quoted fields. */
function splitCsvLine(line: string, separator: string): string[] {
  // For TSV, quoting is rare — use simple split
  if (separator === "\t") {
    return line.split(separator).map(unquoteCsvCell);
  }

  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === separator) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseDelimitedText(rawText: string): ParsedImportRow[] {
  const trimmed = rawText.replace(/\r\n/g, "\n").trim();

  if (!trimmed) {
    return [];
  }

  const lines = trimmed.split("\n").filter(Boolean);
  const separator = lines[0].includes("\t") ? "\t" : ",";
  const headers = splitCsvLine(lines[0], separator);

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, separator);
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
