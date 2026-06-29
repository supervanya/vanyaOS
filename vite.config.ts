import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  // host:true binds 0.0.0.0 so a phone on the same wifi can reach the dev server.
  server: {
    host: true,
    port: 3000,
    allowedHosts: ["supervan.local", "*.lan"],
  },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    // SPA mode: no SSR. The app is localStorage-driven (browser-only) for now.
    tanstackStart({ spa: { enabled: true } }),
    viteReact(),
  ],
});

export default config;
