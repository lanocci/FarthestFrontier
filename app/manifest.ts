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
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
