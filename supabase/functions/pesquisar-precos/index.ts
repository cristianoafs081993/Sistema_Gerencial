import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const COMPRAS_API_BASE = 'https://dadosabertos.compras.gov.br';
const DEFAULT_LIMIT = 100;
const MAX_ITEMS = 25;
const MAX_CANDIDATES_FOR_AI = 100;
const REQUEST_TIMEOUT_MS = 60000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SearchItem = {
  localId: string;
  itemNumber: string;
  description: string;
  catalogType: 'material' | 'service';
  catalogCode: string;
  quantity: number;
  unit: string;
  targetCapacity: number | null;
  targetMeasureUnit: string | null;
};

type PriceApiRow = Record<string, unknown>;

type PriceResearchBooleanFilter = '' | 'yes' | 'no';

type SearchFilters = {
  description?: string;
  catalogCode?: string;
  startDate?: string;
  endDate?: string;
  purchaseNumber?: string;
  uasg?: string;
  agencyName?: string;
  supplierDocument?: string;
  quantityMin?: number | null;
  quantityMax?: number | null;
  unit?: string;
  state?: string;
  region?: string;
  modality?: string;
  brand?: string;
  srp?: PriceResearchBooleanFilter;
  meEpp?: PriceResearchBooleanFilter;
  sustainable?: PriceResearchBooleanFilter;
  adjudicationStartDate?: string;
  adjudicationEndDate?: string;
  homologationStartDate?: string;
  homologationEndDate?: string;
  rawDataText?: string;
};

type SearchRequest = {
  items?: SearchItem[];
  limit?: number;
  filters?: SearchFilters;
};

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type RankedCandidate = {
  id: string;
  sourceType: 'compras_gov_precos';
  sourceLabel: string;
  sourceUrl: string;
  pncpSearchUrl: string;
  purchaseId: string;
  purchaseItemId: string;
  purchaseDate: string | null;
  resultDate: string | null;
  supplierDocument: string | null;
  supplierName: string | null;
  agencyCode: string | null;
  agencyName: string | null;
  state: string | null;
  municipality: string | null;
  description: string;
  detailedDescription: string | null;
  brand: string | null;
  quantity: number | null;
  originalUnitPrice: number;
  comparableUnitPrice: number;
  originalUnitLabel: string;
  unitCompatible: boolean;
  aiScore: number;
  aiReason: string;
  selected: boolean;
  exclusionReason: string;
  rawData: PriceApiRow;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`A variável ${name} precisa estar configurada.`);
  return value;
}

function textOrNull(value: unknown) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: unknown) {
  return new Set(
    normalizeText(value)
      .split(' ')
      .filter((token) => token.length > 2),
  );
}
const REGION_BY_UF: Record<string, string> = {
  AC: 'Norte', AP: 'Norte', AM: 'Norte', PA: 'Norte', RO: 'Norte', RR: 'Norte', TO: 'Norte',
  AL: 'Nordeste', BA: 'Nordeste', CE: 'Nordeste', MA: 'Nordeste', PB: 'Nordeste', PE: 'Nordeste', PI: 'Nordeste', RN: 'Nordeste', SE: 'Nordeste',
  DF: 'Centro-Oeste', GO: 'Centro-Oeste', MT: 'Centro-Oeste', MS: 'Centro-Oeste',
  ES: 'Sudeste', MG: 'Sudeste', RJ: 'Sudeste', SP: 'Sudeste',
  PR: 'Sul', RS: 'Sul', SC: 'Sul',
};

function normalizeDigits(value: unknown) {
  return String(value ?? '').replace(/\D/g, '');
}

function normalizeUasg(value: unknown) {
  return normalizeDigits(value).slice(0, 6);
}

function hasFilters(filters?: SearchFilters | null) {
  if (!filters) return false;
  return Object.values(filters).some((value) => {
    if (value === null || value === undefined || value === '') return false;
    if (typeof value === 'number') return Number.isFinite(value);
    return true;
  });
}

