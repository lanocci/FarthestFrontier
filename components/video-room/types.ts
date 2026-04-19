import type { VideoAudience, VideoClipPlayerLink } from "@/lib/types";

export type VideoForm = {
  title: string;
  description: string;
  sourceLabel: string;
  matchDate: string;
  audience: VideoAudience;
  youtubeUrl: string;
};

export type ClipForm = {
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
  coachComment: string;
};

export type ImportForm = {
  videoId: string;
  rawText: string;
};

export type ParsedImportRow = Record<string, string>;
