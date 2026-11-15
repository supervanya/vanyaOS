import { defineConfig } from "vitest/config"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"
import { execSync } from "node:child_process"

// GitHub Pages serves this project site at https://supervanya.github.io/vanyaOS/
// so production assets/routes live under /vanyaOS/. Dev stays at / for the LAN preview.
const PROD_BASE = "/vanyaOS/"

// Short commit SHA of this build, shown on the fatal error screen (index.html)
// so a screenshot says which deploy a device runs. CI sets GITHUB_SHA.
function buildId(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim()
  } catch {
    return "dev"
  }
}

export default defineConfig(({ command }) => ({
  base: command === "build" ? PROD_BASE : "/",
  resolve: { tsconfigPaths: true },
  test: {
    // Node 25+ has its own global localStorage (undefined without a storage
    // file) that hides jsdom's in test workers; turn Node's off.
    execArgv: ["--no-experimental-webstorage"],
    // Tests never talk to Supabase, but importing the client needs these set.
    // Fixed dummies keep tests independent of .env.local (CI has none).
    env: {
      VITE_SUPABASE_URL: "http://127.0.0.1:1",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    },
  },
  // host:true binds 0.0.0.0 so a phone on the same wifi can reach the dev server.
  server: {
    host: true,
    port: 3000,
    allowedHosts: ["supervan.local", "*.lan"],
  },
  // The repo is public: real file names and lines in production stack traces
  // are worth more than hiding the source.
  build: { sourcemap: true },
  plugins: [
    {
      name: "build-id",
      transformIndexHtml: () => [
        { tag: "meta", attrs: { name: "build-id", content: buildId() }, injectTo: "head" },
      ],
    },
    // file-based routing (src/routes) without the TanStack Start server layer
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    viteReact(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // Serve the manifest and service worker in dev too, so the app added to
      // a phone's Home Screen from the LAN preview opens standalone.
      devOptions: { enabled: true },
      includeAssets: ["favicon.ico", "logo192.png", "logo512.png"],
      manifest: {
        name: "VanyaOS — Evening reflection",
        short_name: "VanyaOS",
        description: "Evening reflection — habits, wellbeing, goals.",
        theme_color: "#0b0b0f",
        background_color: "#0b0b0f",
        display: "standalone",
        icons: [
          { src: "logo192.png", sizes: "192x192", type: "image/png" },
          { src: "logo512.png", sizes: "512x512", type: "image/png" },
          {
            src: "logo512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
}))
