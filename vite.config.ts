import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      injectRegister: "script-defer",
      registerType: "prompt",
      manifest: {
        id: "/",
        name: "Sonic Pulse",
        short_name: "Sonic Pulse",
        description:
          "Find your rhythm with an endless pulse generator that works offline.",
        lang: "en",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#10091c",
        theme_color: "#10091c",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Include the audio worklet and fonts, even before audio is first played.
        globPatterns: ["**/*.{js,css,html,woff2,png,svg,webmanifest}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Let updates wait until all windows close; never reload during playback.
        skipWaiting: false,
        navigateFallback: "/index.html",
      },
    }),
  ],
  worker: { format: "es" },
  test: { include: ["src/**/*.test.ts"] },
});
