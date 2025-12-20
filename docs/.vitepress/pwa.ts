import { resolve } from "path";
import type { PwaOptions } from "@vite-pwa/vitepress";

const appName = "Web Sqlite JS";
const appDescription =
  "Client-side SQLite for the browser: a relational database with persistent storage on the user's device via OPFS.";

export const pwaOptions: PwaOptions = {
  outDir: resolve(__dirname, "dist"),
  registerType: "autoUpdate",
  manifest: {
    id: "/",
    name: appName,
    short_name: "WebSqlite",
    description: appDescription,
    theme_color: "#f7f4ec",
    background_color: "#f7f4ec",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    icons: [
      {
        src: "/pwa-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/pwa-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/pwa-icon-192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/pwa-icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  },
  workbox: {
    globPatterns: [
      "**/*.{js,css,html,ico,png,svg,webp,woff2,ttf,otf,json}",
    ],
    navigateFallback: "index.html",
  },
};
