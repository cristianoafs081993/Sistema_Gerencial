import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api-transparencia': {
        target: 'https://api.portaldatransparencia.gov.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-transparencia/, ''),
      },
    },
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (
            id.includes("react") ||
            id.includes("scheduler") ||
            id.includes("react-dom") ||
            id.includes("react-router")
          ) {
            return "react-core";
          }

          if (id.includes("@supabase") || id.includes("postgres")) {
            return "data-access";
          }

          if (
            id.includes("@radix-ui") ||
            id.includes("class-variance-authority") ||
            id.includes("clsx") ||
            id.includes("tailwind-merge") ||
            id.includes("cmdk") ||
            id.includes("vaul")
          ) {
            return "ui-kit";
          }

          if (
            id.includes("@tanstack") ||
            id.includes("zod") ||
            id.includes("react-hook-form") ||
            id.includes("@hookform")
          ) {
            return "forms-query";
          }

          if (
            id.includes("recharts") ||
            id.includes("embla-carousel-react") ||
            id.includes("framer-motion")
          ) {
            return "visuals";
          }

          if (id.includes("xlsx") || id.includes("date-fns")) {
            return "document-tools";
          }

          return "vendor";
        },
      },
    },
  },
}));
