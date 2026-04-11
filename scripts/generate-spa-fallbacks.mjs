import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const appFile = path.join(projectRoot, "src", "App.tsx");
const distDir = path.join(projectRoot, "dist");
const indexFile = path.join(distDir, "index.html");
const fallback404File = path.join(distDir, "404.html");

function extractStaticRoutes(source) {
  const routePattern = /<Route\s+path="([^"]+)"/g;
  const routes = new Set();
  let match;

  while ((match = routePattern.exec(source)) !== null) {
    const routePath = match[1];
    if (!routePath || routePath === "*" || routePath === "/" || routePath.includes(":") || routePath.includes("*")) {
      continue;
    }

    routes.add(routePath);
  }

  return [...routes].sort();
}

function ensureStaticFallback(routePath, html) {
  const normalizedRoute = routePath.replace(/^\/+|\/+$/g, "");
  if (!normalizedRoute) return;

  const routeDir = path.join(distDir, normalizedRoute);
  mkdirSync(routeDir, { recursive: true });
  writeFileSync(path.join(routeDir, "index.html"), html);
}

if (!existsSync(indexFile)) {
  throw new Error("dist/index.html nao encontrado. Rode o build do Vite antes de gerar os fallbacks.");
}

const appSource = readFileSync(appFile, "utf8");
const indexHtml = readFileSync(indexFile, "utf8");
const staticRoutes = extractStaticRoutes(appSource);

for (const routePath of staticRoutes) {
  ensureStaticFallback(routePath, indexHtml);
}

cpSync(indexFile, fallback404File);

console.log(`Generated SPA fallbacks for ${staticRoutes.length} routes and dist/404.html`);
