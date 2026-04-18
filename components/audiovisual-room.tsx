"use client";

import { Section } from "@/components/section";
import { deleteFilmClip, insertFilmClip, insertFilmRoomVideo, updateFilmClip } from "@/lib/data-store";
import { FilmRoomVideo, Player, PositionMaster, VideoAudience, VideoClip, VideoClipPlayerLink } from "@/lib/types";
import { formatAudienceLabel, formatSecondsAsTime, getPositionLabel, isValidUrl, parseYouTubeVideoId } from "@/lib/utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

type AudiovisualRoomProps = {
  canManageTeam: boolean;
  dataLoading: boolean;
  filmRoomVideos: FilmRoomVideo[];
  players: Player[];
  positionMasters: PositionMaster[];
  setFilmRoomVideos: Dispatch<SetStateAction<FilmRoomVideo[]>>;
  setTeamMessage: Dispatch<SetStateAction<string | null>>;
  supabase: SupabaseClient | null;
  syncing: boolean;
  setSyncing: Dispatch<SetStateAction<boolean>>;
  teamMessage: string | null;
  usingRemoteData: boolean;
  onResetLocalMode: () => void;
};

type VideoForm = {
  title: string;
  description: string;
  sourceLabel: string;
  matchDate: string;
  audience: VideoAudience;
  youtubeUrl: string;
};

type ClipForm = {
  videoId: string;
  title: string;
  startText: string;
  endText: string;
  down: string;
  toGoYards: string;
  penaltyType: string;
  formation: string;
  playType: string;
  playerLinks: VideoClipPlayerLink[];
  comment: string;
};

type ImportForm = {
  videoId: string;
  rawText: string;
};

type ParsedImportRow = Record<string, string>;

type YouTubePlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  loadVideoById: (videoId: string, startSeconds?: number) => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
};

type YouTubeNamespace = {
  Player: new (
    elementId: string,
    options: {
      videoId: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: () => void;
      };
    },
  ) => YouTubePlayer;
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const initialVideoForm: VideoForm = {
  title: "",
  description: "",
  sourceLabel: "",
  matchDate: "",
  audience: "all",
  youtubeUrl: "",
};

const initialClipForm: ClipForm = {
  videoId: "",
  title: "",
  startText: "",
  endText: "",
  down: "",
  toGoYards: "",
  penaltyType: "",
  formation: "",
  playType: "",
  playerLinks: [{ playerId: "", positionId: "" }],
  comment: "",
};

const initialImportForm: ImportForm = {
  videoId: "",
  rawText: "",
};

let youtubeApiPromise: Promise<YouTubeNamespace> | null = null;

function loadYouTubeApi(): Promise<YouTubeNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("ブラウザ環境でのみYouTube再生が使えます。"));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (!youtubeApiPromise) {
    youtubeApiPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
      const script = existingScript ?? document.createElement("script");

      if (!existingScript) {
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        script.onerror = () => reject(new Error("YouTubeプレーヤーの読み込みに失敗しました。"));
        document.body.appendChild(script);
      }

      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        if (window.YT?.Player) {
          resolve(window.YT);
        } else {
          reject(new Error("YouTubeプレーヤーを初期化できませんでした。"));
        }
      };
    });
  }

  return youtubeApiPromise;
}

function parseTimestamp(value: string): number | null {
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

function sortClips(clips: VideoClip[]): VideoClip[] {
  return [...clips].sort((left, right) => left.startSeconds - right.startSeconds);
}

function sanitizePlayerLinks(playerLinks: VideoClipPlayerLink[]): VideoClipPlayerLink[] {
  return playerLinks
    .filter((link) => link.playerId)
    .map((link) => ({
      playerId: link.playerId,
      positionId: link.positionId || undefined,
    }));
}

function formatMatchDate(matchDate?: string): string {
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

function parseDown(value: string): number | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number.parseInt(normalized.replace(/\D/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatDownLabel(down?: number): string | null {
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

function formatSituationText(clip: VideoClip): string | null {
  const parts = [formatDownLabel(clip.down), clip.toGoYards ? `To Go ${clip.toGoYards}` : null].filter(Boolean);
  return parts.length ? parts.join(" / ") : null;
}

function getVideoSearchText(video: FilmRoomVideo): string {
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

function parseDelimitedText(rawText: string): ParsedImportRow[] {
  const trimmed = rawText.replace(/\r\n/g, "\n").trim();

  if (!trimmed) {
    return [];
  }

  const lines = trimmed.split("\n").filter((line) => line.trim());
  if (lines.length < 2) {
    return [];
  }

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const rows = lines.map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];

      if (char === '"') {
        const nextChar = line[index + 1];
        if (inQuotes && nextChar === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = "";
        continue;
      }

      current += char;
    }

    values.push(current.trim());
    return values;
  });

  const headers = rows[0].map((header) => header.trim());

  return rows.slice(1).map((values) =>
    headers.reduce<ParsedImportRow>((record, header, index) => {
      record[header] = values[index]?.trim() ?? "";
      return record;
    }, {}),
  );
}

function getImportCell(row: ParsedImportRow, candidates: string[]): string {
  const lowered = new Map(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), value]));

  for (const candidate of candidates) {
    const value = lowered.get(candidate.toLowerCase());
    if (typeof value === "string") {
      return value.trim();
    }
  }

  return "";
}

