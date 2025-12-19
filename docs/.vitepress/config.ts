import { defineConfig } from "vitepress";
import { resolve } from "path";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Web Sqlite JS",
  description:
    "Client-side SQLite for the browser: a relational database with persistent storage on the user's device via OPFS.",
  vite: {
    resolve: {
      alias: {
        "web-sqlite-js": resolve(__dirname, "../../"),
        "@": resolve(__dirname, "../../src"),
      },
    },
    // Ensure worker is handled correctly if imported from src
    worker: {
      format: "es",
    },
    plugins: [
      {
        name: "configure-response-headers",
        configureServer: (server) => {
          server.middlewares.use((_req, res, next) => {
            res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
            res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
            next();
          });
        },
      },
    ],
    server: {
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      },
    },
  },
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: "Home", link: "/" },
      { text: "Getting Started", link: "/getting-started" },
      { text: "API", link: "/api" },
    ],

    sidebar: [
      {
        text: "Guide",
        items: [{ text: "Getting Started", link: "/getting-started" }],
      },
      {
        text: "Reference",
        items: [{ text: "API", link: "/api" }],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/wuchuheng/web-sqlite-js" },
    ],
  },
});
