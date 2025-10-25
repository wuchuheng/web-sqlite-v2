import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Web SQLite V2",
  description:
    "Type definitions and runtime guides for the SQLite WASM bundle.",
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: "Overview", link: "/" },
      { text: "Modules", link: "/modules/index" },
      { text: "API Reference", link: "/api/README" },
      { text: "Development", link: "/development/testing" },
      { text: "History", link: "/history" },
    ],
    sidebar: {
      "/": [
        {
          text: "Overview",
          items: [{ text: "Project Summary", link: "/" }],
        },
      ],
      "/modules/": [
        {
          text: "Runtime Modules",
          items: [
            { text: "Portfolio", link: "/modules/index" },
            { text: "Runtime Lifecycle", link: "/modules/runtime" },
            { text: "OPFS Persistence", link: "/modules/opfs" },
            { text: "Worker Integration", link: "/modules/worker" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API Reference",
          items: [
            { text: "Overview", link: "/api/README" },
            { text: "C-Style API", link: "/api/c-style-api" },
            { text: "OO1 API", link: "/api/oo1-api" },
            { text: "Worker API", link: "/api/worker-api" },
            { text: "WASM Utilities", link: "/api/wasm-utilities" },
          ],
        },
      ],
      "/development/": [
        {
          text: "Development",
          items: [
            { text: "Testing Harness", link: "/development/testing" },
            { text: "Workspace Scripts", link: "/development/workspace" },
          ],
        },
      ],
      "/history": [
        {
          text: "Repository History",
          items: [{ text: "Milestones", link: "/history" }],
        },
      ],
    },
  },
});