function normalizeFilters(filters?: SearchFilters | null): SearchFilters {
  if (!filters || typeof filters !== 'object') return {};
  const date = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) ? String(value) : undefined;
  const booleanFilter = (value: unknown): PriceResearchBooleanFilter => value === 'yes' || value === 'no' ? value : '';
  const numberFilter = (value: unknown) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  return {
    description: textOrNull(filters.description) ?? undefined,
    catalogCode: normalizeDigits(filters.catalogCode) || undefined,
    startDate: date(filters.startDate),
    endDate: date(filters.endDate),
    purchaseNumber: textOrNull(filters.purchaseNumber) ?? undefined,
    uasg: normalizeUasg(filters.uasg) || undefined,
    agencyName: textOrNull(filters.agencyName) ?? undefined,
    supplierDocument: normalizeDigits(filters.supplierDocument) || undefined,
    quantityMin: numberFilter(filters.quantityMin),
    quantityMax: numberFilter(filters.quantityMax),
    unit: textOrNull(filters.unit) ?? undefined,
    state: textOrNull(filters.state)?.toUpperCase() ?? undefined,
    region: textOrNull(filters.region) ?? undefined,
    modality: textOrNull(filters.modality) ?? undefined,
    brand: textOrNull(filters.brand) ?? undefined,
    srp: booleanFilter(filters.srp),
    meEpp: booleanFilter(filters.meEpp),
    sustainable: booleanFilter(filters.sustainable),
    adjudicationStartDate: date(filters.adjudicationStartDate),
    adjudicationEndDate: date(filters.adjudicationEndDate),
    homologationStartDate: date(filters.homologationStartDate),
    homologationEndDate: date(filters.homologationEndDate),
    rawDataText: textOrNull(filters.rawDataText) ?? undefined,
  };
}

function rawValueByKeys(rawData: PriceApiRow | null | undefined, keys: string[]) {
  if (!rawData || typeof rawData !== 'object') return undefined;
  const normalizedKeys = new Set(keys.map((key) => normalizeText(key).replace(/\s/g, '')));
  const stack: unknown[] = [rawData];
  while (stack.length > 0) {
    const current = stack.shift();
    if (!current || typeof current !== 'object') continue;
    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      const normalizedKey = normalizeText(key).replace(/\s/g, '');
      if (normalizedKeys.has(normalizedKey)) return value;
      if (value && typeof value === 'object') stack.push(value);
    }
  }
  return undefined;
}

function stringFromRaw(rawData: PriceApiRow | null | undefined, keys: string[]) {
  const value = rawValueByKeys(rawData, keys);
  if (value === null || value === undefined) return '';
  return String(value);
}

function dateFromRaw(rawData: PriceApiRow | null | undefined, keys: string[]) {
  const value = stringFromRaw(rawData, keys).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '';
}

function booleanFromRaw(rawData: PriceApiRow | null | undefined, keys: string[], positiveHints: string[], negativeHints: string[] = []) {
  const value = rawValueByKeys(rawData, keys);
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
  const normalized = normalizeText(value);
  if (['s', 'sim', 'true', '1'].includes(normalized)) return true;
  if (['n', 'nao', 'false', '0'].includes(normalized)) return false;
  if (positiveHints.some((hint) => normalized.includes(hint))) return true;
  if (negativeHints.some((hint) => normalized.includes(hint))) return false;
  return null;
}

