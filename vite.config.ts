import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt", "remorque-logo.svg", "placeholder.svg"],
      manifest: {
        name: "Gaz Maroc",
        short_name: "GazMaroc",
        description: "Système de distribution de gaz",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#0f172a",
        background_color: "#ffffff",
        icons: [
          { src: "/remorque-logo.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
          { src: "/placeholder.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
          { src: "/favicon.ico", sizes: "64x64 32x32 24x24 16x16", type: "image/x-icon" }
        ],
      },
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
