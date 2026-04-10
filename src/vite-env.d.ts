/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_FEATURE_MODULO_ATAS?: string;
  readonly VITE_ATAS_SOURCE_NAME?: string;
  readonly VITE_ATAS_SOURCE_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
