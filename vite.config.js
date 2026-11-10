import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      // Updates wait for the app to close, rather than interrupting a session.
      registerType: "prompt",
      injectRegister: null,
      includeAssets: ["icon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "Drift · bedtime scenes",
        short_name: "Drift",
        description: "Spoken scenes and quiet pauses, saved for offline listening.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#0c1012",
        theme_color: "#0c1012",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{html,js,css,json}"],
        // Each bundled voice is larger than Workbox's default 2 MiB limit.
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
      },
    }),
  ],
});
