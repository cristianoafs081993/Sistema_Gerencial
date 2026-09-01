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
  '2335': '158366', // Currais Novos (prefixo sem zero)
  '23421': '158155', // Reitoria
  '23422': '158155', // Reitoria
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

export const CAMPUS_NAME_TO_UASG: Record<string, string> = {
  'CURRAIS NOVOS': '158366',
  'REITORIA': '158155',
  'NATAL CENTRAL': '158369',
  'NATAL-CENTRAL': '158369',
  'ZONA NORTE': '158368',
  'CIDADE ALTA': '152711',
  'MOSSORO': '158365',
  'APODI': '158371',
  'IPANGUACU': '158367',
  'JOAO CAMARA': '158373',
  'PAU DOS FERROS': '158374',
  'MACAU': '158375',
  'CAICO': '158370',
  'PARNAMIRIM': '152756',
  'SAO PAULO DO POTENGI': '154840',
  'NOVA CRUZ': '152757',
  'SANTA CRUZ': '158372',
  'CANGUARETAMA': '154839',
  'CEARA-MIRIM': '154838',
  'CEARA MIRIM': '154838',
  'SAO GONCALO DO AMARANTE': '154582',
};

export const extractUasgFromProcesso = (processo?: string | null): string | null => {
  if (!processo) return null;
  const digits = String(processo).replace(/\D/g, '');
  if (!digits) return null;
  const prefix5 = digits.slice(0, 5);
  if (PROCESSO_PREFIX_TO_UASG[prefix5]) return PROCESSO_PREFIX_TO_UASG[prefix5];
  const prefix4 = digits.slice(0, 4);
  if (PROCESSO_PREFIX_TO_UASG[prefix4]) return PROCESSO_PREFIX_TO_UASG[prefix4];
  return null;
};

const normalizeTextForUasg = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

export const extractUasgFromDescricao = (descricao?: string | null): string | null => {
  if (!descricao) return null;
  const normalized = normalizeTextForUasg(descricao);

  // 1. Explicit UASG / UG code (ex: UASG: 158366 ou UG 158155)
  const match = normalized.match(/\b(?:UASG\s*(?:MINUTA)?|UG)\s*:?\s*(15\d{4})\b/i);
  if (match?.[1]) return match[1];

  // 2. Direct 6-digit UG match in formatted context like 15836605000282023
  const directMatch = normalized.match(/\b(15\d{4})\d{11}\b/);
  if (directMatch?.[1]) return directMatch[1];

  // 3. Match campus name in description
  for (const [campusName, uasg] of Object.entries(CAMPUS_NAME_TO_UASG)) {
    if (normalized.includes(campusName)) {
      return uasg;
    }
  }

  return null;
};


