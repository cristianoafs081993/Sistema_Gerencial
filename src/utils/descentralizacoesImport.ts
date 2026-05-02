type DescentralizacaoImportIdentityInput = {
  dateKey: string;
  planoInterno: string;
  origemRecurso: string;
  naturezaDespesa: string;
  valor: number;
  notaCredito?: string;
};

type NormalizeValueOptions = {
  cellType?: string;
  operationType?: string;
  description?: string;
  rawValue: number;
  inferredOrigem?: boolean;
};

const NC_RESUMIDA_REGEX = /(\d{4}NC\d+)/i;
const ANULACAO_DESCENTRALIZACAO = 'ANULACAO DE DESCENTRALIZACAO DE CREDITO';
const DEVOLUCAO = 'DEVOLUCAO';
const NC_CELULA_ORIGEM = 'ORIGEM';
const NC_CELULA_DESTINO = 'DESTINO';

function normalizeImportText(value?: string): string {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

export function summarizeNotaCredito(value?: string): string {
  const normalizedValue = normalizeImportText(value).replace(/\s+/g, '');
  if (!normalizedValue) return '';

  const match = normalizedValue.match(NC_RESUMIDA_REGEX);
  return match?.[1] ?? normalizedValue;
}

export function isAnulacaoDescentralizacao(operationType?: string): boolean {
  return normalizeImportText(operationType).includes(ANULACAO_DESCENTRALIZACAO);
}

export function normalizeDescentralizacaoImportValue({
  cellType,
  operationType,
  description,
  rawValue,
  inferredOrigem = false,
}: NormalizeValueOptions): { shouldImport: boolean; valor: number } {
  const normalizedCellType = normalizeImportText(cellType);
  const absValue = Math.abs(rawValue);

  if (normalizedCellType.includes(NC_CELULA_DESTINO)) {
    return { shouldImport: true, valor: absValue };
  }

  if (normalizedCellType.includes(NC_CELULA_ORIGEM)) {
    return isAnulacaoDescentralizacao(operationType)
      ? { shouldImport: true, valor: -absValue }
      : { shouldImport: false, valor: 0 };
  }

  if (inferredOrigem) {
    return { shouldImport: false, valor: 0 };
  }

  if (isAnulacaoDescentralizacao(operationType) || normalizeImportText(description).includes(DEVOLUCAO)) {
    return { shouldImport: true, valor: -absValue };
  }

  return { shouldImport: true, valor: rawValue };
}

export function shouldImportDescentralizacaoAsNegative({
  operationType,
  description,
}: {
  operationType?: string;
  description?: string;
}): boolean {
  return normalizeDescentralizacaoImportValue({
    operationType,
    description,
    rawValue: 1,
  }).valor < 0;
}

export function createDescentralizacaoImportIdentity({
  dateKey,
  planoInterno,
  origemRecurso,
  naturezaDespesa,
  valor,
  notaCredito,
}: DescentralizacaoImportIdentityInput) {
  const baseKey = `${dateKey}|${planoInterno}|${origemRecurso}|${naturezaDespesa}|${valor}`;
  const rowKey = notaCredito ? `${baseKey}|${notaCredito}` : baseKey;

  return { baseKey, rowKey };
}
