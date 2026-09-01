import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Studio planner — Média Animation",
    short_name: "Studio planner",
    description: "Planning et attribution de tâches pour les studios de Média Animation asbl.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#612dfa",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
