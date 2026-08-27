import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons.svg"],
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
          },
          {
            src: "/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // App-shell only — do not precache the large .glb model.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,webmanifest}"],
        globIgnores: ["**/models/**"],
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
  // 59MB GLB — raise limit so Vite doesn't warn endlessly during assets copy.
  assetsInclude: ["**/*.glb"],
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
