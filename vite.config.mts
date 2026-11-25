import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import type { IncomingMessage, ServerResponse } from "node:http";
import { BadRequest, handleHint } from "./server/hint";
import { makeClaudeGenerator } from "./server/claude";

/** /api/hint при локальном запуске (npm run dev / preview). На Vercel работает api/hint.ts. */
function hintApi(env: Record<string, string>): Plugin {
  const generate = makeClaudeGenerator({ ...process.env, ...env });
  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end('{"error":"method"}');
    }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    try {
      res.end(JSON.stringify(await handleHint(JSON.parse(raw || "{}"), generate)));
    } catch (e) {
      res.statusCode = e instanceof BadRequest || e instanceof SyntaxError ? 400 : 500;
      res.end(JSON.stringify({ error: e instanceof Error ? e.message : "error" }));
    }
  };
  return {
    name: "dalel-hint-api",
    configureServer(server) {
      server.middlewares.use("/api/hint", handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/hint", handler);
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    hintApi(loadEnv(mode, process.cwd(), "")),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Дәлел — реши и докажи",
        short_name: "Дәлел",
        description: "Тренажёр функциональной грамотности для 7–9 классов",
        lang: "kk",
        theme_color: "#0b6e4f",
        background_color: "#f6f4ef",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
}));
