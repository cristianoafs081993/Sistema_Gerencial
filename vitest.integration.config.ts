import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "./vitest.config";

/**
 * Testes de integração: falam com serviços reais (backend/Supabase) e dependem de dados vivos.
 * Ficam fora de `npm test` para manter a suíte rápida e determinística; rode com `npm run test:integration`.
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ["src/**/*.integration.test.{ts,tsx}"],
      exclude: ["node_modules/**"],
      testTimeout: 60_000,
    },
  }),
);
