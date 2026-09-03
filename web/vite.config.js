import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "favicon-32.png", "apple-touch-icon.png"],
      // Without this the service worker only exists in production builds, so
      // installability can't be checked with `npm run dev`.
      devOptions: {
        enabled: true,
        type: "module",
      },
      manifest: {
        id: "/",
        name: "Tailor Assistant",
        short_name: "Tailor",
        description: "Backup chat for Usha Quick Stitch sewing machine help",
        lang: "ml",
        dir: "ltr",
        theme_color: "#0E7A68",
        background_color: "#F1ECE4",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        categories: ["utilities", "productivity"],
        shortcuts: [
          {
            name: "Chat",
            short_name: "Chat",
            url: "/chat",
            icons: [{ src: "/pwa-192.png", sizes: "192x192", type: "image/png" }],
          },
        ],
        icons: [
          {
            src: "/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            // Separate art with a safe zone — a plain "any" icon gets its
            // corners cropped by Android's mask.
            src: "/pwa-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // The model is on the splash, so every launch needs it — precaching it
        // makes repeat launches instant and keeps the splash working offline.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,webmanifest,glb}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
  assetsInclude: ["**/*.glb"],
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