function parseCandidatePurchaseInfo(candidate: Pick<RankedCandidate, 'purchaseId' | 'rawData'>) {
  const digits = normalizeDigits(candidate.purchaseId);
  const rawNumber = stringFromRaw(candidate.rawData, ['numeroCompra', 'numero_compra', 'numeroPregao', 'numero_pregao', 'compra']);
  const rawYear = stringFromRaw(candidate.rawData, ['anoCompra', 'ano_compra', 'ano']);
  const rawModality = stringFromRaw(candidate.rawData, ['modalidadeCompra', 'modalidade', 'nomeModalidadeCompra', 'codigoModalidadeCompra']);
  let uasg = normalizeUasg(stringFromRaw(candidate.rawData, ['codigoUasg', 'uasg', 'codigo_uasg']));
  let modalityCode = normalizeDigits(rawModality);
  let number = normalizeDigits(rawNumber);
  let year = normalizeDigits(rawYear).slice(0, 4);
  if (!uasg && digits.length >= 6) uasg = digits.slice(0, 6);
  if (!modalityCode && digits.length >= 8) modalityCode = digits.slice(6, 8);
  if (!number && digits.length >= 13) number = digits.slice(8, 13).replace(/^0+/, '') || digits.slice(8, 13);
  if (!year && digits.length >= 17) year = digits.slice(13, 17);
  if (!year && digits.length >= 15) year = digits.slice(11, 15);
  const modalityLabel = rawModality || (() => {
    const code = modalityCode.replace(/^0+/, '');
    if (code === '5') return 'Pregão';
    if (code === '6') return 'Dispensa';
    if (code === '7') return 'Inexigibilidade';
    return modalityCode;
  })();
  return { uasg, number, year, modalityCode, modalityLabel };
}

function candidateBooleanFlag(candidate: RankedCandidate, flag: 'srp' | 'meEpp' | 'sustainable') {
  if (flag === 'srp') {
    return booleanFromRaw(candidate.rawData, ['compraSrp', 'srp', 'sistemaRegistroPrecos', 'registroPreco', 'registroPrecos', 'indicadorSrp'], ['srp', 'registro de preco', 'registro de precos']);
  }
  if (flag === 'meEpp') {
    return booleanFromRaw(candidate.rawData, ['porteFornecedor', 'tipoFornecedor', 'fornecedorPorte', 'indicadorMeEpp', 'microEmpresa', 'microempresa', 'epp'], ['me/epp', 'microempresa', 'empresa de pequeno porte', 'pequeno porte', 'me epp'], ['demais', 'nao']);
  }
  return booleanFromRaw(candidate.rawData, ['itemSustentavel', 'sustentavel', 'criterioSustentabilidade', 'possuiCriterioSustentabilidade'], ['sustentavel', 'sustentabilidade']);
}

function matchesDateRange(value: string | null | undefined, start?: string, end?: string) {
  const normalized = value?.slice(0, 10) || '';
  if (!normalized) return !start && !end;
  if (start && normalized < start) return false;
  if (end && normalized > end) return false;
  return true;
}

function matchesBooleanFilter(value: boolean | null, filter?: PriceResearchBooleanFilter) {
  if (!filter) return true;
  if (value === null) return false;
  return filter === 'yes' ? value === true : value === false;
}

