import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * Testes de integração: falam com serviços reais (backend/Supabase) e dependem de dados vivos.
 * Ficam fora de `npm test` para manter a suíte rápida e determinística; rode com `npm run test:integration`.
 * (Configuração própria: `mergeConfig` concatenaria o `include` da configuração base e rodaria tudo.)
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom", // o armazenamento de sessão do app (AsyncStorage web) precisa de localStorage
    globals: true,
    include: ["src/**/*.integration.test.{ts,tsx}"],
    testTimeout: 60_000,
    env: {
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_ANON_KEY: "mock-anon-key",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
