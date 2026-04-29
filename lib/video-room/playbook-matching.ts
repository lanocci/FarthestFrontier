import type { PlaybookAsset, VideoClip } from "@/lib/types";

export function getMatchingPlaybookAssets(clip: VideoClip | null, playbookAssets: PlaybookAsset[]): PlaybookAsset[] {
  if (!clip) {
    return [];
  }

  const normalizedFormation = clip.formation.trim().toLowerCase();
  const normalizedPlayType = clip.playType.trim().toLowerCase();

  if (!normalizedFormation || !normalizedPlayType) {
    return [];
  }

  return playbookAssets.filter((asset) =>
    asset.formation.trim().toLowerCase() === normalizedFormation &&
    asset.playType.trim().toLowerCase() === normalizedPlayType,
  );
}
