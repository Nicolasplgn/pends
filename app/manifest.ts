import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pends",
    short_name: "Pends",
    description: "Sistema operacional pessoal: pendências, módulos de vida e finanças.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#050811",
    theme_color: "#050811",
    lang: "pt-BR",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