function candidateMatchesFilters(candidate: RankedCandidate, filters: SearchFilters) {
  if (!hasFilters(filters)) return true;
  const purchaseInfo = parseCandidatePurchaseInfo(candidate);
  const rawText = normalizeText(JSON.stringify(candidate.rawData ?? {}));
  const candidateText = normalizeText([
    candidate.description,
    candidate.detailedDescription,
    candidate.agencyName,
    candidate.supplierName,
    candidate.brand,
    candidate.purchaseId,
    candidate.purchaseItemId,
    rawText,
  ].join(' '));
  if (filters.description && !candidateText.includes(normalizeText(filters.description))) return false;
  if (filters.catalogCode) {
    const rawCatalogCode = stringFromRaw(candidate.rawData, ['codigoItemCatalogo', 'codigoCatalogo', 'codigoItem', 'catmat', 'catser']);
    if (!normalizeDigits(rawCatalogCode).includes(normalizeDigits(filters.catalogCode))) return false;
  }
  if (!matchesDateRange(candidate.resultDate || candidate.purchaseDate, filters.startDate, filters.endDate)) return false;
  if (filters.purchaseNumber) {
    const wanted = normalizeDigits(filters.purchaseNumber);
    const haystack = normalizeDigits([purchaseInfo.number, purchaseInfo.year, candidate.purchaseId].join(' '));
    if (!haystack.includes(wanted)) return false;
  }
  if (filters.uasg && normalizeUasg(candidate.agencyCode ?? purchaseInfo.uasg) !== normalizeUasg(filters.uasg)) return false;
  if (filters.agencyName && !normalizeText(candidate.agencyName).includes(normalizeText(filters.agencyName))) return false;
  if (filters.supplierDocument && !normalizeDigits(candidate.supplierDocument).includes(normalizeDigits(filters.supplierDocument))) return false;
  if (Number.isFinite(filters.quantityMin ?? NaN) && (candidate.quantity ?? 0) < Number(filters.quantityMin)) return false;
  if (Number.isFinite(filters.quantityMax ?? NaN) && (candidate.quantity ?? 0) > Number(filters.quantityMax)) return false;
  if (filters.unit && !normalizeMeasure(candidate.originalUnitLabel).includes(normalizeMeasure(filters.unit))) return false;
  if (filters.state && String(candidate.state ?? '').toUpperCase() !== filters.state) return false;
  if (filters.region && REGION_BY_UF[String(candidate.state ?? '').toUpperCase()] !== filters.region) return false;
  if (filters.modality) {
    const modalityText = normalizeText([purchaseInfo.modalityCode, purchaseInfo.modalityLabel].join(' '));
    if (!modalityText.includes(normalizeText(filters.modality))) return false;
  }
  if (filters.brand && !normalizeText(candidate.brand).includes(normalizeText(filters.brand))) return false;
  if (!matchesBooleanFilter(candidateBooleanFlag(candidate, 'srp'), filters.srp)) return false;
  if (!matchesBooleanFilter(candidateBooleanFlag(candidate, 'meEpp'), filters.meEpp)) return false;
  if (!matchesBooleanFilter(candidateBooleanFlag(candidate, 'sustainable'), filters.sustainable)) return false;
  if (!matchesDateRange(dateFromRaw(candidate.rawData, ['dataAdjudicacao', 'data_adjudicacao', 'adjudicacao']), filters.adjudicationStartDate, filters.adjudicationEndDate)) return false;
  if (!matchesDateRange(dateFromRaw(candidate.rawData, ['dataHomologacao', 'data_homologacao', 'homologacao']), filters.homologationStartDate, filters.homologationEndDate)) return false;
  if (filters.rawDataText && !rawText.includes(normalizeText(filters.rawDataText))) return false;
  return true;
}

function textSimilarity(left: unknown, right: unknown) {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let intersection = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) intersection += 1;
  });
  return intersection / new Set([...leftTokens, ...rightTokens]).size;
}

function normalizeMeasure(value: unknown) {
  const normalized = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const aliases: Record<string, string> = {
    G: 'G',
    GR: 'G',
    GRAMA: 'G',
    GRAMAS: 'G',
    KG: 'KG',
    QUILO: 'KG',
    QUILOGRAMA: 'KG',
    QUILOGRAMAS: 'KG',
    ML: 'ML',
    MILILITRO: 'ML',
    MILILITROS: 'ML',
    L: 'L',
    LT: 'L',
    LITRO: 'L',
    LITROS: 'L',
    UN: 'UN',
    UND: 'UN',
    UNID: 'UN',
    UNIDADE: 'UN',
    UNIDADES: 'UN',
    H: 'H',
    HR: 'H',
    HORA: 'H',
    HORAS: 'H',
    PCT: 'PCT',
    PACOTE: 'PCT',
    PACOTES: 'PCT',
    CX: 'CX',
    CAIXA: 'CX',
    CAIXAS: 'CX',
    MES: 'MES',
    MESES: 'MES',
  };
  return aliases[normalized] ?? normalized;
}

function measureScale(unit: string) {
  if (unit === 'G') return { dimension: 'mass', scale: 0.001 };
  if (unit === 'KG') return { dimension: 'mass', scale: 1 };
  if (unit === 'ML') return { dimension: 'volume', scale: 0.001 };
  if (unit === 'L') return { dimension: 'volume', scale: 1 };
  if (unit === 'UN') return { dimension: 'count', scale: 1 };
  if (unit === 'H') return { dimension: 'time', scale: 1 };
  return null;
}

