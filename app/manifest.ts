import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FFFC 2025",
    short_name: "FFFC",
    description: "Flag football team goals and shared materials hub.",
    start_url: "/videos",
    display: "standalone",
    background_color: "#070d18",
    theme_color: "#070d18",
    orientation: "landscape",
  };
}
