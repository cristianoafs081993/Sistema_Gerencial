import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

function getPackageName(id: string) {
  const normalizedId = id.replace(/\\/g, "/");
  if (!normalizedId.includes("/node_modules/")) return undefined;

  const packagePath = normalizedId.split("/node_modules/")[1];
  if (!packagePath) return undefined;

  const segments = packagePath.split("/");
  if (segments[0]?.startsWith("@")) {
    return `${segments[0]}/${segments[1]}`;
  }

  return segments[0];
}

function isPackage(packageName: string, candidates: string[]) {
  return candidates.includes(packageName);
}

function getManualChunk(id: string) {
  const packageName = getPackageName(id);
  if (!packageName) return undefined;

  if (isPackage(packageName, ["react", "react-dom", "scheduler"])) {
    return "react-vendor";
  }

  if (packageName.startsWith("@radix-ui/") || packageName === "vaul") {
    return "react-vendor";
  }

  if (
    packageName.startsWith("@tiptap/") ||
    packageName.startsWith("prosemirror-")
  ) {
    return "react-vendor";
  }

  if (
    isPackage(packageName, ["react-markdown", "remark-gfm"]) ||
    packageName.startsWith("mdast-") ||
    packageName.startsWith("micromark") ||
    packageName.startsWith("hast-") ||
    packageName.startsWith("unist-") ||
    packageName.startsWith("vfile") ||
    packageName.startsWith("remark-") ||
    packageName.startsWith("rehype-")
  ) {
    return "react-vendor";
  }

  if (
    packageName === "recharts" ||
    packageName.startsWith("d3-") ||
    packageName === "react-smooth" ||
    packageName === "embla-carousel-react"
  ) {
    return "react-vendor";
  }

  if (packageName.startsWith("@supabase/") || packageName === "postgres") {
    return "supabase-vendor";
  }

  if (
    packageName.startsWith("@tanstack/") ||
    isPackage(packageName, ["react-router", "react-router-dom", "@remix-run/router"])
  ) {
    return "data-router-vendor";
  }

  if (isPackage(packageName, ["framer-motion", "motion-dom", "motion-utils"])) {
    return "motion-vendor";
  }

  if (isPackage(packageName, ["pdfjs-dist", "xlsx", "date-fns"])) {
    return `${packageName}-vendor`;
  }

  return undefined;
}

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
      '/api-contratos': {
        target: 'https://contratos.comprasnet.gov.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-contratos/, ''),
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
        manualChunks: getManualChunk,
      },
    },
  },
}));
