import { defineConfig } from "vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves this project site at https://supervanya.github.io/vanyaOS/
// so production assets/routes live under /vanyaOS/. Dev stays at / for the LAN preview.
const PROD_BASE = "/vanyaOS/";

export default defineConfig(({ command }) => ({
  base: command === "build" ? PROD_BASE : "/",
  resolve: { tsconfigPaths: true },
  // host:true binds 0.0.0.0 so a phone on the same wifi can reach the dev server.
  server: {
    host: true,
    port: 3000,
    allowedHosts: ["supervan.local", "*.lan"],
  },
  plugins: [
    // file-based routing (src/routes) without the TanStack Start server layer
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    viteReact(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
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
}));
