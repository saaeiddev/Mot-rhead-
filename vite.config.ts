import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  server: { allowedHosts: ["terminal.local"] },
  base: "/Mot-rhead-/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png"],
      manifest: {
        id: "/Mot-rhead-/",
        name: "MOT-RHEAD — Own The Noise",
        short_name: "MOT-RHEAD",
        description:
          "Your music. Your movement. A local-first sound laboratory.",
        theme_color: "#101010",
        background_color: "#101010",
        display: "standalone",
        start_url: "/Mot-rhead-/",
        scope: "/Mot-rhead-/",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,webp,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 3000000,
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/\/assets\//],
      },
    }),
  ],
});
