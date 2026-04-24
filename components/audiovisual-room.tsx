"use client";

import { Section } from "@/components/section";
import { VideoClipEditor } from "@/components/video-room/clip-editor";
import { PlaybookWhiteboard, type PlaybookWhiteboardHandle, type PlaybookWhiteboardState } from "@/components/video-room/playbook-whiteboard";
import { type ClipForm, type ImportForm, type ParsedImportRow, type VideoForm } from "@/components/video-room/types";
import { deleteAllFilmClips, deleteClipWhiteboard, deleteFilmClip, deletePlaybookAsset, insertClipWhiteboard, insertFilmClip, insertFilmRoomVideo, updateClipWhiteboard, updateFilmClip, upsertPlaybookAsset } from "@/lib/data-store";
import { ClipWhiteboardBaseMode, FilmRoomVideo, MaterialAudience, Player, PlaybookAsset, PlaybookSide, PositionMaster, VideoAudience, VideoClip, VideoClipPlayerLink, VideoTagMaster } from "@/lib/types";
import { formatAudienceLabel, formatSecondsAsTime, getPositionLabel, isValidUrl, parseYouTubeVideoId } from "@/lib/utils";
import { formatDownLabel, formatMatchDate, formatSituationText, getImportCell, getVideoSearchText, parseDelimitedText, parseDown, parseTimestamp, sanitizePlayerLinks, sortClips, splitImportList } from "@/lib/video-room/utils";
import { Expand, Eye, EyeOff, FastForward, Image as ImageIcon, Minimize, RotateCcw, Rewind, Save, Trash2, Upload } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type AudiovisualRoomProps = {
  canManageTeam: boolean;
  dataLoading: boolean;
  filmRoomVideos: FilmRoomVideo[];
  formationMasters: VideoTagMaster[];
  penaltyTypeMasters: VideoTagMaster[];
  players: Player[];
  playbookAssets: PlaybookAsset[];
  playTypeMasters: VideoTagMaster[];
  positionMasters: PositionMaster[];
  setFilmRoomVideos: Dispatch<SetStateAction<FilmRoomVideo[]>>;
  setPlaybookAssets: Dispatch<SetStateAction<PlaybookAsset[]>>;
  setTeamMessage: Dispatch<SetStateAction<string | null>>;
  supabase: SupabaseClient | null;
  syncing: boolean;
  setSyncing: Dispatch<SetStateAction<boolean>>;
  teamMessage: string | null;
  usingRemoteData: boolean;
  onResetLocalMode: () => void;
};

type PlaybookForm = {
  title: string;
  side: PlaybookSide;
  formation: string;
  playType: string;
  audience: MaterialAudience;
};

type PlaybookSourceMode = "upload" | "canvas";

type YouTubePlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  loadVideoById: (videoId: string, startSeconds?: number) => void;
  pauseVideo?: () => void;
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

type ScreenOrientationController = {
  lock?: (orientation: "landscape") => Promise<void>;
  unlock?: () => void;
};

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
  focusTargets: [],
  comment: "",
  coachComment: "",
};

const initialImportForm: ImportForm = {
  videoId: "",
  rawText: "",
};

const initialPlaybookForm: PlaybookForm = {
  title: "",
  side: "offense",
  formation: "",
  playType: "",
  audience: "coaches",
};

const PLAYBOOK_BUCKET = "playbooks";
const CLIP_WHITEBOARD_BUCKET = "clip-whiteboards";

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

