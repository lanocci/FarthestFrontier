import { buildVideoRoomUrl } from "./utils.js";

const clipUrl = buildVideoRoomUrl("/videos", "video-1", "clip-1");

if (clipUrl !== "/videos?clip=clip-1") {
  throw new Error(`Expected clip-only URL, got ${clipUrl}`);
}

const videoUrl = buildVideoRoomUrl("/videos", "video-1");

if (videoUrl !== "/videos?video=video-1") {
  throw new Error(`Expected video URL, got ${videoUrl}`);
}