function comparablePrice(item: SearchItem, row: PriceApiRow) {
  const originalPrice = numberOrNull(row.precoUnitario) ?? 0;
  const sourceCapacity = numberOrNull(row.capacidadeUnidadeFornecimento) ?? 1;
  const sourceMeasure = normalizeMeasure(row.siglaUnidadeMedida || row.nomeUnidadeMedida || row.siglaUnidadeFornecimento);
  const targetCapacity = item.targetCapacity ?? 1;
  const targetMeasure = normalizeMeasure(item.targetMeasureUnit || item.unit);

  // If the units are exactly the same, they are compatible and can be converted via capacity.
  if (sourceMeasure && targetMeasure && sourceMeasure === targetMeasure) {
    if (sourceCapacity <= 0 || targetCapacity <= 0) {
      return { price: originalPrice, compatible: true };
    }
    return {
      price: originalPrice * (targetCapacity / sourceCapacity),
      compatible: true,
    };
  }

  const source = measureScale(sourceMeasure);
  const target = measureScale(targetMeasure);

  // If they are convertible via physical scales
  if (source && target && source.dimension === target.dimension) {
    if (sourceCapacity <= 0 || targetCapacity <= 0) {
      return { price: originalPrice, compatible: true };
    }
    const sourceBaseAmount = sourceCapacity * source.scale;
    const targetBaseAmount = targetCapacity * target.scale;
    return {
      price: originalPrice * (targetBaseAmount / sourceBaseAmount),
      compatible: true,
    };
  }

  // Otherwise, we do not perform automatic conversion, but we STILL treat them as compatible.
  return { price: originalPrice, compatible: true };
}

