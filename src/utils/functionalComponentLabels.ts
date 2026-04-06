const LEADING_COMPONENT_NUMBER_REGEX = /^\s*\d+\s*-\s*/;
const LEADING_PROEN_COMPONENT_PREFIX_REGEX =
  /^\s*(?:\d+\s*-\s*)?COMPONENTE FUNCIONAL\s*\(\s*PROEN\s*\)\s*:\s*/i;
const ENSINO_ACTIVITY_PREFIX_REGEX =
  /^\s*\d+\s*-\s*COMPONENTE FUNCIONAL\s*\(\s*PROEN\s*\)\s*:\s*/i;

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const isEnsinoDimension = (value?: string | null) => {
  const normalized = normalizeWhitespace(value || '').toUpperCase();
  return normalized === 'EN' || normalized.startsWith('EN -');
};

export const normalizeFunctionalComponentName = (value?: string | null) => {
  const normalized = normalizeWhitespace(value || '');
  if (!normalized) return '';

  return normalized
    .replace(LEADING_PROEN_COMPONENT_PREFIX_REGEX, '')
    .replace(LEADING_COMPONENT_NUMBER_REGEX, '')
    .trim();
};

export const normalizeActivityName = (value?: string | null, dimensao?: string | null) => {
  const normalized = normalizeWhitespace(value || '');
  if (!normalized) return '';

  if (!isEnsinoDimension(dimensao)) {
    return normalized;
  }

  const withoutProenPrefix = normalized.replace(ENSINO_ACTIVITY_PREFIX_REGEX, '').trim();
  const ensinoSegments = withoutProenPrefix
    .split(' - ')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (ensinoSegments.length >= 2) {
    return ensinoSegments[ensinoSegments.length - 1];
  }

  return withoutProenPrefix;
};