export function AudiovisualRoom({
  canManageTeam,
  dataLoading,
  filmRoomVideos,
  formationMasters,
  penaltyTypeMasters,
  players,
  playbookAssets,
  playTypeMasters,
  positionMasters,
  setFilmRoomVideos,
  setPlaybookAssets,
  setTeamMessage,
  supabase,
  syncing,
  setSyncing,
  teamMessage,
  usingRemoteData,
  onResetLocalMode,
}: AudiovisualRoomProps) {
  const playerHostId = useId().replace(/:/g, "");
  const formationListId = useId().replace(/:/g, "");
  const penaltyTypeListId = useId().replace(/:/g, "");
  const playTypeListId = useId().replace(/:/g, "");
  const playbookFormationListId = useId().replace(/:/g, "");
  const playbookPlayTypeListId = useId().replace(/:/g, "");
  const playerRef = useRef<YouTubePlayer | null>(null);
  const whiteboardRef = useRef<PlaybookWhiteboardHandle | null>(null);
  const playbookCreatorRef = useRef<PlaybookWhiteboardHandle | null>(null);
  const playbackShellRef = useRef<HTMLDivElement | null>(null);
  const clipCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pendingSharedClipIdRef = useRef<string | null>(null);
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
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [showVideoComposer, setShowVideoComposer] = useState(false);
  const [showClipComposer, setShowClipComposer] = useState(false);
  const [playbookForm, setPlaybookForm] = useState<PlaybookForm>(initialPlaybookForm);
  const [playbookFile, setPlaybookFile] = useState<File | null>(null);
  const [playbookInputKey, setPlaybookInputKey] = useState(0);
  const [playbookSourceMode, setPlaybookSourceMode] = useState<PlaybookSourceMode>("upload");
  const [playbookUrls, setPlaybookUrls] = useState<Record<string, string>>({});
  const [clipWhiteboardUrls, setClipWhiteboardUrls] = useState<Record<string, string>>({});
  const [clipWhiteboardBaseUrls, setClipWhiteboardBaseUrls] = useState<Record<string, string>>({});
  const [whiteboardMode, setWhiteboardMode] = useState<ClipWhiteboardBaseMode>("blank");
  const [whiteboardTitle, setWhiteboardTitle] = useState("");
  const [editingSavedWhiteboardId, setEditingSavedWhiteboardId] = useState<string | null>(null);
  const [editingSavedWhiteboardBaseImageUrl, setEditingSavedWhiteboardBaseImageUrl] = useState<string | null>(null);
  const [uploadedWhiteboardFile, setUploadedWhiteboardFile] = useState<File | null>(null);
  const [uploadedWhiteboardPreviewUrl, setUploadedWhiteboardPreviewUrl] = useState<string | null>(null);
  const [uploadedWhiteboardInputKey, setUploadedWhiteboardInputKey] = useState(0);
  const [transientWhiteboardState, setTransientWhiteboardState] = useState<PlaybookWhiteboardState | null>(null);
  const [isWhiteboardModalOpen, setIsWhiteboardModalOpen] = useState(false);
  const [wasFullscreenBeforeWhiteboard, setWasFullscreenBeforeWhiteboard] = useState(false);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [isPlaybackFullscreen, setIsPlaybackFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const activePlayers = useMemo(() => players.filter((player) => player.active), [players]);

  function getScreenOrientationController(): ScreenOrientationController | null {
    if (typeof window === "undefined" || typeof screen === "undefined") {
      return null;
    }

    return (screen.orientation as ScreenOrientationController | undefined) ?? null;
  }

  function shouldUsePseudoFullscreen() {
    if (typeof navigator === "undefined") {
      return false;
    }

    const userAgent = navigator.userAgent;
    const isIPhone = /iPhone/i.test(userAgent);
    const isSafari = /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);

    return isIPhone && isSafari;
  }

  async function tryLockLandscapeOrientation() {
    const orientation = getScreenOrientationController();
    if (!orientation?.lock) {
      return;
    }

    try {
      await orientation.lock("landscape");
    } catch {
      // Some browsers allow fullscreen but reject orientation lock. Keep fullscreen anyway.
    }
  }

  function tryUnlockOrientation() {
    const orientation = getScreenOrientationController();
    if (!orientation?.unlock) {
      return;
    }

    try {
      orientation.unlock();
    } catch {
      // Ignore unlock failures and leave browser defaults intact.
    }
  }

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
    if (typeof window === "undefined") {
      return;
    }

    const currentParams = new URLSearchParams(window.location.search);
    const requestedClipId = currentParams.get("clip");
    const requestedVideoId = currentParams.get("video");

    if (requestedClipId) {
      const targetVideo = filmRoomVideos.find((video) => video.clips.some((clip) => clip.id === requestedClipId));
      const targetClip = targetVideo?.clips.find((clip) => clip.id === requestedClipId);

      if (targetVideo && targetClip) {
        if (selectedVideoId !== targetVideo.id) {
          setSelectedVideoId(targetVideo.id);
        }
        if (selectedClipId !== targetClip.id) {
          setSelectedClipId(targetClip.id);
        }
        pendingSharedClipIdRef.current = targetClip.id;
      }

      return;
    }

    if (requestedVideoId && filmRoomVideos.some((video) => video.id === requestedVideoId) && selectedVideoId !== requestedVideoId) {
      setSelectedVideoId(requestedVideoId);
      setSelectedClipId(null);
    }
  }, [filmRoomVideos, selectedClipId, selectedVideoId]);

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
  const availableFormations = useMemo(() => {
    const labels = new Set(formationMasters.map((master) => master.label).filter(Boolean));
    selectedVideoClips.forEach((clip) => {
      if (clip.formation) {
        labels.add(clip.formation);
      }
    });
    return Array.from(labels).sort((left, right) => left.localeCompare(right, "ja"));
  }, [formationMasters, selectedVideoClips]);
  const availablePlayTypes = useMemo(() => {
    const labels = new Set(playTypeMasters.map((master) => master.label).filter(Boolean));
    selectedVideoClips.forEach((clip) => {
      if (clip.playType) {
        labels.add(clip.playType);
      }
    });
    return Array.from(labels).sort((left, right) => left.localeCompare(right, "ja"));
  }, [playTypeMasters, selectedVideoClips]);
  const availablePenaltyTypes = useMemo(() => {
    const labels = new Set(penaltyTypeMasters.map((master) => master.label).filter(Boolean));
    selectedVideoClips.forEach((clip) => {
      if (clip.penaltyType) {
        labels.add(clip.penaltyType);
      }
    });
    return Array.from(labels).sort((left, right) => left.localeCompare(right, "ja"));
  }, [penaltyTypeMasters, selectedVideoClips]);

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

  const playbackClip =
    selectedVideoClips.find((clip) => currentTime >= clip.startSeconds && currentTime <= clip.endSeconds) ??
    null;
  const activeClip =
    playbackClip ??
    selectedVideoClips.find((clip) => clip.id === selectedClipId) ??
    null;
  const summaryClip = editingClipId ? null : playbackClip;
  const detailClip =
    selectedVideoClips.find((clip) => clip.id === editingClipId) ??
    summaryClip ??
    null;
  const playbackInsertionIndex = selectedVideoClips.findIndex((clip) => currentTime < clip.startSeconds);
  const previousSummaryClip =
    playbackClip
      ? selectedVideoClips[selectedVideoClips.findIndex((clip) => clip.id === playbackClip.id) - 1] ?? null
      : playbackInsertionIndex === -1
        ? selectedVideoClips[selectedVideoClips.length - 1] ?? null
        : selectedVideoClips[playbackInsertionIndex - 1] ?? null;
  const nextSummaryClip =
    playbackClip
      ? selectedVideoClips[selectedVideoClips.findIndex((clip) => clip.id === playbackClip.id) + 1] ?? null
      : playbackInsertionIndex === -1
        ? null
        : selectedVideoClips[playbackInsertionIndex] ?? null;
  const activePlaybookAsset = useMemo(() => {
    const targetClip = playbackClip ?? activeClip;
    if (!targetClip) {
      return null;
    }

    const normalizedFormation = targetClip.formation.trim().toLowerCase();
    const normalizedPlayType = targetClip.playType.trim().toLowerCase();

    if (!normalizedFormation || !normalizedPlayType) {
      return null;
    }

    return (
      playbookAssets.find((asset) =>
        asset.side === "offense" &&
        asset.formation.trim().toLowerCase() === normalizedFormation &&
        asset.playType.trim().toLowerCase() === normalizedPlayType,
      ) ?? null
    );
  }, [activeClip, playbackClip, playbookAssets]);
  const editingPlaybookAsset = useMemo(() => {
    const normalizedFormation = playbookForm.formation.trim().toLowerCase();
    const normalizedPlayType = playbookForm.playType.trim().toLowerCase();

    if (!normalizedFormation || !normalizedPlayType) {
      return null;
    }

    return (
      playbookAssets.find((asset) =>
        asset.side === playbookForm.side &&
        asset.formation.trim().toLowerCase() === normalizedFormation &&
        asset.playType.trim().toLowerCase() === normalizedPlayType,
      ) ?? null
    );
  }, [playbookAssets, playbookForm.formation, playbookForm.playType, playbookForm.side]);
  const playbookCanvasInitialState = (editingPlaybookAsset?.boardState as PlaybookWhiteboardState | undefined) ?? null;
  const playbookCanvasBoardId = editingPlaybookAsset
    ? `playbook-asset:${editingPlaybookAsset.id}`
    : `playbook-draft:${playbookForm.side}:${playbookForm.formation.trim().toLowerCase()}:${playbookForm.playType.trim().toLowerCase()}`;
  const whiteboardTargetClip = activeClip ?? detailClip;
  const currentPlaybookUrl = activePlaybookAsset ? playbookUrls[activePlaybookAsset.id] : "";
  const activeClipWhiteboards = whiteboardTargetClip?.whiteboards ?? [];
  const editingSavedWhiteboard =
    editingSavedWhiteboardId && whiteboardTargetClip
      ? whiteboardTargetClip.whiteboards.find((whiteboard) => whiteboard.id === editingSavedWhiteboardId) ?? null
      : null;
  const editingSavedWhiteboardPlaybook = editingSavedWhiteboard?.basePlaybookAssetId
    ? playbookAssets.find((asset) => asset.id === editingSavedWhiteboard.basePlaybookAssetId) ?? null
    : null;
  const editingSavedWhiteboardPlaybookUrl = editingSavedWhiteboardPlaybook ? playbookUrls[editingSavedWhiteboardPlaybook.id] ?? "" : "";
  const currentWhiteboardBaseImageUrl =
    editingSavedWhiteboard
      ? editingSavedWhiteboard.baseMode === "playbook"
        ? editingSavedWhiteboardPlaybookUrl || null
        : editingSavedWhiteboard.baseMode === "image"
          ? editingSavedWhiteboardBaseImageUrl || editingSavedWhiteboard.baseImageUrl || null
          : null
      : whiteboardMode === "playbook"
        ? currentPlaybookUrl || null
        : whiteboardMode === "image"
          ? uploadedWhiteboardPreviewUrl
          : null;
  const currentWhiteboardInitialState = transientWhiteboardState ?? (editingSavedWhiteboard?.boardState as PlaybookWhiteboardState | undefined) ?? null;
  const currentWhiteboardBoardId = whiteboardTargetClip
    ? editingSavedWhiteboard
      ? `whiteboard-edit:${editingSavedWhiteboard.id}`
      : `${whiteboardTargetClip.id}:${whiteboardMode}:${activePlaybookAsset?.id ?? "none"}:${uploadedWhiteboardFile?.name ?? "none"}`
    : "whiteboard:none";
  const currentWhiteboardKey = whiteboardTargetClip
    ? editingSavedWhiteboard
      ? `${editingSavedWhiteboard.id}-${isWhiteboardModalOpen ? "modal" : "inline"}`
      : `${whiteboardTargetClip.id}-${whiteboardMode}-${activePlaybookAsset?.id ?? "none"}-${uploadedWhiteboardPreviewUrl ?? "none"}-${isWhiteboardModalOpen ? "modal" : "inline"}`
    : "whiteboard:none";
  const whiteboardModal = isWhiteboardModalOpen && whiteboardTargetClip && typeof document !== "undefined"
    ? createPortal(
      <div className="film-whiteboard-modal" role="dialog" aria-modal="true" aria-label="解説ボードを拡大表示">
        <div className="film-whiteboard-modal-backdrop" onClick={() => {
          if (whiteboardRef.current) {
            setTransientWhiteboardState(whiteboardRef.current.exportState());
          }
          closeWhiteboardModal();
        }} />
        <div className="film-whiteboard-modal-body is-canvas-only">
          <PlaybookWhiteboard
            key={currentWhiteboardKey}
            ref={whiteboardRef}
            boardId={currentWhiteboardBoardId}
            baseImageUrl={currentWhiteboardBaseImageUrl}
            fullscreenMode
            initialState={currentWhiteboardInitialState}
            onRequestClose={() => {
              if (whiteboardRef.current) {
                setTransientWhiteboardState(whiteboardRef.current.exportState());
              }
              closeWhiteboardModal();
            }}
            onRequestSave={() => void handleSaveClipWhiteboard()}
            saveDisabled={
              syncing ||
              ((editingSavedWhiteboard?.baseMode ?? whiteboardMode) === "playbook" && !currentWhiteboardBaseImageUrl) ||
              ((editingSavedWhiteboard?.baseMode ?? whiteboardMode) === "image" && !currentWhiteboardBaseImageUrl)
            }
            saveLabel={editingSavedWhiteboard ? "変更を保存" : "このボードを保存"}
            title={whiteboardTargetClip.title}
          />
        </div>
      </div>,
      document.body,
    )
    : null;

  function buildClipUrl(videoId: string, clipId?: string | null): string {
    const params = new URLSearchParams();
    params.set("video", videoId);
    if (clipId) {
      params.set("clip", clipId);
    }
    const path = typeof window !== "undefined" ? window.location.pathname : "/videos";
    return `${path}?${params.toString()}`;
  }

  function syncSelectionUrl(videoId: string, clipId?: string | null) {
    if (typeof window === "undefined") {
      return;
    }

    window.history.replaceState({}, "", buildClipUrl(videoId, clipId));
  }

  const applyPendingSharedClipSelection = useCallback(() => {
    const pendingClipId = pendingSharedClipIdRef.current;
    if (!pendingClipId || !playerRef.current) {
      return;
    }

    const clip = selectedVideoClips.find((candidate) => candidate.id === pendingClipId);
    if (!clip) {
      return;
    }

    playerRef.current.seekTo(clip.startSeconds, true);
    setCurrentTime(clip.startSeconds);
    setSelectedClipId(clip.id);
    setDetailPanelOpen(true);
    pendingSharedClipIdRef.current = null;

    const targetNode = clipCardRefs.current[pendingClipId];
    targetNode?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [selectedVideoClips]);

  useEffect(() => {
    setCurrentTime(0);
    setSelectedClipId(null);
    setEditingClipId(null);
    setShowClipComposer(false);
    setDetailPanelOpen(false);
    setIsPlaybackFullscreen(false);
    setIsPseudoFullscreen(false);
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
    if (typeof document === "undefined") {
      return;
    }

    document.body.classList.toggle("video-whiteboard-modal-open", isWhiteboardModalOpen);
    return () => {
      document.body.classList.remove("video-whiteboard-modal-open");
    };
  }, [isWhiteboardModalOpen]);

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
                applyPendingSharedClipSelection();
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
  }, [applyPendingSharedClipSelection, playerHostId, selectedVideoYoutubeId, setTeamMessage]);

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
    applyPendingSharedClipSelection();
  }, [applyPendingSharedClipSelection]);

  useEffect(() => {
    let cancelled = false;

    if (!playbookAssets.length) {
      setPlaybookUrls({});
      return;
    }

    if (!usingRemoteData || !supabase) {
      setPlaybookUrls(
        Object.fromEntries(
          playbookAssets
            .filter((asset) => asset.imageUrl)
            .map((asset) => [asset.id, asset.imageUrl as string]),
        ),
      );
      return;
    }

    Promise.all(
      playbookAssets.map(async (asset) => {
        const { data, error } = await supabase.storage.from(PLAYBOOK_BUCKET).createSignedUrl(asset.imagePath, 60 * 60);
        if (error || !data?.signedUrl) {
          return [asset.id, ""] as const;
        }
        return [asset.id, data.signedUrl] as const;
      }),
    )
      .then((entries) => {
        if (cancelled) {
          return;
        }

        setPlaybookUrls(Object.fromEntries(entries.filter((entry) => entry[1])));
      })
      .catch(() => {
        if (!cancelled) {
          setPlaybookUrls({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, [playbookAssets, supabase, usingRemoteData]);

  useEffect(() => {
    const nextMode = activePlaybookAsset && currentPlaybookUrl ? "playbook" : "blank";
    setWhiteboardMode(nextMode);
    resetWhiteboardComposer();
    setIsWhiteboardModalOpen(false);
  }, [activeClip?.id, activePlaybookAsset, currentPlaybookUrl]);

  useEffect(() => {
    if (!uploadedWhiteboardFile) {
      setUploadedWhiteboardPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(uploadedWhiteboardFile);
    setUploadedWhiteboardPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [uploadedWhiteboardFile]);

  useEffect(() => {
    let cancelled = false;

    const allWhiteboards = filmRoomVideos.flatMap((video) => video.clips.flatMap((clip) => clip.whiteboards));

    if (!allWhiteboards.length) {
      setClipWhiteboardUrls({});
      setClipWhiteboardBaseUrls({});
      return;
    }

    if (!usingRemoteData || !supabase) {
      setClipWhiteboardUrls(
        Object.fromEntries(
          allWhiteboards
            .filter((whiteboard) => whiteboard.imageUrl)
            .map((whiteboard) => [whiteboard.id, whiteboard.imageUrl as string]),
        ),
      );
      setClipWhiteboardBaseUrls(
        Object.fromEntries(
          allWhiteboards
            .filter((whiteboard) => whiteboard.baseImageUrl)
            .map((whiteboard) => [whiteboard.id, whiteboard.baseImageUrl as string]),
        ),
      );
      return;
    }

    Promise.all(
      allWhiteboards.map(async (whiteboard) => {
        const [imageResult, baseImageResult] = await Promise.all([
          supabase.storage.from(CLIP_WHITEBOARD_BUCKET).createSignedUrl(whiteboard.imagePath, 60 * 60),
          whiteboard.baseImagePath
            ? supabase.storage.from(CLIP_WHITEBOARD_BUCKET).createSignedUrl(whiteboard.baseImagePath, 60 * 60)
            : Promise.resolve({ data: null, error: null }),
        ]);

        return {
          id: whiteboard.id,
          imageUrl: imageResult.error || !imageResult.data?.signedUrl ? "" : imageResult.data.signedUrl,
          baseImageUrl: baseImageResult.error || !baseImageResult.data?.signedUrl ? "" : baseImageResult.data.signedUrl,
        } as const;
      }),
    )
      .then((entries) => {
        if (cancelled) {
          return;
        }

        setClipWhiteboardUrls(Object.fromEntries(entries.filter((entry) => entry.imageUrl).map((entry) => [entry.id, entry.imageUrl])));
        setClipWhiteboardBaseUrls(Object.fromEntries(entries.filter((entry) => entry.baseImageUrl).map((entry) => [entry.id, entry.baseImageUrl])));
      })
      .catch(() => {
        if (!cancelled) {
          setClipWhiteboardUrls({});
          setClipWhiteboardBaseUrls({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filmRoomVideos, supabase, usingRemoteData]);

  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const unlockOrientation = () => {
      const orientation = getScreenOrientationController();
      if (!orientation?.unlock) {
        return;
      }

      try {
        orientation.unlock();
      } catch {
        // Ignore unlock failures and leave browser defaults intact.
      }
    };

    const handleFullscreenChange = () => {
      const isCurrentShellFullscreen = document.fullscreenElement === playbackShellRef.current;
      setIsPlaybackFullscreen(isCurrentShellFullscreen);
      if (isCurrentShellFullscreen) {
        setIsPseudoFullscreen(false);
      }
      if (!isCurrentShellFullscreen) {
        unlockOrientation();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    if (!isPseudoFullscreen) {
      return;
    }

    const scrollY = window.scrollY;
    document.documentElement.classList.add("video-pseudo-fullscreen");
    document.body.classList.add("video-pseudo-fullscreen");
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;
    const previousBodyInset = document.body.style.inset;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    window.scrollTo({ top: 0, behavior: "auto" });
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.inset = "0";
    document.body.style.width = "100%";

    return () => {
      document.documentElement.classList.remove("video-pseudo-fullscreen");
      document.body.classList.remove("video-pseudo-fullscreen");
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      document.body.style.inset = previousBodyInset;
      window.scrollTo({ top: scrollY, behavior: "auto" });
    };
  }, [isPseudoFullscreen]);

  async function enterPlaybackFullscreen() {
    const shell = playbackShellRef.current;
    if (!shell || typeof document === "undefined") {
      setIsPseudoFullscreen(true);
      setIsPlaybackFullscreen(true);
      return;
    }

    if (shouldUsePseudoFullscreen()) {
      window.scrollTo({ top: 0, behavior: "auto" });
      setIsPseudoFullscreen(true);
      setIsPlaybackFullscreen(true);
      await tryLockLandscapeOrientation();
      return;
    }

    if (document.fullscreenElement === shell) {
      setIsPseudoFullscreen(false);
      setIsPlaybackFullscreen(true);
      await tryLockLandscapeOrientation();
      return;
    }

    if (typeof shell.requestFullscreen !== "function") {
      setIsPseudoFullscreen(true);
      setIsPlaybackFullscreen(true);
      return;
    }

    try {
      await shell.requestFullscreen();
      setIsPseudoFullscreen(false);
      setIsPlaybackFullscreen(true);
      await tryLockLandscapeOrientation();
    } catch {
      setIsPseudoFullscreen(true);
      setIsPlaybackFullscreen(true);
    }
  }

  async function exitPlaybackFullscreen() {
    tryUnlockOrientation();
    setIsPseudoFullscreen(false);

    if (typeof document === "undefined") {
      setIsPlaybackFullscreen(false);
      return;
    }

    if (document.fullscreenElement === playbackShellRef.current && typeof document.exitFullscreen === "function") {
      try {
        await document.exitFullscreen();
        return;
      } catch {
        // Fall back to local state below if the browser denies programmatic exit.
      }
    }

    setIsPlaybackFullscreen(false);
  }

  async function openWhiteboardModal() {
    playerRef.current?.pauseVideo?.();

    const wasFullscreen = isPlaybackFullscreen || isPseudoFullscreen;
    setWasFullscreenBeforeWhiteboard(wasFullscreen);

    if (wasFullscreen) {
      await exitPlaybackFullscreen();
    }

    if (whiteboardRef.current) {
      setTransientWhiteboardState(whiteboardRef.current.exportState());
    }
    setIsWhiteboardModalOpen(true);
  }

  function closeWhiteboardModal() {
    setIsWhiteboardModalOpen(false);
    if (wasFullscreenBeforeWhiteboard) {
      void enterPlaybackFullscreen();
      setWasFullscreenBeforeWhiteboard(false);
    }
  }

  function updateVideoForm<Key extends keyof VideoForm>(key: Key, value: VideoForm[Key]) {
    setVideoForm((current) => ({ ...current, [key]: value }));
  }

  function updateClipForm<Key extends keyof ClipForm>(key: Key, value: ClipForm[Key]) {
    setClipForm((current) => ({ ...current, [key]: value }));
  }

  function updateImportForm<Key extends keyof ImportForm>(key: Key, value: ImportForm[Key]) {
    setImportForm((current) => ({ ...current, [key]: value }));
  }

  function updatePlaybookForm<Key extends keyof PlaybookForm>(key: Key, value: PlaybookForm[Key]) {
    setPlaybookForm((current) => ({ ...current, [key]: value }));
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

  const playbackExperience = selectedVideo && selectedVideoYoutubeId ? (
    <div
      ref={playbackShellRef}
      className={`film-focus-shell ${isPlaybackFullscreen ? "is-fullscreen" : ""} ${isPseudoFullscreen ? "is-pseudo-fullscreen" : ""}`}
    >
      {isPlaybackFullscreen ? (
        <div className="film-focus-topbar">
          <button
            className="film-fullscreen-close"
            type="button"
            aria-label="全画面を閉じる"
            title="全画面を閉じる"
            onClick={() => {
              void exitPlaybackFullscreen();
            }}
          >
            <Minimize aria-hidden="true" />
            <span className="sr-only">全画面を閉じる</span>
          </button>
        </div>
      ) : null}
      <div className="film-playback-layout">
        <div className="film-playback-main">
          <div className="film-player-frame">
            <div id={playerHostId} className="film-player-host" />
          </div>
        </div>

        <div className="film-playback-side">
          {summaryClip ? (
            <div className="film-summary-bar">
              <div className="film-summary-copy">
                <strong>{summaryClip.title}</strong>
                <span>
                  {formatSecondsAsTime(summaryClip.startSeconds)} - {formatSecondsAsTime(summaryClip.endSeconds)}
                </span>
                {formatSituationText(summaryClip) ? (
                  <span className="film-summary-situation">{formatSituationText(summaryClip)}</span>
                ) : null}
              </div>
              <div className="film-summary-actions">
                <button
                  className="film-summary-icon-button"
                  type="button"
                  aria-label="前のプレーに戻る"
                  title="前のプレーに戻る"
                  onClick={() => {
                    if (previousSummaryClip) {
                      jumpToClip(previousSummaryClip);
                    }
                  }}
                  disabled={!previousSummaryClip}
                >
                  <Rewind aria-hidden="true" />
                  <span className="sr-only">前のプレーに戻る</span>
                </button>
                {summaryClip ? (
                  <button
                    className="film-summary-icon-button"
                    type="button"
                    aria-label="このプレーの最初から見る"
                    title="このプレーの最初から見る"
                    onClick={() => jumpToClip(summaryClip)}
                  >
                    <RotateCcw aria-hidden="true" />
                    <span className="sr-only">このプレーの最初から見る</span>
                  </button>
                ) : null}
                <button
                  className="film-summary-icon-button"
                  type="button"
                  aria-label="次のプレーを見る"
                  title="次のプレーを見る"
                  onClick={() => {
                    if (nextSummaryClip) {
                      jumpToClip(nextSummaryClip);
                    }
                  }}
                  disabled={!nextSummaryClip}
                >
                  <FastForward aria-hidden="true" />
                  <span className="sr-only">次のプレーを見る</span>
                </button>
                {summaryClip ? (
                  <button
                    className="film-summary-icon-button"
                    type="button"
                    aria-label={detailPanelOpen ? "詳細を閉じる" : "詳細を見る"}
                    title={detailPanelOpen ? "詳細を閉じる" : "詳細を見る"}
                    onClick={() => setDetailPanelOpen((current) => !current)}
                  >
                    {detailPanelOpen ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    <span className="sr-only">{detailPanelOpen ? "詳細を閉じる" : "詳細を見る"}</span>
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="film-summary-bar film-summary-bar-empty">
              <div className="film-summary-copy">
                <strong>この位置には注釈がありません</strong>
                <span>注釈のあるプレー位置へ移動すると、ここに要約と詳細が表示されます。</span>
              </div>
              <div className="film-summary-actions">
                <button
                  className="film-summary-icon-button"
                  type="button"
                  aria-label="前のプレーに戻る"
                  title="前のプレーに戻る"
                  onClick={() => {
                    if (previousSummaryClip) {
                      jumpToClip(previousSummaryClip);
                    }
                  }}
                  disabled={!previousSummaryClip}
                >
                  <Rewind aria-hidden="true" />
                  <span className="sr-only">前のプレーに戻る</span>
                </button>
                <button
                  className="film-summary-icon-button"
                  type="button"
                  aria-label="次のプレーを見る"
                  title="次のプレーを見る"
                  onClick={() => {
                    if (nextSummaryClip) {
                      jumpToClip(nextSummaryClip);
                    }
                  }}
                  disabled={!nextSummaryClip}
                >
                  <FastForward aria-hidden="true" />
                  <span className="sr-only">次のプレーを見る</span>
                </button>
              </div>
            </div>
          )}

          {detailClip && (detailPanelOpen || (canManageTeam && selectedVideo && editingClipId === detailClip.id)) ? (
            <div className="film-active-card film-detail-sheet">
              {canManageTeam && selectedVideo && editingClipId === detailClip.id ? (
                <>
                  <div className="film-editing-banner">
                    <strong>このプレーをカード内で編集しています</strong>
                    <button
                      className="button secondary button-compact"
                      type="button"
                      onClick={() => resetClipForm(selectedVideo.id)}
                      disabled={syncing}
                    >
                      閉じる
                    </button>
                  </div>
                  <VideoClipEditor
                    activePlayers={activePlayers}
                    availableFormations={availableFormations}
                    availablePenaltyTypes={availablePenaltyTypes}
                    availablePlayTypes={availablePlayTypes}
                    canManageTeam={canManageTeam}
                    clipForm={clipForm}
                    editingClipId={editingClipId}
                    filmRoomVideos={filmRoomVideos}
                    formationListId={formationListId}
                    inline
                    onAddClipPlayerLink={addClipPlayerLink}
                    onRemoveClipPlayerLink={removeClipPlayerLink}
                    onReset={resetClipForm}
                    onSave={handleSaveClip}
                    onUpdateClipForm={updateClipForm}
                    onUpdateClipPlayerLink={updateClipPlayerLink}
                    penaltyTypeListId={penaltyTypeListId}
                    playTypeListId={playTypeListId}
                    positionMasters={positionMasters}
                    syncing={syncing}
                    targetVideoId={selectedVideo.id}
                  />
                </>
              ) : (
                <>
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
                    {detailClip.focusTargets.length ? (
                      <div className="film-meta-group">
                        <span className="film-meta-label">注目してほしい選手</span>
                        <div className="chip-row">
                          {detailClip.focusTargets.map((label) => (
                            <span key={label} className="chip ok">{label}</span>
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
                  {canManageTeam && detailClip.coachComment ? (
                    <div className="film-meta-group">
                      <span className="film-meta-label">コーチ間コメント</span>
                      <p className="film-comment">{detailClip.coachComment}</p>
                    </div>
                  ) : null}
                  {canManageTeam && selectedVideo ? (
                    <div className="film-inline-actions film-detail-actions">
                      <button
                        className="button secondary button-compact"
                        type="button"
                        onClick={() => handleCopyClipLink(detailClip)}
                      >
                        リンクをコピー
                      </button>
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
                  ) : selectedVideo ? (
                    <div className="film-inline-actions film-detail-actions">
                      <button
                        className="button secondary button-compact"
                        type="button"
                        onClick={() => handleCopyClipLink(detailClip)}
                      >
                        リンクをコピー
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {activePlaybookAsset ? (
            <div className="film-playbook-card film-playbook-card-standalone">
              <div className="film-playbook-head">
                <div>
                  <span className="film-meta-label">自動表示プレーブック</span>
                  <strong>{activePlaybookAsset.title}</strong>
                </div>
              </div>
              {playbookUrls[activePlaybookAsset.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="film-playbook-image"
                  src={playbookUrls[activePlaybookAsset.id]}
                  alt={`${activePlaybookAsset.title} のプレーブック`}
                />
              ) : (
                <p className="empty-state">プレーブック画像を読み込んでいます。</p>
              )}
            </div>
          ) : null}

          {whiteboardTargetClip ? (
            <div className="film-playbook-card film-playbook-card-standalone">
              <div className="film-playbook-head">
                <div>
                  <span className="film-meta-label">解説ボード</span>
                  <strong>{whiteboardTargetClip.title} 用のメモ</strong>
                </div>
                <div className="chip-row">
                  <span className="chip">{activeClipWhiteboards.length}枚保存済み</span>
                </div>
              </div>

              {canManageTeam ? (
                <>
                  {editingSavedWhiteboard ? (
                    <div className="status-strip">
                      <span className="chip ok">保存済みボードを編集中</span>
                      <button
                        className="button ghost"
                        type="button"
                        onClick={resetWhiteboardComposer}
                        disabled={syncing}
                      >
                        新規作成に戻す
                      </button>
                    </div>
                  ) : null}
                  <div className="film-whiteboard-mode-row">
                    <button
                      className={`button secondary button-compact ${whiteboardMode === "playbook" ? "is-selected" : ""}`}
                      type="button"
                      onClick={() => setWhiteboardMode("playbook")}
                      disabled={Boolean(editingSavedWhiteboard) || !activePlaybookAsset || !currentPlaybookUrl}
                    >
                      プレーブックに書く
                    </button>
                    <button
                      className={`button secondary button-compact ${whiteboardMode === "blank" ? "is-selected" : ""}`}
                      type="button"
                      onClick={() => setWhiteboardMode("blank")}
                      disabled={Boolean(editingSavedWhiteboard)}
                    >
                      白紙に書く
                    </button>
                    <button
                      className={`button secondary button-compact ${whiteboardMode === "image" ? "is-selected" : ""}`}
                      type="button"
                      onClick={() => setWhiteboardMode("image")}
                      disabled={Boolean(editingSavedWhiteboard)}
                    >
                      画像に書く
                    </button>
                  </div>

                  <label className="field-stack">
                    <span className="field-label">保存タイトル</span>
                    <input
                      type="text"
                      placeholder="未入力ならプレー名から自動作成"
                      value={whiteboardTitle}
                      onChange={(event) => setWhiteboardTitle(event.target.value)}
                      disabled={syncing}
                    />
                  </label>

                  {!editingSavedWhiteboard && whiteboardMode === "image" ? (
                    <label className="field-stack">
                      <span className="field-label">背景画像</span>
                      <input
                        key={uploadedWhiteboardInputKey}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(event) => setUploadedWhiteboardFile(event.target.files?.[0] ?? null)}
                        disabled={syncing}
                      />
                    </label>
                  ) : null}

                  {!isWhiteboardModalOpen ? (
                    <PlaybookWhiteboard
                      key={currentWhiteboardKey}
                      ref={whiteboardRef}
                      boardId={currentWhiteboardBoardId}
                      baseImageUrl={currentWhiteboardBaseImageUrl}
                      initialState={currentWhiteboardInitialState}
                      title={whiteboardTargetClip.title}
                    />
                  ) : null}

                  <div className="film-inline-actions">
                    <button
                      className="button secondary button-compact"
                      type="button"
                      onClick={() => {
                        void openWhiteboardModal();
                      }}
                    >
                      <Expand aria-hidden="true" />
                      拡大して編集
                    </button>
                    <button
                      className="button"
                      type="button"
                      onClick={() => void handleSaveClipWhiteboard()}
                      disabled={
                        syncing ||
                        ((editingSavedWhiteboard?.baseMode ?? whiteboardMode) === "playbook" && !currentWhiteboardBaseImageUrl) ||
                        ((editingSavedWhiteboard?.baseMode ?? whiteboardMode) === "image" && !currentWhiteboardBaseImageUrl)
                      }
                    >
                      <Save aria-hidden="true" />
                      {editingSavedWhiteboard ? "変更を保存" : "このボードを保存"}
                    </button>
                  </div>
                </>
              ) : null}

              <div className="film-whiteboard-gallery">
                {activeClipWhiteboards.length ? (
                  activeClipWhiteboards.map((whiteboard) => (
                    <article className="doc-card film-whiteboard-card" key={whiteboard.id}>
                      <div className="doc-row">
                        <div>
                          <strong>{whiteboard.title}</strong>
                          <div className="subtle">
                            {whiteboard.baseMode === "playbook"
                              ? "プレーブック背景"
                              : whiteboard.baseMode === "image"
                                ? "アップロード画像"
                                : "白紙"}
                          </div>
                        </div>
                        {canManageTeam ? (
                          <div className="chip-row">
                            <button
                              className="button ghost"
                              type="button"
                              onClick={() => startEditingClipWhiteboard(whiteboard)}
                              disabled={syncing}
                            >
                              編集
                            </button>
                            <button
                              className="button ghost"
                              type="button"
                              onClick={() => void handleDeleteClipWhiteboard(whiteboardTargetClip.id, whiteboard.id, whiteboard.imagePath, whiteboard.title, whiteboard.baseImagePath)}
                              disabled={syncing}
                            >
                              <Trash2 aria-hidden="true" />
                              削除
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {clipWhiteboardUrls[whiteboard.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className="film-playbook-library-image"
                          src={clipWhiteboardUrls[whiteboard.id]}
                          alt={`${whiteboard.title} の解説ボード`}
                        />
                      ) : (
                        <div className="film-playbook-library-placeholder">
                          <ImageIcon aria-hidden="true" />
                          <span>画像を読み込み中</span>
                        </div>
                      )}
                    </article>
                  ))
                ) : (
                  <p className="empty-state">まだ保存済みの解説ボードはありません。</p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {canManageTeam && selectedVideo ? (
        <div className="film-inline-editor-wrap">
          <div className="film-inline-actions">
            <span className="chip">再生位置 {formatSecondsAsTime(currentTime)}</span>
            <button
              className="button"
              type="button"
              onClick={() => beginClipCreation(selectedVideo.id, Math.floor(currentTime))}
              disabled={syncing || Boolean(editingClipId)}
            >
              このタイミングに注釈を追加
            </button>
            {editingClipId ? <span className="subtle">編集中の注釈を保存またはキャンセルすると追加できます。</span> : null}
          </div>
          {showClipComposer && !editingClipId ? (
            <>
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
              <VideoClipEditor
                activePlayers={activePlayers}
                availableFormations={availableFormations}
                availablePenaltyTypes={availablePenaltyTypes}
                availablePlayTypes={availablePlayTypes}
                canManageTeam={canManageTeam}
                clipForm={clipForm}
                editingClipId={editingClipId}
                filmRoomVideos={filmRoomVideos}
                formationListId={formationListId}
                inline
                onAddClipPlayerLink={addClipPlayerLink}
                onRemoveClipPlayerLink={removeClipPlayerLink}
                onReset={resetClipForm}
                onSave={handleSaveClip}
                onUpdateClipForm={updateClipForm}
                onUpdateClipPlayerLink={updateClipPlayerLink}
                penaltyTypeListId={penaltyTypeListId}
                playTypeListId={playTypeListId}
                positionMasters={positionMasters}
                syncing={syncing}
                targetVideoId={selectedVideo.id}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  ) : null;

  function jumpToClip(clip: VideoClip) {
    if (!playerRef.current) {
      return;
    }

    playerRef.current.seekTo(clip.startSeconds, true);
    playerRef.current.playVideo();
    setCurrentTime(clip.startSeconds);
    setSelectedClipId(clip.id);
    setDetailPanelOpen(true);
    if (selectedVideo) {
      syncSelectionUrl(selectedVideo.id, clip.id);
    }
  }

  async function handleCopyClipLink(clip: VideoClip) {
    if (!selectedVideo || typeof window === "undefined") {
      return;
    }

    const nextUrl = new URL(buildClipUrl(selectedVideo.id, clip.id), window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(nextUrl);
      syncSelectionUrl(selectedVideo.id, clip.id);
      setTeamMessage(`プレー「${clip.title}」へのリンクをコピーしました。`);
    } catch {
      setTeamMessage("リンクのコピーに失敗しました。");
    }
  }

  function loadClipIntoForm(clip: VideoClip, videoId: string) {
    setClipForm({
      videoId,
      title: clip.title,
      startText: formatSecondsAsTime(clip.startSeconds),
      endText: formatSecondsAsTime(clip.endSeconds),
      down: clip.down !== undefined ? String(clip.down) : "",
      toGoYards: clip.toGoYards ?? "",
      penaltyType: clip.penaltyType ?? "",
      formation: clip.formation,
      playType: clip.playType,
      playerLinks: clip.playerLinks.length ? clip.playerLinks.map((link) => ({ ...link, positionId: link.positionId ?? "" })) : [{ playerId: "", positionId: "" }],
      focusTargets: clip.focusTargets,
      comment: clip.comment,
      coachComment: clip.coachComment ?? "",
    });
    setEditingClipId(clip.id);
    setDetailPanelOpen(true);
  }

  function resetClipForm(videoId: string) {
    setClipForm({
      ...initialClipForm,
      videoId,
    });
    setEditingClipId(null);
    setDetailPanelOpen(false);
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

  function resetPlaybookForm() {
    setPlaybookForm(initialPlaybookForm);
    setPlaybookFile(null);
    setPlaybookSourceMode("upload");
    setPlaybookInputKey((current) => current + 1);
  }

  function resetWhiteboardComposer() {
    setEditingSavedWhiteboardId(null);
    setEditingSavedWhiteboardBaseImageUrl(null);
    setWhiteboardTitle("");
    setUploadedWhiteboardFile(null);
    setUploadedWhiteboardPreviewUrl(null);
    setUploadedWhiteboardInputKey((current) => current + 1);
    setTransientWhiteboardState(null);
  }

  function updateClipWhiteboards(clipId: string, updater: (current: VideoClip["whiteboards"]) => VideoClip["whiteboards"]) {
    setFilmRoomVideos((current) =>
      current.map((video) => ({
        ...video,
        clips: video.clips.map((clip) =>
          clip.id === clipId
            ? { ...clip, whiteboards: updater(clip.whiteboards) }
            : clip,
        ),
      })),
    );
  }

  function startEditingClipWhiteboard(whiteboard: VideoClip["whiteboards"][number]) {
    const nextBaseImageUrl = whiteboard.baseMode === "image"
      ? (whiteboard.baseImageUrl ?? clipWhiteboardBaseUrls[whiteboard.id] ?? null)
      : null;

    setEditingSavedWhiteboardId(whiteboard.id);
    setWhiteboardMode(whiteboard.baseMode);
    setWhiteboardTitle(whiteboard.title);
    setUploadedWhiteboardFile(null);
    setUploadedWhiteboardPreviewUrl(nextBaseImageUrl);
    setEditingSavedWhiteboardBaseImageUrl(nextBaseImageUrl);
    setUploadedWhiteboardInputKey((current) => current + 1);
    setTransientWhiteboardState(null);
    closeWhiteboardModal();
  }

  async function handleSaveClipWhiteboard() {
    if (!whiteboardTargetClip || !whiteboardRef.current || syncing) {
      return;
    }

    const effectiveMode = editingSavedWhiteboard?.baseMode ?? whiteboardMode;
    const effectivePlaybookAssetId = editingSavedWhiteboard?.basePlaybookAssetId ?? (effectiveMode === "playbook" ? activePlaybookAsset?.id : undefined);

    if (effectiveMode === "playbook" && !currentWhiteboardBaseImageUrl) {
      setTeamMessage("プレーブック背景がないため、白紙モードで保存してください。");
      return;
    }

    if (effectiveMode === "image" && !currentWhiteboardBaseImageUrl) {
      setTeamMessage("背景に使う画像を選択してください。");
      return;
    }

    const exported = await whiteboardRef.current.exportToPng();
    if (!exported) {
      setTeamMessage("ホワイトボード画像の書き出しに失敗しました。");
      return;
    }

    const boardState = whiteboardRef.current.exportState();
    const nextTitle =
      whiteboardTitle.trim() ||
      `${whiteboardTargetClip.title} ${whiteboardTargetClip.whiteboards.length + 1}`;

    try {
      setSyncing(true);

      if (usingRemoteData && supabase) {
        const storagePath = `${whiteboardTargetClip.id}/${Date.now()}-${crypto.randomUUID()}.png`;
        const { error: uploadError } = await supabase.storage.from(CLIP_WHITEBOARD_BUCKET).upload(storagePath, exported.blob, {
          contentType: "image/png",
          upsert: false,
        });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        let baseImagePath = editingSavedWhiteboard?.baseImagePath;
        if (effectiveMode === "image" && uploadedWhiteboardFile) {
          const extension = uploadedWhiteboardFile.name.includes(".")
            ? uploadedWhiteboardFile.name.split(".").pop()?.toLowerCase() ?? "png"
            : "png";
          const safeExtension = extension.replace(/[^a-z0-9]/g, "") || "png";
          const nextBaseImagePath = `${whiteboardTargetClip.id}/base-${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;
          const { error: baseUploadError } = await supabase.storage.from(CLIP_WHITEBOARD_BUCKET).upload(nextBaseImagePath, uploadedWhiteboardFile, {
            cacheControl: "3600",
            upsert: false,
          });

          if (baseUploadError) {
            throw new Error(baseUploadError.message);
          }

          if (editingSavedWhiteboard?.baseImagePath && editingSavedWhiteboard.baseImagePath !== nextBaseImagePath) {
            await supabase.storage.from(CLIP_WHITEBOARD_BUCKET).remove([editingSavedWhiteboard.baseImagePath]);
          }

          baseImagePath = nextBaseImagePath;
        }

        if (editingSavedWhiteboard) {
          const saved = await updateClipWhiteboard(supabase, {
            id: editingSavedWhiteboard.id,
            title: nextTitle,
            baseMode: effectiveMode,
            basePlaybookAssetId: effectivePlaybookAssetId,
            imagePath: storagePath,
            baseImagePath,
            boardState,
          });

          if (editingSavedWhiteboard.imagePath && editingSavedWhiteboard.imagePath !== storagePath) {
            await supabase.storage.from(CLIP_WHITEBOARD_BUCKET).remove([editingSavedWhiteboard.imagePath]);
          }

          updateClipWhiteboards(whiteboardTargetClip.id, (current) =>
            current.map((whiteboard) => (whiteboard.id === saved.id ? saved : whiteboard)),
          );
        } else {
          const saved = await insertClipWhiteboard(supabase, {
            clipId: whiteboardTargetClip.id,
            title: nextTitle,
            baseMode: effectiveMode,
            basePlaybookAssetId: effectivePlaybookAssetId,
            imagePath: storagePath,
            baseImagePath,
            boardState,
            sortOrder: whiteboardTargetClip.whiteboards.length + 1,
          });

          updateClipWhiteboards(saved.clipId, (current) => [...current, saved.whiteboard]);
        }
      } else {
        const saved = {
          id: editingSavedWhiteboard?.id ?? `cw-${Date.now()}`,
          title: nextTitle,
          baseMode: effectiveMode,
          basePlaybookAssetId: effectivePlaybookAssetId,
          imagePath: "",
          baseImagePath: undefined,
          imageUrl: exported.dataUrl,
          baseImageUrl: effectiveMode === "image" ? currentWhiteboardBaseImageUrl ?? undefined : undefined,
          boardState,
          updatedAt: new Date().toISOString().slice(0, 10),
        };

        updateClipWhiteboards(whiteboardTargetClip.id, (current) =>
          editingSavedWhiteboard
            ? current.map((whiteboard) => (whiteboard.id === saved.id ? saved : whiteboard))
            : [...current, saved],
        );
      }

      whiteboardRef.current.clear();
      resetWhiteboardComposer();
      setTeamMessage(`解説ボード「${nextTitle}」を${editingSavedWhiteboard ? "更新" : "保存"}しました。`);
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : "解説ボードの保存に失敗しました。");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDeleteClipWhiteboard(clipId: string, whiteboardId: string, imagePath: string, title: string, baseImagePath?: string) {
    if (syncing) {
      return;
    }

    if (!window.confirm(`「${title}」を削除しますか？`)) {
      return;
    }

    try {
      setSyncing(true);

      if (usingRemoteData && supabase) {
        if (imagePath) {
          await supabase.storage.from(CLIP_WHITEBOARD_BUCKET).remove([imagePath]);
        }
        if (baseImagePath) {
          await supabase.storage.from(CLIP_WHITEBOARD_BUCKET).remove([baseImagePath]);
        }
        await deleteClipWhiteboard(supabase, whiteboardId);
      }

      updateClipWhiteboards(clipId, (current) => current.filter((whiteboard) => whiteboard.id !== whiteboardId));
      setTeamMessage(`解説ボード「${title}」を削除しました。`);
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : "解説ボードの削除に失敗しました。");
    } finally {
      setSyncing(false);
    }
  }

  async function handleSavePlaybookAsset() {
    const nextAsset = {
      title: playbookForm.title.trim() || `${playbookForm.formation.trim()} / ${playbookForm.playType.trim()}`,
      side: playbookForm.side,
      formation: playbookForm.formation.trim(),
      playType: playbookForm.playType.trim(),
      audience: playbookForm.audience,
    };

    if (!canManageTeam || syncing) {
      return;
    }

    if (!usingRemoteData || !supabase) {
      setTeamMessage("プレーブック画像の登録は Supabase 接続時に利用できます。");
      return;
    }

    if (!nextAsset.formation || !nextAsset.playType) {
      setTeamMessage("隊形とプレー種類を入れてください。");
      return;
    }

    const existingAsset =
      playbookAssets.find((asset) =>
        asset.side === nextAsset.side &&
        asset.formation.trim().toLowerCase() === nextAsset.formation.toLowerCase() &&
        asset.playType.trim().toLowerCase() === nextAsset.playType.toLowerCase(),
      ) ?? null;

    try {
      setSyncing(true);

      let uploadFile: File | Blob;
      let storageExtension = "png";
      let boardState: PlaybookWhiteboardState | undefined;

      if (playbookSourceMode === "canvas") {
        if (!playbookCreatorRef.current) {
          throw new Error("プレーブック作成キャンバスの準備ができていません。");
        }

        const exported = await playbookCreatorRef.current.exportToPng();
        if (!exported) {
          throw new Error("キャンバスの画像書き出しに失敗しました。");
        }

        uploadFile = exported.blob;
        boardState = playbookCreatorRef.current.exportState();
      } else {
        if (!playbookFile) {
          setTeamMessage("画像ファイルを選ぶか、キャンバスでプレーブックを作成してください。");
          return;
        }

        const extension = playbookFile.name.includes(".")
          ? playbookFile.name.split(".").pop()?.toLowerCase() ?? "png"
          : "png";
        storageExtension = extension.replace(/[^a-z0-9]/g, "") || "png";
        uploadFile = playbookFile;
      }

      const storagePath = `${nextAsset.side}/${Date.now()}-${crypto.randomUUID()}.${storageExtension}`;

      const { error: uploadError } = await supabase.storage.from(PLAYBOOK_BUCKET).upload(storagePath, uploadFile, {
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const savedAsset = await upsertPlaybookAsset(supabase, {
        id: existingAsset?.id,
        ...nextAsset,
        imagePath: storagePath,
        boardState,
      });

      if (existingAsset?.imagePath && existingAsset.imagePath !== storagePath) {
        await supabase.storage.from(PLAYBOOK_BUCKET).remove([existingAsset.imagePath]);
      }

      setPlaybookAssets((current) => {
        const remaining = current.filter((asset) => asset.id !== savedAsset.id);
        return [...remaining, savedAsset].sort((left, right) =>
          `${left.formation} ${left.playType}`.localeCompare(`${right.formation} ${right.playType}`, "ja"),
        );
      });
      resetPlaybookForm();
      setTeamMessage(`プレーブック「${savedAsset.title}」を保存しました。`);
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : "プレーブック画像の保存に失敗しました。");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDeletePlaybookAsset(asset: PlaybookAsset) {
    if (!canManageTeam || syncing) {
      return;
    }

    if (!window.confirm(`「${asset.title}」を削除しますか？`)) {
      return;
    }

    try {
      setSyncing(true);

      if (usingRemoteData && supabase) {
        await supabase.storage.from(PLAYBOOK_BUCKET).remove([asset.imagePath]);
        await deletePlaybookAsset(supabase, asset.id);
      }

      setPlaybookAssets((current) => current.filter((currentAsset) => currentAsset.id !== asset.id));
      setTeamMessage(`プレーブック「${asset.title}」を削除しました。`);
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : "プレーブック画像の削除に失敗しました。");
    } finally {
      setSyncing(false);
    }
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
      coachComment: canManageTeam ? clipForm.coachComment.trim() || undefined : undefined,
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
      focusTargets: clipForm.focusTargets,
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

  async function handleDeleteAllClips(videoId: string) {
    if (!canManageTeam || syncing) {
      return;
    }

    const targetVideo = filmRoomVideos.find((video) => video.id === videoId);
    if (!targetVideo || !targetVideo.clips.length) {
      return;
    }

    if (!window.confirm(`「${targetVideo.title}」のプレー注釈${targetVideo.clips.length}件をすべて削除しますか？この操作は取り消せません。`)) {
      return;
    }

    try {
      setSyncing(true);

      if (usingRemoteData && supabase) {
        await deleteAllFilmClips(supabase, videoId);
      }

      setFilmRoomVideos((current) =>
        current.map((video) =>
          video.id === videoId
            ? { ...video, clips: [], updatedAt: new Date().toISOString().slice(0, 10) }
            : video,
        ),
      );

      resetClipForm(videoId);
      setSelectedClipId(null);
      setShowClipComposer(false);
      setTeamMessage(`「${targetVideo.title}」のプレー注釈をすべて削除しました。`);
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : "プレーの一括削除に失敗しました。");
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
      setImportMessage("ヘッダー行を含む CSV / TSV を貼り付けてください。");
      return;
    }

    try {
      const warnings: string[] = [];
      const clipsToImport: Array<{
        title: string;
        startSeconds: number;
        endSeconds: number;
        down: number | undefined;
        toGoYards: string;
        penaltyType: string;
        formation: string;
        playType: string;
        comment: string;
        coachComment: string;
        playerLinks: VideoClipPlayerLink[];
        focusTargets: string[];
        whiteboards: VideoClip["whiteboards"];
      }> = [];

      for (let index = 0; index < parsedRows.length; index++) {
        const row = parsedRows[index];
        const rowNumber = index + 2;
        const title = getImportCell(row, ["プレー名", "タイトル", "title", "play", "clip"]);
        const startText = getImportCell(row, ["開始時刻", "開始", "start", "starttime", "start_time"]);
        const endText = getImportCell(row, ["終了時刻", "終了", "end", "endtime", "end_time"]);
        const startSeconds = parseTimestamp(startText);
        const endSeconds = parseTimestamp(endText);

        if (!title) {
          warnings.push(`${rowNumber}行目: プレー名が空のため無題で取り込みます。`);
        }
        if (startSeconds === null || endSeconds === null) {
          warnings.push(`${rowNumber}行目: 開始時刻または終了時刻が正しくないためスキップしました。`);
          continue;
        }
        if (endSeconds <= startSeconds) {
          warnings.push(`${rowNumber}行目: 終了時刻が開始時刻以前のためスキップしました。`);
          continue;
        }

        let playerLinks: VideoClipPlayerLink[] = [];
        try {
          playerLinks = parsePlayerLinksFromImport(row, rowNumber);
        } catch (playerError) {
          warnings.push(playerError instanceof Error ? playerError.message : `${rowNumber}行目: 選手の解析に失敗しました。`);
          continue;
        }

        clipsToImport.push({
          title,
          startSeconds,
          endSeconds,
          down: parseDown(getImportCell(row, ["ダウン", "down"])),
          toGoYards: getImportCell(row, ["to go yard", "to_go_yards", "to go", "距離", "to go yard数", "to go yards"]),
          penaltyType: getImportCell(row, ["反則の種類", "反則", "penalty", "penaltytype", "penalty_type"]),
          formation: getImportCell(row, ["隊形", "formation"]),
          playType: getImportCell(row, ["プレー種類", "種類", "playtype", "play_type", "type"]),
          comment: getImportCell(row, ["コメント", "comment", "memo", "メモ"]),
          coachComment: getImportCell(row, ["コーチコメント", "コーチ間コメント", "coachcomment", "coach_comment"]),
          playerLinks,
          focusTargets: [],
          whiteboards: [],
        });
      }

      if (!clipsToImport.length) {
        const msg = warnings.length
          ? `取り込めるプレーがありませんでした。\n${warnings.join("\n")}`
          : "取り込めるプレーがありませんでした。";
        setImportMessage(msg);
        return;
      }

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
      const successMsg = warnings.length
        ? `${savedClips.length}件のプレー注釈をインポートしました。\n${warnings.join("\n")}`
        : `${savedClips.length}件のプレー注釈をインポートしました。`;
      setImportMessage(successMsg);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "プレー注釈のインポートに失敗しました。";
      setImportMessage(msg);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="dashboard dashboard-wide">
      <div className="stack">
        <Section
          title="ビデオ"
          copy="YouTubeの試合動画やプレー合わせ動画を見返しながら、プレーの種類や隊形、コメントを確認できます。"
        >
          <div className="status-strip">
            {syncing ? <span className="chip">保存しています…</span> : null}
            {dataLoading ? <span className="chip">読込中…</span> : null}
            {!canManageTeam ? <span className="chip">閲覧のみ</span> : null}
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
                        onClick={() => {
                          setSelectedVideoId(video.id);
                          setSelectedClipId(null);
                          syncSelectionUrl(video.id);
                        }}
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
                    <div className="film-player-header-controls">
                      <button
                        className="button secondary button-compact"
                        type="button"
                        onClick={() => {
                          void enterPlaybackFullscreen();
                        }}
                      >
                        全画面モード
                      </button>
                      <div className="chip-row">
                        <span className="chip">{formatAudienceLabel(selectedVideo.audience)}</span>
                        <span className="chip">{selectedVideo.sourceLabel}</span>
                        <span className="chip">{selectedVideo.clips.length}プレー</span>
                      </div>
                    </div>
                  ) : null}
                </div>

                {selectedVideo && selectedVideoYoutubeId ? (
                  <>
                    {playbackExperience}

                    <div className="section-row">
                      <div>
                        <h3 className="section-title">プレー一覧</h3>
                        <p className="section-copy">
                          {selectedVideo ? `${selectedVideo.title} のプレーを一覧で確認できます。` : "動画を選ぶとプレー一覧が表示されます。"}
                        </p>
                      </div>
                      {canManageTeam && selectedVideo && selectedVideo.clips.length ? (
                        <button
                          className="button secondary button-compact"
                          type="button"
                          onClick={() => handleDeleteAllClips(selectedVideo.id)}
                          disabled={syncing || Boolean(editingClipId)}
                        >
                          全プレーを削除
                        </button>
                      ) : null}
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
                    {importMessage ? (
                      <p className="subtle admin-form-full" style={{ whiteSpace: "pre-line" }}>{importMessage}</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="panel inset-panel film-playbook-panel">
                <div className="panel-body">
                  <div className="section-row">
                    <div>
                      <h3 className="section-title">プレーブック画像</h3>
                      <p className="section-copy">
                        隊形とプレー種類の組み合わせに画像を紐づけると、対応するプレーの再生中に自動で表示されます。
                      </p>
                    </div>
                    <div className="chip-row">
                      <span className="chip">{playbookAssets.length}件</span>
                      {!usingRemoteData ? <span className="chip warn">Supabase 接続時に保存</span> : null}
                    </div>
                  </div>

                  <div className="admin-form">
                    <label className="field-stack">
                      <span className="field-label">サイド</span>
                      <select
                        value={playbookForm.side}
                        onChange={(event) => updatePlaybookForm("side", event.target.value as PlaybookSide)}
                        disabled={syncing}
                      >
                        <option value="offense">オフェンス</option>
                        <option value="defense">ディフェンス</option>
                      </select>
                    </label>
                    <label className="field-stack">
                      <span className="field-label">隊形</span>
                      <input
                        list={playbookFormationListId}
                        type="text"
                        value={playbookForm.formation}
                        onChange={(event) => updatePlaybookForm("formation", event.target.value)}
                        disabled={syncing}
                        placeholder="候補から選ぶか自由入力"
                      />
                      <datalist id={playbookFormationListId}>
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
                        list={playbookPlayTypeListId}
                        type="text"
                        value={playbookForm.playType}
                        onChange={(event) => updatePlaybookForm("playType", event.target.value)}
                        disabled={syncing}
                        placeholder="候補から選ぶか自由入力"
                      />
                      <datalist id={playbookPlayTypeListId}>
                        {availablePlayTypes.map((playType) => (
                          <option key={playType} value={playType}>
                            {playType}
                          </option>
                        ))}
                      </datalist>
                    </label>
                    <label className="field-stack">
                      <span className="field-label">タイトル</span>
                      <input
                        type="text"
                        value={playbookForm.title}
                        onChange={(event) => updatePlaybookForm("title", event.target.value)}
                        disabled={syncing}
                        placeholder="未入力なら隊形 / 種類で自動作成"
                      />
                    </label>
                    <div className="field-stack admin-form-full">
                      <span className="field-label">登録方法</span>
                      <div className="film-whiteboard-mode-row">
                        <button
                          className={`button secondary button-compact ${playbookSourceMode === "upload" ? "is-selected" : ""}`}
                          type="button"
                          onClick={() => setPlaybookSourceMode("upload")}
                          disabled={syncing}
                        >
                          画像をアップロード
                        </button>
                        <button
                          className={`button secondary button-compact ${playbookSourceMode === "canvas" ? "is-selected" : ""}`}
                          type="button"
                          onClick={() => setPlaybookSourceMode("canvas")}
                          disabled={syncing}
                        >
                          キャンバスで作成
                        </button>
                      </div>
                    </div>
                    {playbookSourceMode === "upload" ? (
                      <label className="field-stack admin-form-full">
                        <span className="field-label">画像ファイル</span>
                        <input
                          key={playbookInputKey}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={(event) => setPlaybookFile(event.target.files?.[0] ?? null)}
                          disabled={syncing || !usingRemoteData}
                        />
                      </label>
                    ) : (
                      <div className="field-stack admin-form-full">
                        <span className="field-label">プレーブック作成キャンバス</span>
                        {editingPlaybookAsset?.boardState ? (
                          <span className="subtle">同じ隊形とプレー種類の既存プレーブックを読み込んでいます。</span>
                        ) : null}
                        <PlaybookWhiteboard
                          key={`${playbookCanvasBoardId}-${playbookSourceMode}`}
                          ref={playbookCreatorRef}
                          boardId={playbookCanvasBoardId}
                          initialState={playbookCanvasInitialState}
                          title={playbookForm.title.trim() || `${playbookForm.formation || "新規"} / ${playbookForm.playType || "プレー"}`}
                        />
                      </div>
                    )}
                    <div className="card-actions admin-form-full">
                      <button
                        className="button"
                        type="button"
                        onClick={handleSavePlaybookAsset}
                        disabled={syncing || !usingRemoteData}
                      >
                        <Upload aria-hidden="true" />
                        {playbookSourceMode === "canvas" ? "プレーブックを保存" : "画像を登録"}
                      </button>
                    </div>
                  </div>

                  <div className="grid-cards film-playbook-library">
                    {playbookAssets.length ? (
                      playbookAssets.map((asset) => (
                        <article className="doc-card film-playbook-library-card" key={asset.id}>
                          <div className="doc-row">
                            <div>
                              <strong>{asset.title}</strong>
                              <div className="subtle">{asset.formation} / {asset.playType}</div>
                            </div>
                            <button
                              className="button ghost"
                              type="button"
                              onClick={() => handleDeletePlaybookAsset(asset)}
                              disabled={syncing}
                            >
                              <Trash2 aria-hidden="true" />
                              削除
                            </button>
                          </div>
                          <div className="chip-row">
                            <span className="chip">{asset.side === "offense" ? "オフェンス" : "ディフェンス"}</span>
                            <span className="chip">{formatAudienceLabel(asset.audience)}</span>
                            <span className="chip">更新: {asset.updatedAt}</span>
                          </div>
                          {playbookUrls[asset.id] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              className="film-playbook-library-image"
                              src={playbookUrls[asset.id]}
                              alt={`${asset.title} のプレーブック`}
                            />
                          ) : (
                            <div className="film-playbook-library-placeholder">
                              <ImageIcon aria-hidden="true" />
                              <span>プレビューを読み込み中</span>
                            </div>
                          )}
                        </article>
                      ))
                    ) : (
                      <p className="empty-state">まだプレーブック画像がありません。</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <p className="footer-note">
            YouTube側で埋め込みが許可されている限定公開動画を想定しています。埋め込み禁止の動画はURL登録できても再生できない場合があります。
          </p>
        </Section>
        {whiteboardModal}
      </div>
    </div>
  );
}