function buildPriceApiUrl(item: SearchItem, pageSize = 100, filters: SearchFilters = {}) {
  const endpoint = item.catalogType === 'service'
    ? '/modulo-pesquisa-preco/3_consultarServico'
    : '/modulo-pesquisa-preco/1_consultarMaterial';
  const end = new Date();
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  start.setUTCDate(start.getUTCDate() + 1);

  const params = new URLSearchParams({
    pagina: '1',
    tamanhoPagina: String(Math.max(10, Math.min(500, pageSize))),
    ...(item.catalogType === 'service'
      ? { codigoItemCatalogo: item.catalogCode }
      : { tipo: 'codigoItemCatalogo', codigo: item.catalogCode }),
    dataCompraInicio: filters.startDate || start.toISOString().slice(0, 10),
    dataCompraFim: filters.endDate || end.toISOString().slice(0, 10),
  });
  return `${COMPRAS_API_BASE}${endpoint}?${params.toString()}`;
}

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`API Compras.gov ${response.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text) as { resultado?: PriceApiRow[] };
  } finally {
    clearTimeout(timer);
  }
}

function parsePurchaseId(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length < 17) return null;
  return {
    uasg: digits.slice(0, 6),
    modality: digits.slice(6, 8),
    number: digits.slice(8, 13),
    year: digits.slice(13, 17),
  };
}

function mapCandidate(item: SearchItem, row: PriceApiRow, sourceUrl: string): RankedCandidate | null {
  const originalUnitPrice = numberOrNull(row.precoUnitario);
  if (!originalUnitPrice || originalUnitPrice <= 0) return null;

  const purchaseId = String(row.idCompra ?? '');
  const purchaseItemId = String(row.idCompraItem ?? row.idItemCompra ?? '');
  if (!purchaseItemId) return null;
  const parsedPurchase = parsePurchaseId(purchaseId);
  if (parsedPurchase) {
    const dateValue = textOrNull(row.dataResultado) ?? textOrNull(row.dataCompra);
    if (dateValue && dateValue.length >= 4) {
      const parsedYear = dateValue.slice(0, 4);
      if (/^\d{4}$/.test(parsedYear)) {
        parsedPurchase.year = parsedYear;
      }
    }
  }
  const comparison = comparablePrice(item, row);
  const description = textOrNull(row.descricaoItem) ?? textOrNull(row.descricaoDetalhadaItem) ?? item.description;
  const detailedDescription = textOrNull(row.descricaoDetalhadaItem);
  const similarity = textSimilarity(
    item.description,
    `${description} ${detailedDescription ?? ''} ${textOrNull(row.objetoCompra) ?? ''}`,
  );
  const dateValue = textOrNull(row.dataResultado) ?? textOrNull(row.dataCompra);
  const ageDays = dateValue
    ? Math.max(0, (Date.now() - new Date(`${dateValue}T12:00:00Z`).getTime()) / 86400000)
    : 365;
  const recencyScore = Math.max(0, 10 - (ageDays / 36.5));
  const quantity = numberOrNull(row.quantidade);
  const quantityRatio = quantity && item.quantity > 0
    ? Math.min(quantity, item.quantity) / Math.max(quantity, item.quantity)
    : 0;
  const heuristicScore = Math.round(Math.min(
    100,
    (similarity * 55) + (comparison.compatible ? 25 : 0) + (quantityRatio * 10) + recencyScore,
  ));

  const originalUnitLabel = [
    textOrNull(row.siglaUnidadeFornecimento) ?? textOrNull(row.nomeUnidadeFornecimento),
    numberOrNull(row.capacidadeUnidadeFornecimento),
    textOrNull(row.siglaUnidadeMedida) ?? textOrNull(row.nomeUnidadeMedida),
  ].filter((value) => value !== null && value !== '').join(' ');

  return {
    id: `comprasgov:${purchaseItemId}`,
    sourceType: 'compras_gov_precos',
    sourceLabel: 'Compras.gov.br - Pesquisa de Preços',
    sourceUrl,
    pncpSearchUrl: (() => {
      const pncpMatch = purchaseId.match(/^(\d{14})-\d+-(\d+)\/(\d{4})/);
      if (pncpMatch) {
        const cnpj = pncpMatch[1];
        const num = parseInt(pncpMatch[2], 10);
        const year = pncpMatch[3];
        return `https://pncp.gov.br/app/editais/${cnpj}/${year}/${num}`;
      }
      return `https://pncp.gov.br/app/editais?q=${encodeURIComponent(
        parsedPurchase
          ? `${parsedPurchase.uasg} ${parseInt(parsedPurchase.number, 10)}/${parsedPurchase.year}`
          : purchaseId,
      )}`;
    })(),
    purchaseId,
    purchaseItemId,
    purchaseDate: textOrNull(row.dataCompra),
    resultDate: textOrNull(row.dataResultado),
    supplierDocument: textOrNull(row.niFornecedor),
    supplierName: textOrNull(row.nomeFornecedor),
    agencyCode: textOrNull(row.codigoUasg) ?? parsedPurchase?.uasg ?? null,
    agencyName: textOrNull(row.nomeUasg) ?? textOrNull(row.nomeOrgao),
    state: textOrNull(row.estado),
    municipality: textOrNull(row.municipio),
    description,
    detailedDescription,
    brand: textOrNull(row.marca),
    quantity,
    originalUnitPrice,
    comparableUnitPrice: Number(comparison.price.toFixed(8)),
    originalUnitLabel: originalUnitLabel || 'Unidade não informada',
    unitCompatible: comparison.compatible,
    aiScore: heuristicScore,
    aiReason: comparison.compatible
      ? 'Descrição e unidade compatíveis.'
      : 'A descrição é relacionada, mas a equivalência de unidade precisa de revisão.',
    selected: comparison.compatible,
    exclusionReason: comparison.compatible ? '' : 'Unidade de fornecimento não convertida automaticamente.',
    rawData: row,
  };
}

