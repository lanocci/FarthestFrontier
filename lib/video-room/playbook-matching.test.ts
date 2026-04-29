import { getMatchingPlaybookAssets } from "./playbook-matching.js";
import type { PlaybookAsset, VideoClip } from "@/lib/types";

const clip: VideoClip = {
  id: "clip-1",
  title: "Clip",
  startSeconds: 0,
  endSeconds: 10,
  formation: "Zone",
  playType: "Blitz",
  comment: "",
  playerLinks: [],
  focusTargets: [],
  whiteboards: [],
};

const assets: PlaybookAsset[] = [
  {
    id: "defense-match",
    title: "Defense Zone Blitz",
    side: "defense",
    formation: "zone",
    playType: "blitz",
    imagePath: "defense.png",
    audience: "all",
    updatedAt: "2026-04-29",
  },
  {
    id: "offense-miss",
    title: "Offense Zone Run",
    side: "offense",
    formation: "Zone",
    playType: "Run",
    imagePath: "offense.png",
    audience: "all",
    updatedAt: "2026-04-29",
  },
  {
    id: "offense-match",
    title: "Offense Zone Blitz",
    side: "offense",
    formation: "Zone",
    playType: "Blitz",
    imagePath: "offense-match.png",
    audience: "all",
    updatedAt: "2026-04-29",
  },
];

const matches = getMatchingPlaybookAssets(clip, assets);

if (matches.length !== 2 || matches[0]?.id !== "defense-match" || matches[1]?.id !== "offense-match") {
  throw new Error(`Expected defense playbook match, got ${matches.map((asset) => asset.id).join(", ") || "none"}`);
}
