export type PortalEmpenhoCacheStage = 'rap' | 'exercicio';

export type PortalEmpenhoBalanceRow = {
  tipo?: string | null;
  valor?: number | string | null;
  valor_liquidado_a_pagar?: number | string | null;
  valor_pago_oficial?: number | string | null;
  saldo_rap_oficial?: number | string | null;
  rap_a_liquidar?: number | string | null;
  rap_inscrito?: number | string | null;
  rap_pago?: number | string | null;
};

const toNumber = (value: unknown) => {
  if (value == null || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNullableNumber = (value: unknown) => {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

export const matchesPortalEmpenhoCacheStage = (
  row: Pick<PortalEmpenhoBalanceRow, 'tipo'>,
  stage: PortalEmpenhoCacheStage,
) => stage === 'rap' ? row.tipo === 'rap' : row.tipo == null || row.tipo === '' || row.tipo === 'exercicio';

/** Mirrors fn_empenho_saldo_disponivel so cache discovery never skips an active NE. */
export const getPortalEmpenhoAvailableBalance = (row: PortalEmpenhoBalanceRow) => {
  if (row.tipo === 'rap') {
    const officialRapBalance = toNullableNumber(row.saldo_rap_oficial);
    if (officialRapBalance != null) return Math.max(0, officialRapBalance);

    const rapBase = row.rap_a_liquidar ?? row.rap_inscrito ?? row.valor;
    return Math.max(0, toNumber(rapBase) - toNumber(row.rap_pago));
  }

  return Math.max(
    0,
    toNumber(row.valor) - toNumber(row.valor_liquidado_a_pagar) - toNumber(row.valor_pago_oficial),
  );
};

export const DEFAULT_UASG = '158366';

export const PROCESSO_PREFIX_TO_UASG: Record<string, string> = {
  '23035': '158366', // Currais Novos
  '23421': '158155', // Reitoria
  '23134': '158369', // Natal Central
  '23057': '158368', // Natal Zona Norte
  '23133': '152711', // Natal Cidade Alta
  '23135': '158365', // Mossoró
  '23136': '158371', // Apodi
  '23137': '158367', // Ipanguaçu
  '23138': '158373', // João Câmara
  '23139': '158374', // Pau dos Ferros
  '23036': '158375', // Macau
  '23038': '158370', // Caicó
  '23039': '152756', // Parnamirim
  '23040': '154840', // São Paulo do Potengi
  '23041': '152757', // Nova Cruz
  '23042': '158372', // Santa Cruz
  '23044': '154839', // Canguaretama
  '23045': '154838', // Ceará-Mirim
  '23046': '154582', // São Gonçalo do Amarante
};

export const extractUasgFromProcesso = (processo?: string | null): string | null => {
  if (!processo) return null;
  const digits = String(processo).replace(/\D/g, '');
  const prefix = digits.slice(0, 5);
  return PROCESSO_PREFIX_TO_UASG[prefix] || null;
};

export const extractUasgFromDescricao = (descricao?: string | null): string | null => {
  if (!descricao) return null;
  const match = String(descricao).match(/\b(?:UASG\s*(?:MINUTA)?|UG)\s*:?\s*(15\d{4})\b/i);
  return match?.[1] || null;
};