async function rankWithGemini(item: SearchItem, candidates: RankedCandidate[]) {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
    ?? Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY')
    ?? Deno.env.get('GOOGLE_API_KEY');
  if (!apiKey || candidates.length === 0) return candidates;

  const model = Deno.env.get('GEMINI_PRICE_RESEARCH_MODEL') ?? 'gemini-2.5-flash-lite';
  const prompt = `Você auxilia uma pesquisa de preços pública. Classifique somente a aderência técnica dos registros oficiais ao item solicitado.
Não altere preços, não invente dados e não conclua conformidade jurídica.
Retorne JSON puro no formato {"rankings":[{"id":"...","score":0-100,"reason":"frase curta"}]}.

ITEM:
${JSON.stringify({
    description: item.description,
    catalogType: item.catalogType,
    catalogCode: item.catalogCode,
    quantity: item.quantity,
    unit: item.unit,
    targetCapacity: item.targetCapacity,
    targetMeasureUnit: item.targetMeasureUnit,
  })}

CANDIDATOS:
${JSON.stringify(candidates.slice(0, MAX_CANDIDATES_FOR_AI).map((candidate) => ({
    id: candidate.id,
    description: candidate.description,
    detailedDescription: candidate.detailedDescription,
    originalUnitLabel: candidate.originalUnitLabel,
    unitCompatible: candidate.unitCompatible,
    quantity: candidate.quantity,
    state: candidate.state,
    resultDate: candidate.resultDate,
  })))}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      },
    );
    if (!response.ok) return candidates;
    const payload = await response.json() as Record<string, unknown>;
    const text = ((payload.candidates as Array<Record<string, unknown>> | undefined)?.[0]
      ?.content as Record<string, unknown> | undefined)?.parts as Array<Record<string, unknown>> | undefined;
    const parsed = JSON.parse(String(text?.[0]?.text ?? '{}')) as {
      rankings?: Array<{ id?: string; score?: number; reason?: string }>;
    };
    const rankingMap = new Map(
      (parsed.rankings ?? [])
        .filter((ranking) => ranking.id)
        .map((ranking) => [ranking.id as string, ranking]),
    );

    return candidates.map((candidate) => {
      const ranking = rankingMap.get(candidate.id);
      if (!ranking) return candidate;
      return {
        ...candidate,
        aiScore: Math.max(0, Math.min(100, Number(ranking.score ?? candidate.aiScore))),
        aiReason: textOrNull(ranking.reason) ?? candidate.aiReason,
      };
    });
  } catch {
    return candidates;
  }
}

async function searchOne(item: SearchItem, limit: number, filters: SearchFilters = {}) {
  if (!/^\d{4,9}$/.test(item.catalogCode)) {
    return { localId: item.localId, candidates: [], error: 'Código CATMAT/CATSER inválido.' };
  }

  const sourceUrl = buildPriceApiUrl(item, Math.max(limit, DEFAULT_LIMIT), filters);
  const response = await fetchJson(sourceUrl);
  const unique = new Map<string, RankedCandidate>();
  for (const row of response.resultado ?? []) {
    const candidate = mapCandidate(item, row, sourceUrl);
    if (candidate && candidateMatchesFilters(candidate, filters) && !unique.has(candidate.id)) unique.set(candidate.id, candidate);
  }

  const initiallyRanked = Array.from(unique.values())
    .sort((left, right) => right.aiScore - left.aiScore)
    .slice(0, MAX_CANDIDATES_FOR_AI);
  const aiRanked = await rankWithGemini(item, initiallyRanked);
  const selected = aiRanked
    .sort((left, right) => {
      if (left.unitCompatible !== right.unitCompatible) return left.unitCompatible ? -1 : 1;
      if (right.aiScore !== left.aiScore) return right.aiScore - left.aiScore;
      return new Date(right.resultDate ?? right.purchaseDate ?? 0).getTime()
        - new Date(left.resultDate ?? left.purchaseDate ?? 0).getTime();
    })
    .slice(0, limit)
    .map((candidate) => ({
      ...candidate,
      selected: candidate.unitCompatible,
      exclusionReason: candidate.unitCompatible
        ? ''
        : 'Unidade de fornecimento não convertida automaticamente.',
    }));

  return {
    localId: item.localId,
    candidates: selected,
    error: selected.length === 0 ? 'Nenhum preço homologado foi encontrado nos últimos 12 meses.' : undefined,
  };
}

async function resolvePncpSearchUrls(client: any, candidates: RankedCandidate[]) {
  const purchasesToResolve: Array<{
    candidate: RankedCandidate;
    uasg: string;
    num: string;
    year: string;
    numInt: number;
  }> = [];

  const uasgsSet = new Set<string>();

  for (const c of candidates) {
    if (c.sourceType === 'compras_gov_precos' && c.purchaseId && c.agencyCode) {
      const digits = c.purchaseId.replace(/\D/g, '');
      let uasg = c.agencyCode;
      let number = '';
      let year = '';
      const dateVal = c.resultDate || c.purchaseDate;
      if (dateVal && dateVal.length >= 4) {
        const parsedYear = dateVal.slice(0, 4);
        if (/^\d{4}$/.test(parsedYear)) {
          year = parsedYear;
        }
      }
      if (digits.length === 15) {
        number = digits.slice(6, 11);
        if (!year) year = digits.slice(11, 15);
      } else if (digits.length >= 17) {
        number = digits.slice(8, 13);
        if (!year) year = digits.slice(13, 17);
      }

      if (uasg && number && year) {
        const numInt = parseInt(number, 10);
        purchasesToResolve.push({
          candidate: c,
          uasg,
          num: number,
          year,
          numInt,
        });
        uasgsSet.add(uasg);
      }
    }
  }

  if (purchasesToResolve.length === 0) return;

  const uasgs = Array.from(uasgsSet);

  try {
    // 1. Query local DB first
    const { data: dbRows, error } = await client
      .from('licitacoes_pncp')
      .select('numero_controle_pncp, uasg_codigo, numero_compra, ano_compra')
      .in('uasg_codigo', uasgs);

    const pncpMap = new Map<string, string>();
    if (!error && dbRows) {
      dbRows.forEach((r: any) => {
        if (r.numero_compra) {
          const cleanNum = String(r.numero_compra).includes('/')
            ? String(r.numero_compra).split('/')[0]
            : String(r.numero_compra);
          const keyFull = `${r.uasg_codigo}_${cleanNum}/${r.ano_compra}`;
          const keyShort = `${r.uasg_codigo}_${parseInt(cleanNum, 10)}/${r.ano_compra}`;
          pncpMap.set(keyFull, r.numero_controle_pncp);
          pncpMap.set(keyShort, r.numero_controle_pncp);
        }
      });
    }

    // 2. Resolve candidates from cache
    for (const p of purchasesToResolve) {
      const keyFull = `${p.uasg}_${p.num}/${p.year}`;
      const keyShort = `${p.uasg}_${p.numInt}/${p.year}`;
      const ctrlNum = pncpMap.get(keyFull) || pncpMap.get(keyShort);
      
      if (ctrlNum) {
        const match = ctrlNum.match(/^(\d{14})-\d+-(\d+)\/(\d{4})/);
        if (match) {
          p.candidate.pncpSearchUrl = `https://pncp.gov.br/app/editais/${match[1]}/${match[3]}/${parseInt(match[2], 10)}`;
        }
      }
    }
  } catch (err) {
    console.error('Error in resolvePncpSearchUrls:', err);
  }
}

async function validateUser(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new HttpError('Sessão autenticada obrigatória.', 401);
  const client = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(authorization.slice(7));
  if (error || !data.user) throw new HttpError('Sessão inválida ou expirada.', 401);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
    });
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Método não permitido.' }, 405);

  try {
    await validateUser(request);
    const body = await request.json() as SearchRequest;
    const items = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [];
    if (items.length === 0) return jsonResponse({ error: 'Envie ao menos um item para pesquisa.' }, 400);
    const limit = Math.max(3, Math.min(100, Number(body.limit ?? DEFAULT_LIMIT)));
    const filters = normalizeFilters(body.filters);

    const results = [];
    for (let index = 0; index < items.length; index += 3) {
      results.push(...await Promise.all(
        items.slice(index, index + 3).map((item) => searchOne(item, limit, filters).catch((error) => ({
          localId: item.localId,
          candidates: [],
          error: error instanceof Error ? error.message : String(error),
        }))),
      ));
    }

    const client = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const allCandidates = results.flatMap((r) => r.candidates || []);
    if (allCandidates.length > 0) {
      await resolvePncpSearchUrls(client, allCandidates);
    }

    return jsonResponse({ results });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, status);
  }
});