function splitImportList(value: string): string[] {
  return value
    .split(/[;,、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function AudiovisualRoom({
  canManageTeam,
  dataLoading,
  filmRoomVideos,
  players,
  positionMasters,
  setFilmRoomVideos,
  setTeamMessage,
  supabase,
  syncing,
  setSyncing,
  teamMessage,
  usingRemoteData,
  onResetLocalMode,
}: AudiovisualRoomProps) {
  const playerHostId = useId().replace(/:/g, "");
  const playerRef = useRef<YouTubePlayer | null>(null);
  const clipCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const selectedYoutubeIdRef = useRef<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string>(filmRoomVideos[0]?.id ?? "");
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoQuery, setVideoQuery] = useState("");
  const [videoAudienceFilter, setVideoAudienceFilter] = useState<VideoAudience | "any">("any");
  const [videoSort, setVideoSort] = useState<"match-date-desc" | "match-date-asc" | "updated-desc" | "title-asc">("match-date-desc");
  const [videoPage, setVideoPage] = useState(1);
  const [query, setQuery] = useState("");
  const [formationFilter, setFormationFilter] = useState("all");
  const [playTypeFilter, setPlayTypeFilter] = useState("all");
  const [videoForm, setVideoForm] = useState<VideoForm>(initialVideoForm);
  const [clipForm, setClipForm] = useState<ClipForm>(initialClipForm);
  const [importForm, setImportForm] = useState<ImportForm>(initialImportForm);
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [showVideoComposer, setShowVideoComposer] = useState(false);
  const [showClipComposer, setShowClipComposer] = useState(false);
  const activePlayers = useMemo(() => players.filter((player) => player.active), [players]);

  function formatClipPlayers(playerLinks: VideoClipPlayerLink[]): string[] {
    return playerLinks
      .map((link) => {
        const player = players.find((candidate) => candidate.id === link.playerId);
        if (!player) {
          return null;
        }

        const positionLabel = link.positionId ? getPositionLabel(link.positionId, positionMasters) : "";
        return positionLabel ? `${player.name} (${positionLabel})` : player.name;
      })
      .filter((value): value is string => Boolean(value));
  }

  function resolvePlayerIdByName(value: string): string | null {
    const normalized = value.trim().replace(/\s+/g, "");
    if (!normalized) {
      return null;
    }

    return (
      players.find((player) => player.name.replace(/\s+/g, "") === normalized)?.id ??
      players.find((player) => `${player.name}#${player.jerseyNumber}`.replace(/\s+/g, "") === normalized)?.id ??
      null
    );
  }

  function resolvePositionId(value: string): string | undefined {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return undefined;
    }

    const match = positionMasters.find(
      (position) => position.id.toLowerCase() === normalized || position.label.toLowerCase() === normalized,
    );

    return match?.id;
  }

  function parsePlayerLinksFromImport(row: ParsedImportRow, rowNumber: number): VideoClipPlayerLink[] {
    const pairedEntries = splitImportList(
      getImportCell(row, ["出場選手", "選手", "players", "playerlinks", "player_links"]),
    );
    const positionEntries = splitImportList(
      getImportCell(row, ["ポジション", "positions", "position", "担当ポジション"]),
    );

    const links: VideoClipPlayerLink[] = [];

    for (let index = 0; index < pairedEntries.length; index += 1) {
      const entry = pairedEntries[index];
      let playerToken = entry;
      let positionToken = positionEntries[index] ?? "";

      if (entry.includes("|")) {
        const [playerPart, positionPart] = entry.split("|");
        playerToken = playerPart?.trim() ?? "";
        positionToken = positionPart?.trim() || positionToken;
      } else {
        const inlineMatch = entry.match(/^(.*?)[(（](.*?)[)）]$/);
        if (inlineMatch) {
          playerToken = inlineMatch[1]?.trim() ?? "";
          positionToken = inlineMatch[2]?.trim() || positionToken;
        }
      }

      const playerId = resolvePlayerIdByName(playerToken);
      if (!playerId) {
        throw new Error(`${rowNumber}行目: 選手「${playerToken}」が見つかりません。`);
      }

      links.push({
        playerId,
        positionId: resolvePositionId(positionToken),
      });
    }

    return links;
  }

  const sortedAndFilteredVideos = useMemo(() => {
    const normalizedQuery = videoQuery.trim().toLowerCase();
    const filtered = filmRoomVideos.filter((video) => {
      const matchesQuery = !normalizedQuery || getVideoSearchText(video).includes(normalizedQuery);
      const matchesAudience = videoAudienceFilter === "any" || video.audience === videoAudienceFilter;
      return matchesQuery && matchesAudience;
    });

    const sorted = [...filtered].sort((left, right) => {
      if (videoSort === "title-asc") {
        return left.title.localeCompare(right.title, "ja");
      }

      if (videoSort === "updated-desc") {
        return right.updatedAt.localeCompare(left.updatedAt);
      }

      const leftMatchDate = left.matchDate ?? "";
      const rightMatchDate = right.matchDate ?? "";

      if (videoSort === "match-date-asc") {
        if (leftMatchDate && rightMatchDate) {
          return leftMatchDate.localeCompare(rightMatchDate);
        }
        if (leftMatchDate) return -1;
        if (rightMatchDate) return 1;
        return left.title.localeCompare(right.title, "ja");
      }

      if (leftMatchDate && rightMatchDate) {
        return rightMatchDate.localeCompare(leftMatchDate);
      }
      if (leftMatchDate) return -1;
      if (rightMatchDate) return 1;
      return right.updatedAt.localeCompare(left.updatedAt);
    });

    return sorted;
  }, [filmRoomVideos, videoAudienceFilter, videoQuery, videoSort]);

  const videosPerPage = 4;
  const totalVideoPages = Math.max(1, Math.ceil(sortedAndFilteredVideos.length / videosPerPage));
  const paginatedVideos = useMemo(() => {
    const startIndex = (videoPage - 1) * videosPerPage;
    return sortedAndFilteredVideos.slice(startIndex, startIndex + videosPerPage);
  }, [sortedAndFilteredVideos, videoPage]);

  useEffect(() => {
    if (!filmRoomVideos.length) {
      setSelectedVideoId("");
      return;
    }

    if (!filmRoomVideos.some((video) => video.id === selectedVideoId)) {
      setSelectedVideoId(filmRoomVideos[0].id);
    }
  }, [filmRoomVideos, selectedVideoId]);

  useEffect(() => {
    setVideoPage(1);
  }, [videoAudienceFilter, videoQuery, videoSort]);

  useEffect(() => {
    if (videoPage > totalVideoPages) {
      setVideoPage(totalVideoPages);
    }
  }, [totalVideoPages, videoPage]);

  const selectedVideo = filmRoomVideos.find((video) => video.id === selectedVideoId) ?? null;
  const selectedVideoYoutubeId = parseYouTubeVideoId(selectedVideo?.youtubeUrl ?? "");
  const selectedVideoClips = useMemo(
    () => sortClips(selectedVideo?.clips ?? []),
    [selectedVideo],
  );

  const formations = useMemo(
    () => Array.from(new Set(selectedVideoClips.map((clip) => clip.formation))).filter(Boolean),
    [selectedVideoClips],
  );
  const playTypes = useMemo(
    () => Array.from(new Set(selectedVideoClips.map((clip) => clip.playType))).filter(Boolean),
    [selectedVideoClips],
  );

  const visibleClips = selectedVideoClips.filter((clip) => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery =
      !normalizedQuery ||
      [clip.title, clip.formation, clip.playType, clip.comment]
        .concat([formatDownLabel(clip.down) ?? "", clip.toGoYards ?? "", clip.penaltyType ?? ""])
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    const matchesPlayerLinks = formatClipPlayers(clip.playerLinks).join(" ").toLowerCase().includes(normalizedQuery);

    const matchesText = !query.trim() || matchesQuery || matchesPlayerLinks;

    const matchesFormation = formationFilter === "all" || clip.formation === formationFilter;
    const matchesPlayType = playTypeFilter === "all" || clip.playType === playTypeFilter;

    return matchesText && matchesFormation && matchesPlayType;
  });

  const activeClip =
    selectedVideoClips.find((clip) => currentTime >= clip.startSeconds && currentTime <= clip.endSeconds) ??
    selectedVideoClips.find((clip) => clip.id === selectedClipId) ??
    null;
  const detailClip = activeClip ?? visibleClips[0] ?? null;

  useEffect(() => {
    setCurrentTime(0);
    setSelectedClipId(null);
    setEditingClipId(null);
    setShowClipComposer(false);
    setClipForm((current) => ({
      ...current,
      videoId: selectedVideo?.id ?? "",
    }));
    setImportForm((current) => ({
      ...current,
      videoId: selectedVideo?.id ?? "",
    }));
  }, [selectedVideo?.id]);

  useEffect(() => {
    if (!selectedVideoYoutubeId) {
      return;
    }

    let cancelled = false;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) {
          return;
        }

        if (!playerRef.current) {
          playerRef.current = new YT.Player(playerHostId, {
            videoId: selectedVideoYoutubeId,
            playerVars: {
              rel: 0,
            },
            events: {
              onReady: () => {
                setCurrentTime(0);
              },
            },
          });
          selectedYoutubeIdRef.current = selectedVideoYoutubeId;
          return;
        }

        if (selectedYoutubeIdRef.current !== selectedVideoYoutubeId) {
          playerRef.current.loadVideoById(selectedVideoYoutubeId, 0);
          selectedYoutubeIdRef.current = selectedVideoYoutubeId;
        }
      })
      .catch((error) => {
        setTeamMessage(error instanceof Error ? error.message : "YouTubeプレーヤーの初期化に失敗しました。");
      });

    return () => {
      cancelled = true;
    };
  }, [playerHostId, selectedVideoYoutubeId, setTeamMessage]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextTime = playerRef.current?.getCurrentTime?.();
      if (typeof nextTime === "number" && Number.isFinite(nextTime)) {
        setCurrentTime(nextTime);
      }
    }, 500);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const targetClipId = activeClip?.id ?? selectedClipId;

    if (!targetClipId) {
      return;
    }

    const targetNode = clipCardRefs.current[targetClipId];

    targetNode?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeClip?.id, formationFilter, playTypeFilter, query, selectedClipId, selectedVideo?.id]);

  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  function updateVideoForm<Key extends keyof VideoForm>(key: Key, value: VideoForm[Key]) {
    setVideoForm((current) => ({ ...current, [key]: value }));
  }

  function updateClipForm<Key extends keyof ClipForm>(key: Key, value: ClipForm[Key]) {
    setClipForm((current) => ({ ...current, [key]: value }));
  }

  function updateImportForm<Key extends keyof ImportForm>(key: Key, value: ImportForm[Key]) {
    setImportForm((current) => ({ ...current, [key]: value }));
  }

  function updateClipPlayerLink(index: number, key: keyof VideoClipPlayerLink, value: string) {
    setClipForm((current) => ({
      ...current,
      playerLinks: current.playerLinks.map((link, linkIndex) =>
        linkIndex === index
          ? key === "positionId"
            ? { ...link, positionId: value || "" }
            : { ...link, playerId: value }
          : link,
      ),
    }));
  }

  function addClipPlayerLink() {
    setClipForm((current) => ({
      ...current,
      playerLinks: [...current.playerLinks, { playerId: "", positionId: "" }],
    }));
  }

  function removeClipPlayerLink(index: number) {
    setClipForm((current) => ({
      ...current,
      playerLinks:
        current.playerLinks.length === 1
          ? [{ playerId: "", positionId: "" }]
          : current.playerLinks.filter((_, linkIndex) => linkIndex !== index),
    }));
  }

  function jumpToClip(clip: VideoClip) {
    if (!playerRef.current) {
      return;
    }

    playerRef.current.seekTo(clip.startSeconds, true);
    playerRef.current.playVideo();
    setCurrentTime(clip.startSeconds);
    setSelectedClipId(clip.id);
  }

  function loadClipIntoForm(clip: VideoClip, videoId: string) {
    setClipForm({
      videoId,
      title: clip.title,
      startText: formatSecondsAsTime(clip.startSeconds),
      endText: formatSecondsAsTime(clip.endSeconds),
      down: clip.down ? String(clip.down) : "",
      toGoYards: clip.toGoYards ?? "",
      penaltyType: clip.penaltyType ?? "",
      formation: clip.formation,
      playType: clip.playType,
      playerLinks: clip.playerLinks.length ? clip.playerLinks.map((link) => ({ ...link, positionId: link.positionId ?? "" })) : [{ playerId: "", positionId: "" }],
      comment: clip.comment,
    });
    setEditingClipId(clip.id);
  }

  function resetClipForm(videoId: string) {
    setClipForm({
      ...initialClipForm,
      videoId,
    });
    setEditingClipId(null);
  }

  function beginClipCreation(videoId: string, startSeconds?: number) {
    setEditingClipId(null);
    setClipForm({
      ...initialClipForm,
      videoId,
      startText: typeof startSeconds === "number" ? formatSecondsAsTime(startSeconds) : "",
    });
    setShowClipComposer(true);
  }

  function renderClipEditor(targetVideoId: string, inline = false) {
    return (
      <div className={inline ? "film-inline-editor" : "admin-form"}>
        <label className="field-stack">
          <span className="field-label">対象動画</span>
          <select
            value={clipForm.videoId}
            onChange={(event) => updateClipForm("videoId", event.target.value)}
            disabled={syncing || !filmRoomVideos.length || inline}
          >
            {filmRoomVideos.map((video) => (
              <option key={video.id} value={video.id}>
                {video.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field-stack">
          <span className="field-label">プレータイトル</span>
          <input
            type="text"
            placeholder="例: 左ショートパス"
            value={clipForm.title}
            onChange={(event) => updateClipForm("title", event.target.value)}
            disabled={syncing || !filmRoomVideos.length}
          />
        </label>
        <label className="field-stack">
          <span className="field-label">開始時刻</span>
          <input
            type="text"
            placeholder="例: 1:24"
            value={clipForm.startText}
            onChange={(event) => updateClipForm("startText", event.target.value)}
            disabled={syncing || !filmRoomVideos.length}
          />
        </label>
        <label className="field-stack">
          <span className="field-label">終了時刻</span>
          <input
            type="text"
            placeholder="例: 1:37"
            value={clipForm.endText}
            onChange={(event) => updateClipForm("endText", event.target.value)}
            disabled={syncing || !filmRoomVideos.length}
          />
        </label>
        <label className="field-stack">
          <span className="field-label">ダウン</span>
          <input
            type="number"
            min="1"
            step="1"
            placeholder="例: 1"
            value={clipForm.down}
            onChange={(event) => updateClipForm("down", event.target.value)}
            disabled={syncing || !filmRoomVideos.length}
          />
        </label>
        <label className="field-stack">
          <span className="field-label">To Go Yard</span>
          <input
            type="text"
            placeholder="例: 8"
            value={clipForm.toGoYards}
            onChange={(event) => updateClipForm("toGoYards", event.target.value)}
            disabled={syncing || !filmRoomVideos.length}
          />
        </label>
        <label className="field-stack">
          <span className="field-label">反則の種類</span>
          <input
            type="text"
            placeholder="例: オフサイド"
            value={clipForm.penaltyType}
            onChange={(event) => updateClipForm("penaltyType", event.target.value)}
            disabled={syncing || !filmRoomVideos.length}
          />
        </label>
        <label className="field-stack">
          <span className="field-label">隊形</span>
          <input
            type="text"
            placeholder="例: Trips Right"
            value={clipForm.formation}
            onChange={(event) => updateClipForm("formation", event.target.value)}
            disabled={syncing || !filmRoomVideos.length}
          />
        </label>
        <label className="field-stack">
          <span className="field-label">プレー種類</span>
          <input
            type="text"
            placeholder="例: ショートパス"
            value={clipForm.playType}
            onChange={(event) => updateClipForm("playType", event.target.value)}
            disabled={syncing || !filmRoomVideos.length}
          />
        </label>
        <div className="field-stack admin-form-full">
          <span className="field-label">出場選手</span>
          <div className="film-player-link-list">
            {clipForm.playerLinks.map((link, index) => (
              <div key={`player-link-${index}`} className="film-player-link-row">
                <select
                  value={link.playerId}
                  onChange={(event) => updateClipPlayerLink(index, "playerId", event.target.value)}
                  disabled={syncing || !filmRoomVideos.length}
                >
                  <option value="">選手を選ぶ</option>
                  {activePlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name} #{player.jerseyNumber}
                    </option>
                  ))}
                </select>
                <select
                  value={link.positionId ?? ""}
                  onChange={(event) => updateClipPlayerLink(index, "positionId", event.target.value)}
                  disabled={syncing || !filmRoomVideos.length}
                >
                  <option value="">ポジション未指定</option>
                  {positionMasters.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.label}
                    </option>
                  ))}
                </select>
                <button
                  className="button secondary button-compact"
                  type="button"
                  onClick={() => removeClipPlayerLink(index)}
                  disabled={syncing || !filmRoomVideos.length}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
          <button
            className="button secondary button-compact"
            type="button"
            onClick={addClipPlayerLink}
            disabled={syncing || !filmRoomVideos.length}
          >
            選手を追加
          </button>
        </div>
        <label className="field-stack admin-form-full">
          <span className="field-label">コメント</span>
          <textarea
            className="form-textarea"
            placeholder="見てほしいポイントや修正点"
            value={clipForm.comment}
            onChange={(event) => updateClipForm("comment", event.target.value)}
            disabled={syncing || !filmRoomVideos.length}
          />
        </label>
        <div className="card-actions admin-form-full">
          <button className="button" type="button" onClick={handleSaveClip} disabled={syncing || !filmRoomVideos.length}>
            {editingClipId ? "変更を保存" : "プレーを追加"}
          </button>
          {editingClipId ? (
            <button
              className="button secondary"
              type="button"
              onClick={() => resetClipForm(targetVideoId)}
              disabled={syncing}
            >
              キャンセル
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  async function handleAddVideo() {
    const nextVideo = {
      title: videoForm.title.trim(),
      description: videoForm.description.trim(),
      sourceLabel: videoForm.sourceLabel.trim(),
      matchDate: videoForm.matchDate || undefined,
      audience: videoForm.audience,
      youtubeUrl: videoForm.youtubeUrl.trim(),
    };

    if (!canManageTeam || syncing || !nextVideo.title || !nextVideo.youtubeUrl) {
      return;
    }

    if (!isValidUrl(nextVideo.youtubeUrl) || !parseYouTubeVideoId(nextVideo.youtubeUrl)) {
      setTeamMessage("YouTubeの共有URLを入れてください。限定公開URLでも登録できます。");
      return;
    }

    try {
      setSyncing(true);

      const savedVideo =
        usingRemoteData && supabase
          ? await insertFilmRoomVideo(supabase, nextVideo)
          : {
              id: `fv-${Date.now()}`,
              updatedAt: new Date().toISOString().slice(0, 10),
              clips: [],
              ...nextVideo,
            };

      setFilmRoomVideos((current) => [savedVideo, ...current]);
      setSelectedVideoId(savedVideo.id);
      setVideoForm(initialVideoForm);
      setShowVideoComposer(false);
      setTeamMessage(`動画「${savedVideo.title}」を追加しました。`);
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : "動画の追加に失敗しました。");
    } finally {
      setSyncing(false);
    }
  }

  async function handleSaveClip() {
    const startSeconds = parseTimestamp(clipForm.startText);
    const endSeconds = parseTimestamp(clipForm.endText);
    const targetVideoId = clipForm.videoId || selectedVideo?.id || "";

    if (!canManageTeam || syncing || !targetVideoId) {
      return;
    }

    const nextClipBase = {
      title: clipForm.title.trim(),
      formation: clipForm.formation.trim(),
      playType: clipForm.playType.trim(),
      down: parseDown(clipForm.down),
      toGoYards: clipForm.toGoYards.trim() || undefined,
      penaltyType: clipForm.penaltyType.trim() || undefined,
      playerLinks: sanitizePlayerLinks(clipForm.playerLinks),
      comment: clipForm.comment.trim(),
    };

    if (!nextClipBase.title || startSeconds === null || endSeconds === null) {
      setTeamMessage("プレータイトルと開始/終了時刻を入れてください。時刻は 1:23 のように指定できます。");
      return;
    }

    if (endSeconds <= startSeconds) {
      setTeamMessage("終了時刻は開始時刻より後にしてください。");
      return;
    }

    const nextClip = {
      ...nextClipBase,
      startSeconds,
      endSeconds,
    };

    try {
      setSyncing(true);

      const currentVideo = filmRoomVideos.find((video) => video.id === targetVideoId);
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
      setTeamMessage(`プレー「${saved.clip.title}」を${editingClipId ? "更新" : "追加"}しました。`);
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : `プレーの${editingClipId ? "更新" : "追加"}に失敗しました。`);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDeleteClip(clip: VideoClip, videoId: string) {
    if (!canManageTeam || syncing) {
      return;
    }

    try {
      setSyncing(true);

      if (usingRemoteData && supabase) {
        await deleteFilmClip(supabase, clip.id);
      }

      setFilmRoomVideos((current) =>
        current.map((video) =>
          video.id === videoId
            ? {
                ...video,
                clips: video.clips.filter((currentClip) => currentClip.id !== clip.id),
                updatedAt: new Date().toISOString().slice(0, 10),
              }
            : video,
        ),
      );

      if (editingClipId === clip.id) {
        resetClipForm(videoId);
      }
      if (selectedClipId === clip.id) {
        setSelectedClipId(null);
      }
      setTeamMessage(`プレー「${clip.title}」を削除しました。`);
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : "プレーの削除に失敗しました。");
    } finally {
      setSyncing(false);
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    setImportForm((current) => ({ ...current, rawText: text }));
    event.target.value = "";
  }

  async function handleImportClips() {
    const targetVideoId = importForm.videoId || selectedVideo?.id || "";
    if (!canManageTeam || syncing || !targetVideoId) {
      return;
    }

    const parsedRows = parseDelimitedText(importForm.rawText);
    if (!parsedRows.length) {
      setTeamMessage("ヘッダー行を含む CSV / TSV を貼り付けてください。");
      return;
    }

    try {
      const clipsToImport = parsedRows.map((row, index) => {
        const rowNumber = index + 2;
        const title = getImportCell(row, ["プレー名", "タイトル", "title", "play", "clip"]);
        const startText = getImportCell(row, ["開始時刻", "開始", "start", "starttime", "start_time"]);
        const endText = getImportCell(row, ["終了時刻", "終了", "end", "endtime", "end_time"]);
        const startSeconds = parseTimestamp(startText);
        const endSeconds = parseTimestamp(endText);

        if (!title) {
          throw new Error(`${rowNumber}行目: プレー名が空です。`);
        }
        if (startSeconds === null || endSeconds === null) {
          throw new Error(`${rowNumber}行目: 開始時刻または終了時刻が正しくありません。`);
        }
        if (endSeconds <= startSeconds) {
          throw new Error(`${rowNumber}行目: 終了時刻は開始時刻より後にしてください。`);
        }

        return {
          title,
          startSeconds,
          endSeconds,
          down: parseDown(getImportCell(row, ["ダウン", "down"])),
          toGoYards: getImportCell(row, ["to go yard", "to_go_yards", "to go", "距離", "to go yard数", "to go yards"]),
          penaltyType: getImportCell(row, ["反則の種類", "反則", "penalty", "penaltytype", "penalty_type"]),
          formation: getImportCell(row, ["隊形", "formation"]),
          playType: getImportCell(row, ["プレー種類", "種類", "playtype", "play_type", "type"]),
          comment: getImportCell(row, ["コメント", "comment", "memo", "メモ"]),
          playerLinks: parsePlayerLinksFromImport(row, rowNumber),
        };
      });

      setSyncing(true);
      const currentVideo = filmRoomVideos.find((video) => video.id === targetVideoId);
      const baseSortOrder = currentVideo?.clips.length ?? 0;

      const savedClips =
        usingRemoteData && supabase
          ? await Promise.all(
              clipsToImport.map((clip, index) =>
                insertFilmClip(supabase, {
                  ...clip,
                  videoId: targetVideoId,
                  sortOrder: baseSortOrder + index + 1,
                }).then((saved) => saved.clip),
              ),
            )
          : clipsToImport.map((clip, index) => ({
              id: `fc-import-${Date.now()}-${index}`,
              ...clip,
            }));

      setFilmRoomVideos((current) =>
        current.map((video) =>
          video.id === targetVideoId
            ? {
                ...video,
                clips: sortClips([...video.clips, ...savedClips]),
                updatedAt: new Date().toISOString().slice(0, 10),
              }
            : video,
        ),
      );
      setSelectedVideoId(targetVideoId);
      setImportForm({
        videoId: targetVideoId,
        rawText: "",
      });
      setTeamMessage(`${savedClips.length}件のプレー注釈をインポートしました。`);
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : "プレー注釈のインポートに失敗しました。");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="dashboard dashboard-wide">
      <div className="stack">
        <Section
          title="ビデオ"
          copy="限定公開YouTubeの試合動画やプレー合わせ動画を見返しながら、プレーの種類や隊形、コメントを確認できます。"
        >
          <div className="status-strip">
            {syncing ? <span className="chip">保存しています…</span> : null}
            {dataLoading ? <span className="chip">読込中…</span> : null}
            {teamMessage ? <span className="subtle">{teamMessage}</span> : null}
            {!usingRemoteData ? (
              <button className="button ghost" type="button" onClick={onResetLocalMode} disabled={syncing}>
                体験データに戻す
              </button>
            ) : null}
          </div>

          <div className="film-room-layout">
            <div className="panel inset-panel">
                <div className="panel-body">
                  <div className="section-row">
                    <div>
                      <h3 className="section-title">動画一覧</h3>
                      <p className="section-copy">見たい試合動画やプレー合わせ動画をここで切り替えます。</p>
                    </div>
                    {canManageTeam ? (
                      <button
                        className="button secondary button-compact"
                        type="button"
                        onClick={() => setShowVideoComposer((current) => !current)}
                        disabled={syncing}
                      >
                        {showVideoComposer ? "閉じる" : "動画を追加"}
                      </button>
                    ) : null}
                  </div>
                  <div className="toolbar film-toolbar">
                    <input
                      type="text"
                      placeholder="動画名・試合名・説明で検索"
                      value={videoQuery}
                      onChange={(event) => setVideoQuery(event.target.value)}
                    />
                    <div className="toolbar-count">{sortedAndFilteredVideos.length}件</div>
                  </div>
                  <div className="film-filter-row">
                    <select
                      value={videoAudienceFilter}
                      onChange={(event) => setVideoAudienceFilter(event.target.value as VideoAudience | "any")}
                    >
                      <option value="any">すべての公開先</option>
                      <option value="all">チーム全体</option>
                      <option value="guardians">保護者のみ</option>
                      <option value="coaches">コーチのみ</option>
                    </select>
                    <select value={videoSort} onChange={(event) => setVideoSort(event.target.value as typeof videoSort)}>
                      <option value="match-date-desc">試合日が新しい順</option>
                      <option value="match-date-asc">試合日が古い順</option>
                      <option value="updated-desc">更新日が新しい順</option>
                      <option value="title-asc">タイトル順</option>
                    </select>
                  </div>
                  <div className="film-video-list">
                    {paginatedVideos.length ? paginatedVideos.map((video) => (
                      <button
                        key={video.id}
                        className={`film-video-card ${video.id === selectedVideoId ? "is-selected" : ""}`}
                        type="button"
                        onClick={() => setSelectedVideoId(video.id)}
                      >
                        <strong>{video.title}</strong>
                        <span>{video.description}</span>
                        <div className="chip-row">
                          <span className="chip">{formatMatchDate(video.matchDate)}</span>
                          <span className="chip">{video.sourceLabel}</span>
                          <span className="chip">{formatAudienceLabel(video.audience)}</span>
                          <span className="chip">{video.clips.length}プレー</span>
                        </div>
                      </button>
                    )) : (
                      <p className="empty-state">条件に合う動画がありません。</p>
                    )}
                  </div>
                  {sortedAndFilteredVideos.length > videosPerPage ? (
                    <div className="film-pagination">
                      <button
                        className="button secondary button-compact"
                        type="button"
                        onClick={() => setVideoPage((current) => Math.max(1, current - 1))}
                        disabled={videoPage === 1}
                      >
                        前へ
                      </button>
                      <span className="chip">
                        {videoPage} / {totalVideoPages} ページ
                      </span>
                      <button
                        className="button secondary button-compact"
                        type="button"
                        onClick={() => setVideoPage((current) => Math.min(totalVideoPages, current + 1))}
                        disabled={videoPage === totalVideoPages}
                      >
                        次へ
                      </button>
                    </div>
                  ) : null}
                  {canManageTeam && showVideoComposer ? (
                    <div className="film-inline-editor-wrap">
                      <div className="film-inline-editor">
                        <label className="field-stack">
                          <span className="field-label">動画タイトル</span>
                          <input
                            type="text"
                            placeholder="例: 春季大会1回戦"
                            value={videoForm.title}
                            onChange={(event) => updateVideoForm("title", event.target.value)}
                            disabled={syncing}
                          />
                        </label>
                        <label className="field-stack">
                          <span className="field-label">公開先</span>
                          <select
                            value={videoForm.audience}
                            onChange={(event) => updateVideoForm("audience", event.target.value as VideoAudience)}
                            disabled={syncing}
                          >
                            <option value="all">チーム全体</option>
                            <option value="guardians">保護者のみ</option>
                            <option value="coaches">コーチのみ</option>
                          </select>
                        </label>
                        <label className="field-stack">
                          <span className="field-label">試合・用途ラベル</span>
                          <input
                            type="text"
                            placeholder="例: 2026春季大会 / プレー合わせ"
                            value={videoForm.sourceLabel}
                            onChange={(event) => updateVideoForm("sourceLabel", event.target.value)}
                            disabled={syncing}
                          />
                        </label>
                        <label className="field-stack">
                          <span className="field-label">試合日</span>
                          <input
                            type="date"
                            value={videoForm.matchDate}
                            onChange={(event) => updateVideoForm("matchDate", event.target.value)}
                            disabled={syncing}
                          />
                        </label>
                        <label className="field-stack">
                          <span className="field-label">説明</span>
                          <input
                            type="text"
                            placeholder="何を見返す動画か"
                            value={videoForm.description}
                            onChange={(event) => updateVideoForm("description", event.target.value)}
                            disabled={syncing}
                          />
                        </label>
                        <label className="field-stack admin-form-full">
                          <span className="field-label">YouTube URL</span>
                          <input
                            type="url"
                            placeholder="https://www.youtube.com/watch?v=..."
                            value={videoForm.youtubeUrl}
                            onChange={(event) => updateVideoForm("youtubeUrl", event.target.value)}
                            disabled={syncing}
                          />
                        </label>
                        <div className="card-actions admin-form-full">
                          <button className="button" type="button" onClick={handleAddVideo} disabled={syncing}>
                            動画を追加
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            <div className="panel inset-panel">
              <div className="panel-body film-player-panel">
                <div className="section-row">
                  <div>
                    <h3 className="section-title">動画プレーヤー</h3>
                    <p className="section-copy">
                      {selectedVideo ? `${selectedVideo.title} を再生中です。` : "見たい動画を選ぶとここで再生できます。"}
                    </p>
                  </div>
                  {selectedVideo ? (
                    <div className="chip-row">
                      <span className="chip">{formatAudienceLabel(selectedVideo.audience)}</span>
                      <span className="chip">{selectedVideo.sourceLabel}</span>
                      <span className="chip">{selectedVideo.clips.length}プレー</span>
                    </div>
                  ) : null}
                </div>

                {selectedVideo && selectedVideoYoutubeId ? (
                  <>
                    <div className="film-player-frame">
                      <div id={playerHostId} />
                    </div>

                    <div className="film-current-strip">
                      <span className="chip">再生位置 {formatSecondsAsTime(currentTime)}</span>
                      {canManageTeam && selectedVideo ? (
                        <div className="film-current-strip-action">
                          <button
                            className="button"
                            type="button"
                            onClick={() => beginClipCreation(selectedVideo.id, Math.floor(currentTime))}
                            disabled={syncing || Boolean(editingClipId)}
                          >
                            このタイミングに注釈を追加
                          </button>
                          {editingClipId ? (
                            <span className="subtle">編集中の注釈を保存またはキャンセルすると追加できます。</span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    {detailClip ? (
                      <div className="film-active-card">
                        <div className="section-row">
                          <div className="film-title-stack">
                            <strong>{detailClip.title}</strong>
                            {formatSituationText(detailClip) ? (
                              <span className="film-situation-text">{formatSituationText(detailClip)}</span>
                            ) : null}
                            <p>
                              {formatSecondsAsTime(detailClip.startSeconds)} - {formatSecondsAsTime(detailClip.endSeconds)}
                            </p>
                          </div>
                          {canManageTeam && selectedVideo ? (
                            <div className="film-inline-actions">
                              <button
                                className="button secondary button-compact"
                                type="button"
                                onClick={() => {
                                  setShowClipComposer(false);
                                  loadClipIntoForm(detailClip, selectedVideo.id);
                                }}
                                disabled={syncing}
                              >
                                このプレーを編集
                              </button>
                              <button
                                className="button secondary button-compact"
                                type="button"
                                onClick={() => handleDeleteClip(detailClip, selectedVideo.id)}
                                disabled={syncing}
                              >
                                このプレーを削除
                              </button>
                            </div>
                          ) : null}
                        </div>
                        <div className="film-meta-groups">
                          {detailClip.formation || detailClip.playType ? (
                            <div className="film-meta-group">
                              <span className="film-meta-label">プレー情報</span>
                              <div className="chip-row">
                                {detailClip.formation ? <span className="chip">{detailClip.formation}</span> : null}
                                {detailClip.playType ? <span className="chip">{detailClip.playType}</span> : null}
                              </div>
                            </div>
                          ) : null}
                          {detailClip.playerLinks.length ? (
                            <div className="film-meta-group">
                              <span className="film-meta-label">参加選手</span>
                              <div className="chip-row">
                                {formatClipPlayers(detailClip.playerLinks).map((label) => (
                                  <span key={label} className="chip">{label}</span>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {detailClip.penaltyType ? (
                            <div className="film-meta-group">
                              <span className="film-meta-label">反則</span>
                              <div className="chip-row">
                                <span className="chip warn">{detailClip.penaltyType}</span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <p className="film-comment">{detailClip.comment || "コメントは未登録です。"}</p>
                        {canManageTeam && selectedVideo && editingClipId === detailClip.id ? (
                          <div className="film-inline-editor-wrap">
                            <div className="film-editing-banner">
                              <strong>このプレーをここで編集しています</strong>
                            </div>
                            {renderClipEditor(selectedVideo.id, true)}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="empty-state">
                        この動画にはまだプレー注釈がありません。管理者ならこのタイミングから追加できます。
                      </p>
                    )}

                    <div className="section-row">
                      <div>
                        <h3 className="section-title">プレー一覧</h3>
                        <p className="section-copy">
                          {selectedVideo ? `${selectedVideo.title} のプレーを一覧で確認できます。` : "動画を選ぶとプレー一覧が表示されます。"}
                        </p>
                      </div>
                    </div>

                    <div className="toolbar film-toolbar">
                      <input
                        type="text"
                        placeholder="プレー名・隊形・コメントで検索"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                      <div className="toolbar-count">{visibleClips.length}件</div>
                    </div>

                    <div className="film-filter-row">
                      <select value={formationFilter} onChange={(event) => setFormationFilter(event.target.value)}>
                        <option value="all">すべての隊形</option>
                        {formations.map((formation) => (
                          <option key={formation} value={formation}>
                            {formation}
                          </option>
                        ))}
                      </select>
                      <select value={playTypeFilter} onChange={(event) => setPlayTypeFilter(event.target.value)}>
                        <option value="all">すべての種類</option>
                        {playTypes.map((playType) => (
                          <option key={playType} value={playType}>
                            {playType}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="film-clip-list is-list-mode">
                      {visibleClips.length ? (
                        visibleClips.map((clip) => (
                          <button
                            key={clip.id}
                            ref={(node) => {
                              clipCardRefs.current[clip.id] = node;
                            }}
                            className={`film-clip-card ${clip.id === activeClip?.id ? "is-active" : ""}`}
                            type="button"
                            onClick={() => jumpToClip(clip)}
                          >
                            <div className="film-clip-head">
                              <div className="film-title-stack">
                                <strong>{clip.title}</strong>
                                {formatSituationText(clip) ? (
                                  <span className="film-situation-text">{formatSituationText(clip)}</span>
                                ) : null}
                              </div>
                              <span>
                                {formatSecondsAsTime(clip.startSeconds)} - {formatSecondsAsTime(clip.endSeconds)}
                              </span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <p className="empty-state">
                          {selectedVideo.clips.length
                            ? "条件に合うプレーがありません。"
                            : "この動画にはまだプレー注釈がありません。管理者ならこのタイミングから追加できます。"}
                        </p>
                      )}
                    </div>

                    {canManageTeam && selectedVideo && showClipComposer && !editingClipId ? (
                      <div className="film-inline-editor-wrap">
                        <div className="film-editing-banner">
                          <strong>再生中の動画に新しい注釈を追加しています</strong>
                          <button
                            className="button secondary button-compact"
                            type="button"
                            onClick={() => {
                              resetClipForm(selectedVideo.id);
                              setShowClipComposer(false);
                            }}
                            disabled={syncing}
                          >
                            閉じる
                          </button>
                        </div>
                        {renderClipEditor(selectedVideo.id, true)}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="empty-state">
                    登録済み動画がないか、YouTube URL から動画IDを読み取れませんでした。限定公開URLをそのまま登録できます。
                  </p>
                )}
              </div>
            </div>
          </div>

          {canManageTeam ? (
            <div className="film-admin-grid">
              <div className="panel inset-panel film-import-panel">
                <div className="panel-body">
                  <h3 className="section-title">スプレッドシートからインポート</h3>
                  <p className="section-copy">
                    Google スプレッドシートの行をそのまま貼り付けるか、CSV / TSV を読み込むと、プレー注釈をまとめて追加できます。
                  </p>
                  <div className="admin-form">
                    <label className="field-stack">
                      <span className="field-label">取り込み先動画</span>
                      <select
                        value={importForm.videoId}
                        onChange={(event) => updateImportForm("videoId", event.target.value)}
                        disabled={syncing || !filmRoomVideos.length}
                      >
                        {filmRoomVideos.map((video) => (
                          <option key={video.id} value={video.id}>
                            {video.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field-stack">
                      <span className="field-label">CSV / TSV ファイル</span>
                      <input
                        type="file"
                        accept=".csv,.tsv,text/csv,text/tab-separated-values"
                        onChange={handleImportFile}
                        disabled={syncing || !filmRoomVideos.length}
                      />
                    </label>
                    <label className="field-stack admin-form-full">
                      <span className="field-label">貼り付け内容</span>
                      <textarea
                        className="form-textarea film-import-textarea"
                        placeholder={"プレー名\t開始時刻\t終了時刻\tダウン\tTo Go Yard\t反則の種類\t隊形\tプレー種類\tコメント\t出場選手\n右サイドのショートパス\t0:42\t0:58\t1st\t8\tなし\tTrips Right\tショートパス\t一歩目が速い\tあおい|ランナー;はると|レシーバー"}
                        value={importForm.rawText}
                        onChange={(event) => updateImportForm("rawText", event.target.value)}
                        disabled={syncing || !filmRoomVideos.length}
                      />
                    </label>
                    <div className="film-import-help admin-form-full">
                      <strong>使える列名</strong>
                      <p>
                        必須: `プレー名`, `開始時刻`, `終了時刻`
                      </p>
                      <p>
                        任意: `ダウン`, `To Go Yard`, `反則の種類`, `隊形`, `プレー種類`, `コメント`, `出場選手`, `ポジション`
                      </p>
                      <p>
                        `ダウン` は `1`, `2`, `3`, `4` のような数字で入れると、表示時に `1st ダウン` の形になります。
                      </p>
                      <p>
                        複数選手は `あおい|ランナー;はると|レシーバー` のように `;` 区切りで指定できます。
                      </p>
                    </div>
                    <button
                      className="button"
                      type="button"
                      onClick={handleImportClips}
                      disabled={syncing || !filmRoomVideos.length}
                    >
                      プレーデータを取り込む
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <p className="footer-note">
            YouTube側で埋め込みが許可されている限定公開動画を想定しています。埋め込み禁止の動画はURL登録できても再生できない場合があります。
          </p>
        </Section>
      </div>
    </div>
  );
}
