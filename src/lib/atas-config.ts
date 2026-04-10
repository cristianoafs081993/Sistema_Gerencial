const parseBooleanEnv = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;

  return fallback;
};

export const atasModuleConfig = {
  enabled: parseBooleanEnv(import.meta.env.VITE_FEATURE_MODULO_ATAS, true),
  featureFlag: 'VITE_FEATURE_MODULO_ATAS',
  sourceName: import.meta.env.VITE_ATAS_SOURCE_NAME?.trim() || 'Fonte oficial a definir',
  sourceBaseUrl: import.meta.env.VITE_ATAS_SOURCE_BASE_URL?.trim() || '',
  defaultResultLimit: 5,
} as const;
