const cleanWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalizeHeader = (value: unknown) =>
  cleanWhitespace(String(value ?? ''))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export type ContratosImportReportKind = 'active_contracts' | 'links_and_values';

const IGNORED_LEGACY_CONTRATOS = new Set([
  '00089/2016',
]);

export const normalizeContratoNumero = (raw: unknown): string => {
  const value = cleanWhitespace(String(raw ?? ''));
  if (!value) return '';

  const match = value.match(/(\d{1,5})\s*\/\s*(\d{4})/);
  if (match) {
    const [, numero, ano] = match;
    return `${numero.padStart(5, '0')}/${ano}`;
  }

  return value.replace(/\s+/g, '');
};

export const shouldIgnoreContratoNumero = (raw: unknown): boolean =>
  IGNORED_LEGACY_CONTRATOS.has(normalizeContratoNumero(raw));

export const normalizeCnpj = (raw: unknown): string | undefined => {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return digits || undefined;
};

export const extractContractParty = (raw: unknown) => {
  const source = cleanWhitespace(String(raw ?? ''));
  if (!source) {
    return { contratada: '', cnpj: undefined as string | undefined };
  }

  const withoutPersonType = source.replace(/\s*\((?:Pessoa\s+[^)]+)\)\s*$/iu, '').trim();
  const match = withoutPersonType.match(/^(.*?)(?:\s*\((\d{11,14})\))\s*$/);

  if (!match) {
    return {
      contratada: cleanWhitespace(withoutPersonType),
      cnpj: undefined,
    };
  }

  const [, contratada, cnpj] = match;
  return {
    contratada: cleanWhitespace(contratada),
    cnpj: normalizeCnpj(cnpj),
  };
};

export const buildEmpenhoLookupKeys = (raw: unknown): string[] => {
  const trimmed = cleanWhitespace(String(raw ?? '')).toUpperCase();
  if (!trimmed) return [];

  const keys = new Set<string>();
  const normalized = trimmed.replace(/[^A-Z0-9]/g, '');

  keys.add(trimmed);
  if (normalized) {
    keys.add(normalized);
  }

  const resumido = normalized.match(/\d{4}NE\d+/i)?.[0];
  if (resumido) {
    keys.add(resumido);
  }

  if (normalized.length >= 12) {
    keys.add(normalized.slice(-12));
  }

  return Array.from(keys);
};

export const detectContratosImportReportKind = (
  rows: Array<Record<string, unknown>>,
): ContratosImportReportKind | null => {
  const headerTokens = new Set(
    rows
      .slice(0, 5)
      .flatMap((row) => Object.keys(row))
      .map((header) => normalizeHeader(header))
      .filter(Boolean),
  );

  const hasHeader = (...headers: string[]) =>
    headers.some((header) => headerTokens.has(normalizeHeader(header)));
  const hasHeaderMatching = (pattern: RegExp) =>
    Array.from(headerTokens).some((header) => pattern.test(header));

  if (
    hasHeader('Numero', 'Número') &&
    hasHeader('Contratada') &&
    hasHeader('Data de Inicio', 'Data de Início') &&
    hasHeader('Data de Termino', 'Data de Término')
  ) {
    return 'active_contracts';
  }

  if (
    hasHeader('Contrato', 'Número do Contrato') &&
    hasHeaderMatching(/\bempenho\b/i) &&
    hasHeader('Valor', 'Valor (R$)')
  ) {
    return 'links_and_values';
  }

  return null;
};
