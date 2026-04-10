type DescentralizacaoImportIdentityInput = {
  dateKey: string;
  planoInterno: string;
  origemRecurso: string;
  naturezaDespesa: string;
  valor: number;
  notaCredito?: string;
};

type NegativeValueOptions = {
  operationType?: string;
  description?: string;
};

const NC_RESUMIDA_REGEX = /(\d{4}NC\d+)/i;
const ANULACAO_DESCENTRALIZACAO = 'ANULACAO DE DESCENTRALIZACAO DE CREDITO';
const DEVOLUCAO = 'DEVOLUCAO';

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

export function shouldImportDescentralizacaoAsNegative({
  operationType,
  description,
}: NegativeValueOptions): boolean {
  const normalizedOperationType = normalizeImportText(operationType);
  if (normalizedOperationType.includes(ANULACAO_DESCENTRALIZACAO)) {
    return true;
  }

  return normalizeImportText(description).includes(DEVOLUCAO);
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
