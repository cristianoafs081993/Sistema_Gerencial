import * as XLSX from 'xlsx';
import * as pdfWorkerAsset from 'pdfjs-dist/build/pdf.worker.min.js?url';
import type { PriceCatalogSuggestion } from '@/lib/priceCatalog';
import { env } from '@/lib/env';
import { calculateIndexFactor, type InflationIndexType } from './monetaryAdjustment';

async function getFileArrayBuffer(file: File | Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export type PriceResearchCatalogType = 'material' | 'service';
export type PriceResearchMethod = 'median' | 'mean' | 'minimum';

export type PriceResearchCandidateSourceType =
  | 'compras_gov_precos'
  | 'amazon'
  | 'magalu'
  | 'americanas'
  | 'casasbahia'
  | 'kabum'
  | 'dell'
  | 'lenovo'
  | 'custom';

export type PriceResearchCandidate = {
  id: string;
  sourceType: PriceResearchCandidateSourceType;
  sourceLabel: string;
  sourceUrl: string;
  pncpSearchUrl?: string;
  thumbnailLink?: string;
  displayLink?: string;
  evidenceImage?: string;
  evidenceCapturedAt?: string;
  freightCost?: number;
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
  rawData: Record<string, unknown>;
  monetaryAdjustmentEnabled?: boolean;
  monetaryAdjustmentIndex?: InflationIndexType | 'manual';
  monetaryAdjustmentFactor?: number;
  monetaryAdjustmentManualRate?: number;
  monetaryAdjustedPrice?: number;
};
export type PriceResearchBooleanFilter = '' | 'yes' | 'no';

export type PriceResearchSearchFilters = {
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

export type PriceResearchItem = {
  localId: string;
  itemNumber: string;
  description: string;
  catalogType: PriceResearchCatalogType;
  catalogCode: string;
  quantity: number;
  unit: string;
  targetCapacity: number | null;
  targetMeasureUnit: string | null;
  referenceUnitCost: number | null;
  candidates: PriceResearchCandidate[];
  searchStatus: 'idle' | 'searching' | 'success' | 'error';
  searchError?: string;
  catalogMatchStatus?: 'idle' | 'searching' | 'success' | 'error';
  catalogSuggestions?: PriceCatalogSuggestion[];
  catalogMatchError?: string;
  marketSearchTerm?: string;
  marketSearchResults?: import('@/services/marketSearch').MarketSearchResult[];
};

export type PriceResearchStatistics = {
  count: number;
  mean: number;
  median: number;
  minimum: number;
  maximum: number;
  weightedMean: number;
  sanitizedMean: number;
  excludedCount: number;
  standardDeviation: number;
  coefficientOfVariation: number;
  amplitudeDivergence: number;
};

export type PriceResearchManagementSummary = {
  itemsCount: number;
  selectedQuotesCount: number;
  excludedQuotesCount: number;
  officialQuotesCount: number;
  marketQuotesCount: number;
  localQuotesCount: number;
  estimatedTotal: number;
  abcClassTotals: Record<PriceResearchAbcClass, number>;
};

export type PriceResearchAbcClass = 'A' | 'B' | 'C';

export type PriceResearchAbcRow = {
  itemId: string;
  itemNumber: string;
  description: string;
  quantity: number;
  estimatedUnitPrice: number;
  estimatedTotal: number;
  accumulatedTotal: number;
  accumulatedPercentage: number;
  participationPercentage: number;
  abcClass: PriceResearchAbcClass;
};

export type PriceResearchComparisonRow = {
  itemNumber: string;
  itemDescription: string;
  source: string;
  supplier: string;
  agency: string;
  state: string;
  municipality: string;
  purchaseDate: string | null;
  selected: boolean;
  unitCompatible: boolean;
  unitPrice: number;
  estimatedUnitPrice: number;
  deviationPercentage: number;
  exclusionReason: string;
};

export type PriceResearchAuthenticationPayload = {
  snapshotHash: string;
  verificationUrl: string;
  qrCodeUrl: string;
  generatedAt: string;
  reportVersion: string;
};

export type PriceResearchAuthenticationOptions = {
  origin?: string;
  researchId?: string;
  generatedAt?: string;
  authenticationData?: PriceResearchReportData;
};

export type PriceResearchReportServer = {
  id: string;
  name: string;
  role: string;
  registration: string;
  email?: string;
};

export type PriceResearchReportData = {
  title: string;
  processNumber: string;
  objectDescription: string;
  responsibleName: string;
  institutionName?: string;
  institutionUnit?: string;
  institutionDetails?: string;
  institutionLogo?: string;
  reportServers?: PriceResearchReportServer[];
  researchDate: string;
  method: PriceResearchMethod;
  methodologyJustification: string;
  notes: string;
  sourceFile: string;
  items: PriceResearchItem[];
  searchFilters?: PriceResearchSearchFilters;
};

export type PriceResearchComplianceSeverity = 'error' | 'warning' | 'info';

export type PriceResearchComplianceFinding = {
  id: string;
  severity: PriceResearchComplianceSeverity;
  scope: 'research' | 'item' | 'candidate';
  itemId?: string;
  itemNumber?: string;
  candidateId?: string;
  ruleLabel: string;
  message: string;
  evidence: string;
  recommendedAction: string;
};

const HEADER_ALIASES = {
  itemNumber: ['item', 'numeroitem', 'nroitem', 'ordem', 'numero'],
  description: ['descricao', 'descricaoitem', 'objeto', 'especificacao', 'itemdescricao'],
  quantity: ['quantidade', 'qtd', 'qtde'],
  unit: ['unidade', 'und', 'unidadefornecimento'],
  catalogCode: ['codigocatalogo', 'codigoitem', 'catmatcatser', 'codigo'],
  catalogType: ['tipo', 'tipocatalogo', 'materialservico'],
  catmat: ['catmat', 'codigocatmat'],
  catser: ['catser', 'codigocatser'],
  targetCapacity: ['capacidade', 'capacidadeunidade', 'conteudo'],
  targetMeasureUnit: ['unidademedida', 'unidadecapacidade', 'medida'],
  referenceUnitCost: ['custounitario', 'valorunitario', 'precounitario', 'valorunitarioestimado'],
} as const;

const MEASURE_ALIASES: Record<string, string> = {
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
type PriceResearchBooleanFlag = 'srp' | 'meEpp' | 'sustainable';

const REGION_BY_UF: Record<string, string> = {
  AC: 'Norte',
  AP: 'Norte',
  AM: 'Norte',
  PA: 'Norte',
  RO: 'Norte',
  RR: 'Norte',
  TO: 'Norte',
  AL: 'Nordeste',
  BA: 'Nordeste',
  CE: 'Nordeste',
  MA: 'Nordeste',
  PB: 'Nordeste',
  PE: 'Nordeste',
  PI: 'Nordeste',
  RN: 'Nordeste',
  SE: 'Nordeste',
  DF: 'Centro-Oeste',
  GO: 'Centro-Oeste',
  MT: 'Centro-Oeste',
  MS: 'Centro-Oeste',
  ES: 'Sudeste',
  MG: 'Sudeste',
  RJ: 'Sudeste',
  SP: 'Sudeste',
  PR: 'Sul',
  RS: 'Sul',
  SC: 'Sul',
};

function rawValueByKeys(rawData: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!rawData || typeof rawData !== 'object') return undefined;
  const normalizedKeys = new Set(keys.map((key) => normalizePriceResearchText(key).replace(/\s/g, '')));
  const stack: unknown[] = [rawData];
  while (stack.length > 0) {
    const current = stack.shift();
    if (!current || typeof current !== 'object') continue;
    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      const normalizedKey = normalizePriceResearchText(key).replace(/\s/g, '');
      if (normalizedKeys.has(normalizedKey)) return value;
      if (value && typeof value === 'object') stack.push(value);
    }
  }
  return undefined;
}

function stringFromRaw(rawData: Record<string, unknown> | null | undefined, keys: string[]) {
  const value = rawValueByKeys(rawData, keys);
  if (value === null || value === undefined) return '';
  return String(value);
}

function dateFromRaw(rawData: Record<string, unknown> | null | undefined, keys: string[]) {
  const value = stringFromRaw(rawData, keys).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '';
}

function booleanFromRaw(rawData: Record<string, unknown> | null | undefined, keys: string[], positiveHints: string[], negativeHints: string[] = []) {
  const value = rawValueByKeys(rawData, keys);
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
  const normalized = normalizePriceResearchText(value);
  if (['s', 'sim', 'true', '1'].includes(normalized)) return true;
  if (['n', 'nao', 'false', '0'].includes(normalized)) return false;
  if (positiveHints.some((hint) => normalized.includes(hint))) return true;
  if (negativeHints.some((hint) => normalized.includes(hint))) return false;
  return null;
}

export function normalizePriceResearchText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s/.-]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePriceResearchDigits(value: unknown) {
  return String(value ?? '').replace(/\D/g, '');
}

export function normalizePriceResearchUasg(value: unknown) {
  return normalizePriceResearchDigits(value).slice(0, 6);
}

export function normalizePriceResearchUnit(value: unknown) {
  const normalized = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return MEASURE_ALIASES[normalized] ?? normalized;
}

export function getBrazilRegionFromUf(value: unknown) {
  const uf = String(value ?? '').trim().toUpperCase();
  return REGION_BY_UF[uf] ?? '';
}

export function parsePriceResearchPurchaseInfo(candidate: Pick<PriceResearchCandidate, 'purchaseId' | 'rawData'>) {
  const purchaseId = String(candidate.purchaseId ?? '');
  const digits = normalizePriceResearchDigits(purchaseId);
  const rawNumber = stringFromRaw(candidate.rawData, ['numeroCompra', 'numero_compra', 'numeroPregao', 'numero_pregao', 'compra']);
  const rawYear = stringFromRaw(candidate.rawData, ['anoCompra', 'ano_compra', 'ano']);
  const rawModality = stringFromRaw(candidate.rawData, ['modalidadeCompra', 'modalidade', 'nomeModalidadeCompra', 'codigoModalidadeCompra']);
  let uasg = normalizePriceResearchUasg(stringFromRaw(candidate.rawData, ['codigoUasg', 'uasg', 'codigo_uasg']));
  let modalityCode = normalizePriceResearchDigits(rawModality);
  let number = normalizePriceResearchDigits(rawNumber);
  let year = normalizePriceResearchDigits(rawYear).slice(0, 4);

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

  return {
    uasg,
    number,
    year,
    modalityCode,
    modalityLabel,
    label: [number, year].filter(Boolean).join('/'),
  };
}

export function getPriceResearchCandidateBooleanFlag(candidate: PriceResearchCandidate, flag: PriceResearchBooleanFlag) {
  if (flag === 'srp') {
    return booleanFromRaw(
      candidate.rawData,
      ['compraSrp', 'srp', 'sistemaRegistroPrecos', 'registroPreco', 'registroPrecos', 'indicadorSrp'],
      ['srp', 'registro de preco', 'registro de precos'],
    );
  }
  if (flag === 'meEpp') {
    return booleanFromRaw(
      candidate.rawData,
      ['porteFornecedor', 'tipoFornecedor', 'fornecedorPorte', 'indicadorMeEpp', 'microEmpresa', 'microempresa', 'epp'],
      ['me/epp', 'microempresa', 'empresa de pequeno porte', 'pequeno porte', 'me epp'],
      ['demais', 'nao'],
    );
  }
  return booleanFromRaw(
    candidate.rawData,
    ['itemSustentavel', 'sustentavel', 'criterioSustentabilidade', 'possuiCriterioSustentabilidade'],
    ['sustentavel', 'sustentabilidade'],
  );
}

export function hasPriceResearchSearchFilters(filters?: PriceResearchSearchFilters | null) {
  if (!filters) return false;
  return Object.entries(filters).some(([, value]) => {
    if (value === null || value === undefined || value === '') return false;
    if (typeof value === 'number') return Number.isFinite(value);
    return true;
  });
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

export function candidateMatchesPriceResearchFilters(candidate: PriceResearchCandidate, filters?: PriceResearchSearchFilters | null) {
  if (!hasPriceResearchSearchFilters(filters)) return true;
  const active = filters ?? {};
  const rawDataText = normalizePriceResearchText(JSON.stringify(candidate.rawData ?? {}));
  const purchaseInfo = parsePriceResearchPurchaseInfo(candidate);
  const dateValue = candidate.resultDate || candidate.purchaseDate;
  const candidateText = normalizePriceResearchText([
    candidate.description,
    candidate.detailedDescription,
    candidate.agencyName,
    candidate.supplierName,
    candidate.brand,
    candidate.purchaseId,
    candidate.purchaseItemId,
    rawDataText,
  ].join(' '));

  if (active.description && !candidateText.includes(normalizePriceResearchText(active.description))) return false;
  if (active.catalogCode) {
    const rawCatalogCode = stringFromRaw(candidate.rawData, ['codigoItemCatalogo', 'codigoCatalogo', 'codigoItem', 'catmat', 'catser']);
    if (!normalizePriceResearchDigits(rawCatalogCode).includes(normalizePriceResearchDigits(active.catalogCode))) return false;
  }
  if (!matchesDateRange(dateValue, active.startDate, active.endDate)) return false;
  if (active.purchaseNumber) {
    const wanted = normalizePriceResearchDigits(active.purchaseNumber);
    const haystack = normalizePriceResearchDigits([purchaseInfo.number, purchaseInfo.year, candidate.purchaseId].join(' '));
    if (!haystack.includes(wanted)) return false;
  }
  if (active.uasg && normalizePriceResearchUasg(candidate.agencyCode ?? purchaseInfo.uasg) !== normalizePriceResearchUasg(active.uasg)) return false;
  if (active.agencyName && !normalizePriceResearchText(candidate.agencyName).includes(normalizePriceResearchText(active.agencyName))) return false;
  if (active.supplierDocument && !normalizePriceResearchDigits(candidate.supplierDocument).includes(normalizePriceResearchDigits(active.supplierDocument))) return false;
  if (Number.isFinite(active.quantityMin ?? NaN) && (candidate.quantity ?? 0) < Number(active.quantityMin)) return false;
  if (Number.isFinite(active.quantityMax ?? NaN) && (candidate.quantity ?? 0) > Number(active.quantityMax)) return false;
  if (active.unit && !normalizePriceResearchUnit(candidate.originalUnitLabel).includes(normalizePriceResearchUnit(active.unit))) return false;
  if (active.state && String(candidate.state ?? '').toUpperCase() !== String(active.state).toUpperCase()) return false;
  if (active.region && getBrazilRegionFromUf(candidate.state) !== active.region) return false;
  if (active.modality) {
    const modalityText = normalizePriceResearchText([purchaseInfo.modalityCode, purchaseInfo.modalityLabel].join(' '));
    if (!modalityText.includes(normalizePriceResearchText(active.modality))) return false;
  }
  if (active.brand && !normalizePriceResearchText(candidate.brand).includes(normalizePriceResearchText(active.brand))) return false;
  if (!matchesBooleanFilter(getPriceResearchCandidateBooleanFlag(candidate, 'srp'), active.srp)) return false;
  if (!matchesBooleanFilter(getPriceResearchCandidateBooleanFlag(candidate, 'meEpp'), active.meEpp)) return false;
  if (!matchesBooleanFilter(getPriceResearchCandidateBooleanFlag(candidate, 'sustainable'), active.sustainable)) return false;
  if (!matchesDateRange(dateFromRaw(candidate.rawData, ['dataAdjudicacao', 'data_adjudicacao', 'adjudicacao']), active.adjudicationStartDate, active.adjudicationEndDate)) return false;
  if (!matchesDateRange(dateFromRaw(candidate.rawData, ['dataHomologacao', 'data_homologacao', 'homologacao']), active.homologationStartDate, active.homologationEndDate)) return false;
  if (active.rawDataText && !rawDataText.includes(normalizePriceResearchText(active.rawDataText))) return false;
  return true;
}

export function filterPriceResearchCandidates(candidates: PriceResearchCandidate[], filters?: PriceResearchSearchFilters | null) {
  return candidates.filter((candidate) => candidateMatchesPriceResearchFilters(candidate, filters));
}

export const METHOD_LABELS: Record<PriceResearchMethod, string> = {
  median: 'Mediana',
  mean: 'Média',
  minimum: 'Menor preço',
};

type PriceResearchField = keyof typeof HEADER_ALIASES;

const PDF_HEADER_LABELS: Record<PriceResearchField, string> = {
  itemNumber: 'Item',
  description: 'Descrição',
  quantity: 'Quantidade',
  unit: 'Unidade',
  catalogCode: 'Código catálogo',
  catalogType: 'Tipo catálogo',
  catmat: 'CATMAT',
  catser: 'CATSER',
  targetCapacity: 'Capacidade',
  targetMeasureUnit: 'Unidade de medida',
  referenceUnitCost: 'Custo unitário',
};

function normalizeText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function findHeaderField(value: unknown): PriceResearchField | null {
  const normalized = normalizeText(value);
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<
    [PriceResearchField, readonly string[]]
  >) {
    if (aliases.includes(normalized)) return field;
  }
  return null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;
  const parsed = Number(normalized.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function readCell(row: unknown[], headerMap: Map<string, number>, aliases: readonly string[]) {
  for (const alias of aliases) {
    const index = headerMap.get(alias);
    if (index !== undefined) return row[index];
  }
  return undefined;
}

function detectHeaderRow(rows: unknown[][]) {
  let bestIndex = -1;
  let bestScore = 0;

  rows.slice(0, 30).forEach((row, index) => {
    const headers = row.map(normalizeText);
    const score = Object.values(HEADER_ALIASES).reduce(
      (total, aliases) => total + (aliases.some((alias) => headers.includes(alias)) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  if (bestIndex < 0 || bestScore < 2) {
    throw new Error('Não foi possível localizar o cabeçalho. Inclua ao menos Descrição e Quantidade na planilha.');
  }
  return bestIndex;
}

function inferCatalogCode(description: string, explicitCode: unknown) {
  const explicit = String(explicitCode ?? '').replace(/\D/g, '');
  if (explicit) return explicit;
  return description.match(/\b(?:CATMAT|CATSER)\s*[:#-]?\s*(\d{4,9})\b/i)?.[1] ?? '';
}

function inferCatalogType(description: string, explicitType: unknown, catmat: unknown, catser: unknown): PriceResearchCatalogType {
  if (String(catser ?? '').replace(/\D/g, '')) return 'service';
  if (String(catmat ?? '').replace(/\D/g, '')) return 'material';
  const normalized = normalizeText(explicitType);
  if (normalized.includes('serv')) return 'service';
  if (/\bCATSER\b/i.test(description)) return 'service';
  return 'material';
}

function normalizeMeasureUnit(value: unknown) {
  const normalized = String(value ?? '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  return MEASURE_ALIASES[normalized] ?? (normalized || null);
}

export function inferTargetMeasure(description: string, unit: string) {
  const unitMeasure = normalizeMeasureUnit(unit);
  if (unitMeasure && ['G', 'KG', 'ML', 'L', 'UN', 'H'].includes(unitMeasure)) {
    return { capacity: 1, measureUnit: unitMeasure };
  }

  const match = description.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|litros?|un(?:idades?)?|horas?)\b/i);
  if (!match) return { capacity: null, measureUnit: null };
  return {
    capacity: parseNumber(match[1]),
    measureUnit: normalizeMeasureUnit(match[2]),
  };
}

type PdfTextFragment = {
  text: string;
  x: number;
  y: number;
};

type PdfHeaderColumn = {
  field: PriceResearchField;
  x: number;
};

function groupPdfFragmentsByLine(fragments: PdfTextFragment[]) {
  const lines: PdfTextFragment[][] = [];
  for (const fragment of [...fragments].sort((left, right) => right.y - left.y || left.x - right.x)) {
    const line = lines.find((candidate) => Math.abs(candidate[0].y - fragment.y) <= 2.5);
    if (line) line.push(fragment);
    else lines.push([fragment]);
  }
  return lines.map((line) => line.sort((left, right) => left.x - right.x));
}

function detectPdfHeaderColumns(line: PdfTextFragment[]) {
  const columns: PdfHeaderColumn[] = [];
  for (let index = 0; index < line.length; index += 1) {
    let matched: PdfHeaderColumn | null = null;
    let matchedLength = 0;
    for (let length = Math.min(4, line.length - index); length >= 1; length -= 1) {
      const field = findHeaderField(line.slice(index, index + length).map((fragment) => fragment.text).join(' '));
      if (!field) continue;
      matched = { field, x: line[index].x };
      matchedLength = length;
      break;
    }
    if (matched && !columns.some((column) => column.field === matched?.field)) {
      columns.push(matched);
      index += matchedLength - 1;
    }
  }

  const fields = new Set(columns.map((column) => column.field));
  const hasCatalog = fields.has('catmat') || fields.has('catser') || fields.has('catalogCode');
  return fields.has('description') && fields.has('quantity') && hasCatalog
    ? columns.sort((left, right) => left.x - right.x)
    : [];
}

function pdfLineToRow(line: PdfTextFragment[], columns: PdfHeaderColumn[]) {
  const row = Array.from({ length: columns.length }, () => '');
  const boundaries = columns.slice(0, -1).map(
    (column, index) => (column.x + columns[index + 1].x) / 2,
  );

  for (const fragment of line) {
    let columnIndex = boundaries.findIndex((boundary) => fragment.x < boundary);
    if (columnIndex < 0) columnIndex = columns.length - 1;
    row[columnIndex] = `${row[columnIndex]} ${fragment.text}`.trim();
  }
  return row;
}

async function readPdfRows(file: File): Promise<unknown[][]> {
  const pdfjsLib = await import('pdfjs-dist');
  const bundledWorkerUrl = (pdfWorkerAsset as { default?: unknown }).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = typeof bundledWorkerUrl === 'string'
    ? bundledWorkerUrl
    : new URL('../../node_modules/pdfjs-dist/build/pdf.worker.min.js', import.meta.url).href;
  const pdf = await pdfjsLib.getDocument({ data: await getFileArrayBuffer(file) }).promise;
  const rows: unknown[][] = [];
  let columns: PdfHeaderColumn[] = [];
  let searchableFragments = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const fragments = content.items.flatMap((item) => {
      if (!('str' in item) || !item.str.trim() || !('transform' in item)) return [];
      searchableFragments += 1;
      return [{
        text: item.str.trim(),
        x: Number(item.transform[4] ?? 0),
        y: Number(item.transform[5] ?? 0),
      }];
    });

    for (const line of groupPdfFragmentsByLine(fragments)) {
      const detectedColumns = detectPdfHeaderColumns(line);
      if (detectedColumns.length > 0) {
        columns = detectedColumns;
        if (rows.length === 0) {
          rows.push(columns.map((column) => PDF_HEADER_LABELS[column.field]));
        }
        continue;
      }
      if (columns.length === 0) continue;

      const row = pdfLineToRow(line, columns);
      const valuesByField = new Map(columns.map((column, index) => [column.field, row[index]]));
      const description = String(valuesByField.get('description') ?? '').trim();
      const hasIdentity = ['itemNumber', 'quantity', 'catmat', 'catser', 'catalogCode']
        .some((field) => String(valuesByField.get(field as PriceResearchField) ?? '').trim());

      if (description && hasIdentity) {
        rows.push(row);
      } else if (description && rows.length > 1) {
        const descriptionIndex = columns.findIndex((column) => column.field === 'description');
        rows[rows.length - 1][descriptionIndex] = `${rows[rows.length - 1][descriptionIndex]} ${description}`.trim();
      }
    }
  }

  if (searchableFragments === 0) {
    throw new Error('O PDF não possui texto pesquisável. Esta versão ainda não faz OCR de documentos escaneados.');
  }
  if (rows.length <= 1) {
    throw new Error('Não foi possível identificar uma tabela de itens no PDF. Use o modelo XLSX ou um PDF com cabeçalhos e colunas pesquisáveis.');
  }
  return rows;
}

async function readRows(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf' || file.type === 'application/pdf') {
    return readPdfRows(file);
  }
  if (extension === 'csv') {
    const bytes = new Uint8Array(await getFileArrayBuffer(file));
    const text = new TextDecoder('utf-8').decode(bytes);
    const delimiter = text.split(/\r?\n/, 1)[0]?.includes(';') ? ';' : ',';
    const workbook = XLSX.read(text, { type: 'string', raw: false, FS: delimiter });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false, defval: '' }) as unknown[][];
  }
  const workbook = XLSX.read(await getFileArrayBuffer(file), { type: 'array', cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error('A planilha não possui abas legíveis.');
  return XLSX.utils.sheet_to_json(firstSheet, {
    header: 1,
    raw: false,
    defval: '',
  }) as unknown[][];
}

export function parsePriceResearchRows(rows: unknown[][]): PriceResearchItem[] {
  const headerIndex = detectHeaderRow(rows);
  const headerMap = new Map(
    rows[headerIndex].map((header, index) => [normalizeText(header), index]),
  );

  const parsed: PriceResearchItem[] = [];
  rows.slice(headerIndex + 1).forEach((row, index) => {
    const description = String(readCell(row, headerMap, HEADER_ALIASES.description) ?? '').trim();
    if (!description) return;

    const catmat = readCell(row, headerMap, HEADER_ALIASES.catmat);
    const catser = readCell(row, headerMap, HEADER_ALIASES.catser);
    const explicitCode = catmat || catser || readCell(row, headerMap, HEADER_ALIASES.catalogCode);
    const unit = String(readCell(row, headerMap, HEADER_ALIASES.unit) ?? 'UN').trim().toUpperCase() || 'UN';
    const inferredMeasure = inferTargetMeasure(description, unit);
    const targetCapacity = parseNumber(readCell(row, headerMap, HEADER_ALIASES.targetCapacity))
      ?? inferredMeasure.capacity;
    const targetMeasureUnit = normalizeMeasureUnit(
      readCell(row, headerMap, HEADER_ALIASES.targetMeasureUnit),
    ) ?? inferredMeasure.measureUnit;

    parsed.push({
      localId: `item-${index + 1}-${crypto.randomUUID()}`,
      itemNumber: String(readCell(row, headerMap, HEADER_ALIASES.itemNumber) ?? parsed.length + 1).trim(),
      description,
      catalogType: inferCatalogType(
        description,
        readCell(row, headerMap, HEADER_ALIASES.catalogType),
        catmat,
        catser,
      ),
      catalogCode: inferCatalogCode(description, explicitCode),
      quantity: parseNumber(readCell(row, headerMap, HEADER_ALIASES.quantity)) ?? 1,
      unit,
      targetCapacity,
      targetMeasureUnit,
      referenceUnitCost: parseNumber(readCell(row, headerMap, HEADER_ALIASES.referenceUnitCost)),
      candidates: [],
      searchStatus: 'idle',
      catalogMatchStatus: 'idle',
      catalogSuggestions: [],
    });
  });

  if (parsed.length === 0) {
    throw new Error('Nenhum item com descrição foi encontrado na planilha.');
  }
  return parsed;
}

export async function parsePriceResearchFile(file: File): Promise<PriceResearchItem[]> {
  return parsePriceResearchRows(await readRows(file));
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function normalizeStatisticWeight(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function calculatePriceStatistics(values: number[], weights: Array<number | null | undefined> = []): PriceResearchStatistics {
  const valid = values
    .map((value, index) => ({ value, weight: normalizeStatisticWeight(weights[index]) }))
    .filter((entry) => Number.isFinite(entry.value) && entry.value > 0);
    
  if (valid.length === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      minimum: 0,
      maximum: 0,
      weightedMean: 0,
      sanitizedMean: 0,
      excludedCount: 0,
      standardDeviation: 0,
      coefficientOfVariation: 0,
      amplitudeDivergence: 0,
    };
  }

  const validValues = valid.map((entry) => entry.value);
  const mean = validValues.reduce((total, value) => total + value, 0) / validValues.length;
  const totalWeight = valid.reduce((total, entry) => total + entry.weight, 0);
  const weightedMean = totalWeight > 0
    ? valid.reduce((total, entry) => total + (entry.value * entry.weight), 0) / totalWeight
    : mean;
  const variance = validValues.reduce((total, value) => total + ((value - mean) ** 2), 0) / validValues.length;
  const standardDeviation = Math.sqrt(variance);
  const minimum = Math.min(...validValues);
  const maximum = Math.max(...validValues);

  return {
    count: validValues.length,
    mean,
    median: median(validValues),
    minimum,
    maximum,
    weightedMean,
    sanitizedMean: mean,
    excludedCount: 0,
    standardDeviation,
    coefficientOfVariation: mean > 0 ? (standardDeviation / mean) * 100 : 0,
    amplitudeDivergence: minimum > 0 ? ((maximum - minimum) / minimum) * 100 : 0,
  };
}

export function getSelectedStatistics(item: PriceResearchItem) {
  const selected = item.candidates.filter((candidate) => candidate.selected);
  return {
    ...calculatePriceStatistics(
      selected.map((candidate) => candidate.monetaryAdjustedPrice ?? candidate.comparableUnitPrice),
      selected.map((candidate) => candidate.quantity),
    ),
    excludedCount: item.candidates.filter((candidate) => !candidate.selected).length,
  };
}

export function getEstimatedUnitPrice(item: PriceResearchItem, method: PriceResearchMethod) {
  const statistics = getSelectedStatistics(item);
  if (method === 'mean') return statistics.mean;
  if (method === 'minimum') return statistics.minimum;
  return statistics.median;
}

function getCandidateEffectivePrice(candidate: PriceResearchCandidate) {
  return candidate.monetaryAdjustedPrice ?? candidate.comparableUnitPrice;
}

export function buildPriceResearchAbcCurve(data: PriceResearchReportData): PriceResearchAbcRow[] {
  const rows = data.items
    .map((item) => {
      const estimatedUnitPrice = getEstimatedUnitPrice(item, data.method);
      return {
        itemId: item.localId,
        itemNumber: item.itemNumber,
        description: item.description,
        quantity: item.quantity,
        estimatedUnitPrice,
        estimatedTotal: estimatedUnitPrice * item.quantity,
      };
    })
    .sort((left, right) => right.estimatedTotal - left.estimatedTotal);

  const grandTotal = rows.reduce((total, row) => total + row.estimatedTotal, 0);
  let accumulatedTotal = 0;

  return rows.map((row) => {
    const previousAccumulatedPercentage = grandTotal > 0 ? (accumulatedTotal / grandTotal) * 100 : 0;
    accumulatedTotal += row.estimatedTotal;
    const accumulatedPercentage = grandTotal > 0 ? (accumulatedTotal / grandTotal) * 100 : 0;
    const participationPercentage = grandTotal > 0 ? (row.estimatedTotal / grandTotal) * 100 : 0;
    const abcClass: PriceResearchAbcClass = previousAccumulatedPercentage < 80
      ? 'A'
      : previousAccumulatedPercentage < 95
        ? 'B'
        : 'C';

    return {
      ...row,
      accumulatedTotal,
      accumulatedPercentage,
      participationPercentage,
      abcClass,
    };
  });
}

export function buildPriceResearchComparisonMap(data: PriceResearchReportData): PriceResearchComparisonRow[] {
  return data.items.flatMap((item) => {
    const estimatedUnitPrice = getEstimatedUnitPrice(item, data.method);
    return item.candidates.map((candidate) => {
      const unitPrice = getCandidateEffectivePrice(candidate);
      return {
        itemNumber: item.itemNumber,
        itemDescription: item.description,
        source: candidate.sourceLabel,
        supplier: candidate.supplierName || '-',
        agency: [candidate.agencyCode, candidate.agencyName].filter(Boolean).join(' - ') || '-',
        state: candidate.state || '-',
        municipality: candidate.municipality || '-',
        purchaseDate: candidate.resultDate || candidate.purchaseDate,
        selected: candidate.selected,
        unitCompatible: candidate.unitCompatible,
        unitPrice,
        estimatedUnitPrice,
        deviationPercentage: estimatedUnitPrice > 0 ? ((unitPrice - estimatedUnitPrice) / estimatedUnitPrice) * 100 : 0,
        exclusionReason: candidate.exclusionReason,
      };
    });
  });
}

export function buildPriceResearchManagementSummary(data: PriceResearchReportData): PriceResearchManagementSummary {
  const abcRows = buildPriceResearchAbcCurve(data);
  const allCandidates = data.items.flatMap((item) => item.candidates);
  return {
    itemsCount: data.items.length,
    selectedQuotesCount: allCandidates.filter((candidate) => candidate.selected).length,
    excludedQuotesCount: allCandidates.filter((candidate) => !candidate.selected).length,
    officialQuotesCount: allCandidates.filter((candidate) => candidate.sourceType === 'compras_gov_precos').length,
    marketQuotesCount: allCandidates.filter((candidate) => candidate.sourceType !== 'compras_gov_precos' && candidate.sourceType !== 'custom').length,
    localQuotesCount: allCandidates.filter((candidate) => candidate.sourceType === 'custom').length,
    estimatedTotal: abcRows.reduce((total, row) => total + row.estimatedTotal, 0),
    abcClassTotals: {
      A: abcRows.filter((row) => row.abcClass === 'A').length,
      B: abcRows.filter((row) => row.abcClass === 'B').length,
      C: abcRows.filter((row) => row.abcClass === 'C').length,
    },
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function createStableHash(value: string) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, '0');
}

export function buildPriceResearchAuthenticationPayload(
  data: PriceResearchReportData,
  options: PriceResearchAuthenticationOptions = {},
): PriceResearchAuthenticationPayload {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const snapshot = {
    title: data.title,
    processNumber: data.processNumber,
    objectDescription: data.objectDescription,
    responsibleName: data.responsibleName,
    institutionName: data.institutionName,
    institutionUnit: data.institutionUnit,
    institutionDetails: data.institutionDetails,
    institutionLogo: data.institutionLogo,
    reportServers: data.reportServers,
    researchDate: data.researchDate,
    method: data.method,
    methodologyJustification: data.methodologyJustification,
    notes: data.notes,
    sourceFile: data.sourceFile,
    items: data.items.map((item) => ({
      localId: item.localId,
      itemNumber: item.itemNumber,
      description: item.description,
      catalogType: item.catalogType,
      catalogCode: item.catalogCode,
      quantity: item.quantity,
      unit: item.unit,
      targetCapacity: item.targetCapacity,
      targetMeasureUnit: item.targetMeasureUnit,
      referenceUnitCost: item.referenceUnitCost,
      candidates: item.candidates.map((candidate) => ({
        id: candidate.id,
        sourceType: candidate.sourceType,
        sourceLabel: candidate.sourceLabel,
        sourceUrl: candidate.sourceUrl,
        purchaseId: candidate.purchaseId,
        purchaseItemId: candidate.purchaseItemId,
        purchaseDate: candidate.purchaseDate,
        resultDate: candidate.resultDate,
        supplierDocument: candidate.supplierDocument,
        supplierName: candidate.supplierName,
        agencyCode: candidate.agencyCode,
        agencyName: candidate.agencyName,
        state: candidate.state,
        municipality: candidate.municipality,
        description: candidate.description,
        quantity: candidate.quantity,
        originalUnitPrice: candidate.originalUnitPrice,
        comparableUnitPrice: candidate.comparableUnitPrice,
        monetaryAdjustedPrice: candidate.monetaryAdjustedPrice,
        originalUnitLabel: candidate.originalUnitLabel,
        unitCompatible: candidate.unitCompatible,
        selected: candidate.selected,
        exclusionReason: candidate.exclusionReason,
      })),
    })),
  };
  const snapshotHash = createStableHash(stableStringify(snapshot));
  const origin = options.origin || env.appOrigin || (typeof window !== 'undefined' ? window.location.origin : '');
  const verificationPath = `/pesquisa-precos/validar?auth=${encodeURIComponent(snapshotHash)}${options.researchId ? `&id=${encodeURIComponent(options.researchId)}` : ''}`;
  const verificationUrl = origin ? `${origin}${verificationPath}` : verificationPath;

  return {
    snapshotHash,
    verificationUrl,
    qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(verificationUrl)}`,
    generatedAt,
    reportVersion: 'price-research-management-v1',
  };
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value.length <= 10 ? `${value.slice(0, 10)}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function differenceInDays(left: Date, right: Date) {
  return Math.floor((left.getTime() - right.getTime()) / 86400000);
}

function hasMeaningfulJustification(value: unknown) {
  return String(value ?? '').trim().length >= 10;
}

function isOfficialPrice(candidate: PriceResearchCandidate) {
  return candidate.sourceType === 'compras_gov_precos';
}

function isDirectSupplierPrice(candidate: PriceResearchCandidate) {
  return candidate.sourceType === 'custom';
}

function isInternetPrice(candidate: PriceResearchCandidate) {
  return !isOfficialPrice(candidate) && !isDirectSupplierPrice(candidate);
}

export function analyzePriceResearchCompliance(data: PriceResearchReportData): PriceResearchComplianceFinding[] {
  const findings: PriceResearchComplianceFinding[] = [];
  const researchDate = parseDate(data.researchDate) ?? new Date();

  const addFinding = (finding: Omit<PriceResearchComplianceFinding, 'id'>) => {
    findings.push({
      ...finding,
      id: [
        finding.severity,
        finding.scope,
        finding.itemId ?? 'research',
        finding.candidateId ?? '',
        findings.length + 1,
      ].filter(Boolean).join(':'),
    });
  };

  if (!data.objectDescription.trim()) {
    addFinding({
      severity: 'error',
      scope: 'research',
      ruleLabel: 'IN 65/2021, art. 3º, I',
      message: 'Descrição do objeto não informada.',
      evidence: 'Campo de objeto vazio.',
      recommendedAction: 'Informe a descrição do objeto a ser contratado antes de concluir a pesquisa.',
    });
  }
  if (!data.responsibleName.trim()) {
    addFinding({
      severity: 'error',
      scope: 'research',
      ruleLabel: 'IN 65/2021, art. 3º, II',
      message: 'Agente responsável não informado.',
      evidence: 'Campo de responsável vazio.',
      recommendedAction: 'Identifique o agente ou a equipe responsável pela pesquisa.',
    });
  }
  if (!data.methodologyJustification.trim()) {
    addFinding({
      severity: 'error',
      scope: 'research',
      ruleLabel: 'IN 65/2021, art. 3º, V e VI',
      message: 'Justificativa da metodologia não preenchida.',
      evidence: `Método selecionado: ${METHOD_LABELS[data.method]}.`,
      recommendedAction: 'Registre por que o método estatístico escolhido é adequado para a cesta de preços.',
    });
  }
  if (data.items.length === 0) {
    addFinding({
      severity: 'error',
      scope: 'research',
      ruleLabel: 'IN 65/2021, art. 3º, III, IV e VII',
      message: 'Nenhum item importado para formar série de preços e memória de cálculo.',
      evidence: 'A pesquisa não possui itens.',
      recommendedAction: 'Importe ao menos um item e realize a coleta de preços antes de concluir.',
    });
  }

  const allCandidates = data.items.flatMap((item) => item.candidates);
  if (data.items.length > 0 && allCandidates.length === 0) {
    addFinding({
      severity: 'error',
      scope: 'research',
      ruleLabel: 'IN 65/2021, art. 3º, III, IV e VII',
      message: 'Fontes consultadas e série de preços não registradas.',
      evidence: 'Nenhuma cotação foi associada aos itens da pesquisa.',
      recommendedAction: 'Execute a busca oficial ou registre cotações válidas antes de gerar o relatório.',
    });
  }

  for (const item of data.items) {
    const selected = item.candidates.filter((candidate) => candidate.selected);
    const statistics = getSelectedStatistics(item);
    const selectedOfficial = selected.filter(isOfficialPrice);
    const selectedInternet = selected.filter(isInternetPrice);
    const selectedDirectSupplier = selected.filter(isDirectSupplierPrice);
    const selectedPrices = selected.map((candidate) => candidate.monetaryAdjustedPrice ?? candidate.comparableUnitPrice).filter((value) => value > 0);
    const selectedMedian = selectedPrices.length > 0 ? median(selectedPrices) : 0;

    if (!item.catalogCode) {
      addFinding({
        severity: 'error',
        scope: 'item',
        itemId: item.localId,
        itemNumber: item.itemNumber,
        ruleLabel: 'IN 65/2021, art. 3º, VII',
        message: `Item ${item.itemNumber}: código CATMAT/CATSER ausente.`,
        evidence: 'O item não possui código de catálogo confirmado.',
        recommendedAction: 'Confirme um CATMAT/CATSER antes de consultar e documentar os preços.',
      });
    }

    if (item.searchStatus === 'idle' && item.catalogCode) {
      addFinding({
        severity: 'error',
        scope: 'item',
        itemId: item.localId,
        itemNumber: item.itemNumber,
        ruleLabel: 'IN 65/2021, art. 5º, I e II',
        message: `Item ${item.itemNumber}: busca oficial não executada.`,
        evidence: `CATMAT/CATSER ${item.catalogCode} informado sem coleta oficial registrada.`,
        recommendedAction: 'Execute a busca de preços oficiais para priorizar sistemas oficiais e contratações públicas.',
      });
    }

    if (item.candidates.length === 0) {
      addFinding({
        severity: 'error',
        scope: 'item',
        itemId: item.localId,
        itemNumber: item.itemNumber,
        ruleLabel: 'IN 65/2021, art. 3º, III e IV',
        message: `Item ${item.itemNumber}: nenhuma fonte de preço registrada.`,
        evidence: 'O item não possui cotações candidatas.',
        recommendedAction: 'Colete preços para formar a série de preços do item.',
      });
    }

    if (selected.length === 0 && item.candidates.length > 0) {
      addFinding({
        severity: 'error',
        scope: 'item',
        itemId: item.localId,
        itemNumber: item.itemNumber,
        ruleLabel: 'IN 65/2021, art. 3º, IV e VII',
        message: `Item ${item.itemNumber}: nenhum preço selecionado para a memória de cálculo.`,
        evidence: `${item.candidates.length} cotação(ões) disponível(is), nenhuma selecionada.`,
        recommendedAction: 'Selecione preços comparáveis ou registre as justificativas de exclusão.',
      });
    }

    if (selected.length > 0 && selected.length < 3 && !hasMeaningfulJustification(data.notes)) {
      addFinding({
        severity: 'error',
        scope: 'item',
        itemId: item.localId,
        itemNumber: item.itemNumber,
        ruleLabel: 'IN 65/2021, art. 6º, caput e § 5º',
        message: `Item ${item.itemNumber}: menos de três preços selecionados sem justificativa excepcional.`,
        evidence: `${selected.length} preço(s) selecionado(s).`,
        recommendedAction: 'Selecione ao menos três preços ou registre justificativa excepcional nas observações.',
      });
    }

    const exclusionsWithoutReason = item.candidates.filter(
      (candidate) => !candidate.selected && !candidate.exclusionReason.trim(),
    );
    if (exclusionsWithoutReason.length > 0) {
      addFinding({
        severity: 'error',
        scope: 'item',
        itemId: item.localId,
        itemNumber: item.itemNumber,
        ruleLabel: 'IN 65/2021, art. 3º, VI e art. 6º, § 3º',
        message: `Item ${item.itemNumber}: preços excluídos sem justificativa.`,
        evidence: `${exclusionsWithoutReason.length} cotação(ões) desconsiderada(s) sem motivo registrado.`,
        recommendedAction: 'Justifique cada desconsideração de valor inexequível, inconsistente ou excessivamente elevado.',
      });
    }

    if (selected.length > 0 && selectedOfficial.length === 0 && !hasMeaningfulJustification(data.notes)) {
      addFinding({
        severity: 'warning',
        scope: 'item',
        itemId: item.localId,
        itemNumber: item.itemNumber,
        ruleLabel: 'IN 65/2021, art. 5º, § 1º',
        message: `Item ${item.itemNumber}: sistemas oficiais ou contratações públicas não foram priorizados.`,
        evidence: 'A cesta selecionada usa apenas internet ou fornecedores diretos.',
        recommendedAction: 'Registre a impossibilidade de usar sistemas oficiais/contratações públicas ou inclua fontes oficiais.',
      });
    }

    if (selectedOfficial.length === selected.length && selected.length > 0) {
      const estimatedUnitPrice = getEstimatedUnitPrice(item, data.method);
      if (statistics.median > 0 && estimatedUnitPrice > statistics.median) {
        addFinding({
          severity: 'error',
          scope: 'item',
          itemId: item.localId,
          itemNumber: item.itemNumber,
          ruleLabel: 'IN 65/2021, art. 6º, § 6º',
          message: `Item ${item.itemNumber}: preço estimado acima da mediana em base composta somente por sistema oficial.`,
          evidence: `Estimado ${formatCurrency(estimatedUnitPrice)}; mediana ${formatCurrency(statistics.median)}.`,
          recommendedAction: 'Use valor menor ou igual à mediana, ou complemente a cesta com outros parâmetros válidos e justifique.',
        });
      }
    }

    if (statistics.count >= 3 && statistics.coefficientOfVariation > 25) {
      addFinding({
        severity: 'warning',
        scope: 'item',
        itemId: item.localId,
        itemNumber: item.itemNumber,
        ruleLabel: 'IN 65/2021, art. 6º, § 4º',
        message: statistics.coefficientOfVariation > 50
          ? `Item ${item.itemNumber}: variação crítica entre os preços selecionados.`
          : `Item ${item.itemNumber}: grande variação entre os preços selecionados.`,
        evidence: `Coeficiente de variação de ${statistics.coefficientOfVariation.toFixed(2)}%.`,
        recommendedAction: 'Revise a comparabilidade da cesta e justifique a manutenção ou exclusão dos valores extremos.',
      });
    }

    for (const candidate of selected) {
      const candidateDate = parseDate(candidate.resultDate || candidate.purchaseDate);
      const candidateLabel = candidate.sourceLabel || candidate.purchaseItemId || candidate.id;
      const candidatePrice = candidate.monetaryAdjustedPrice ?? candidate.comparableUnitPrice;

      if (!candidate.unitCompatible) {
        addFinding({
          severity: 'error',
          scope: 'candidate',
          itemId: item.localId,
          itemNumber: item.itemNumber,
          candidateId: candidate.id,
          ruleLabel: 'IN 65/2021, art. 4º e art. 6º, § 4º',
          message: `Item ${item.itemNumber}: preço com unidade incompatível foi selecionado.`,
          evidence: `${candidateLabel}; unidade original ${candidate.originalUnitLabel}.`,
          recommendedAction: 'Desmarque a cotação ou registre conversão/comparabilidade verificável.',
        });
      }

      if (isOfficialPrice(candidate)) {
        if (!candidateDate) {
          addFinding({
            severity: 'error',
            scope: 'candidate',
            itemId: item.localId,
            itemNumber: item.itemNumber,
            candidateId: candidate.id,
            ruleLabel: 'IN 65/2021, art. 5º, II',
            message: `Item ${item.itemNumber}: preço oficial selecionado sem data rastreável.`,
            evidence: `${candidateLabel}; compra ${candidate.purchaseId || '-'}.`,
            recommendedAction: 'Use referência com data de compra/resultado ou substitua a cotação.',
          });
        } else if (differenceInDays(researchDate, candidateDate) > 365) {
          addFinding({
            severity: 'error',
            scope: 'candidate',
            itemId: item.localId,
            itemNumber: item.itemNumber,
            candidateId: candidate.id,
            ruleLabel: 'IN 65/2021, art. 5º, II',
            message: `Item ${item.itemNumber}: preço oficial fora do período de até 1 ano.`,
            evidence: `${candidateLabel}; data ${formatDate(candidateDate.toISOString())}.`,
            recommendedAction: 'Substitua por contratação similar dentro da janela normativa ou registre justificativa excepcional aplicável.',
          });
        }
      }

      if (isInternetPrice(candidate)) {
        const evidenceDate = parseDate(candidate.evidenceCapturedAt || candidate.resultDate || candidate.purchaseDate);
        if (!evidenceDate) {
          addFinding({
            severity: 'error',
            scope: 'candidate',
            itemId: item.localId,
            itemNumber: item.itemNumber,
            candidateId: candidate.id,
            ruleLabel: 'IN 65/2021, art. 5º, III',
            message: `Item ${item.itemNumber}: fonte de internet sem data/hora de acesso.`,
            evidence: `${candidateLabel}; URL ${candidate.sourceUrl || '-'}.`,
            recommendedAction: 'Capture evidência com data/hora de acesso ou remova a cotação da cesta.',
          });
        } else if (differenceInDays(researchDate, evidenceDate) > 183) {
          addFinding({
            severity: 'error',
            scope: 'candidate',
            itemId: item.localId,
            itemNumber: item.itemNumber,
            candidateId: candidate.id,
            ruleLabel: 'IN 65/2021, art. 5º, III',
            message: `Item ${item.itemNumber}: fonte de internet com mais de 6 meses.`,
            evidence: `${candidateLabel}; data ${formatDate(evidenceDate.toISOString())}.`,
            recommendedAction: 'Atualize a captura ou substitua por referência dentro da janela de 6 meses.',
          });
        }
      }

      if (isDirectSupplierPrice(candidate)) {
        if (!candidate.supplierName?.trim() || !candidate.supplierDocument?.trim() || !candidateDate) {
          addFinding({
            severity: 'error',
            scope: 'candidate',
            itemId: item.localId,
            itemNumber: item.itemNumber,
            candidateId: candidate.id,
            ruleLabel: 'IN 65/2021, art. 5º, § 2º, II',
            message: `Item ${item.itemNumber}: cotação direta com fornecedor sem dados mínimos.`,
            evidence: `Fornecedor ${candidate.supplierName || '-'}; CPF/CNPJ ${candidate.supplierDocument || '-'}; data ${candidate.purchaseDate || '-'}.`,
            recommendedAction: 'Informe fornecedor, CPF/CNPJ e data de emissão da proposta formal.',
          });
        }
        if (!hasMeaningfulJustification(data.notes)) {
          addFinding({
            severity: 'warning',
            scope: 'candidate',
            itemId: item.localId,
            itemNumber: item.itemNumber,
            candidateId: candidate.id,
            ruleLabel: 'IN 65/2021, art. 3º, VIII e art. 5º, IV',
            message: `Item ${item.itemNumber}: pesquisa direta com fornecedor sem justificativa de escolha registrada.`,
            evidence: `Fornecedor ${candidate.supplierName || '-'}.`,
            recommendedAction: 'Registre nas observações a justificativa da escolha dos fornecedores consultados.',
          });
        }
      }

      if (
        selectedMedian > 0 &&
        (candidatePrice > selectedMedian * 1.5 || candidatePrice < selectedMedian * 0.5) &&
        !hasMeaningfulJustification(data.notes)
      ) {
        addFinding({
          severity: 'warning',
          scope: 'candidate',
          itemId: item.localId,
          itemNumber: item.itemNumber,
          candidateId: candidate.id,
          ruleLabel: 'IN 65/2021, art. 6º, § 3º e § 4º',
          message: `Item ${item.itemNumber}: preço selecionado muito distante da mediana sem justificativa.`,
          evidence: `${candidateLabel}; preço ${formatCurrency(candidatePrice)}; mediana ${formatCurrency(selectedMedian)}.`,
          recommendedAction: 'Justifique a manutenção do preço ou desconsidere o valor extremo com critério fundamentado.',
        });
      }
    }
  }

  return findings;
}

export function validatePriceResearchReport(data: PriceResearchReportData) {
  return analyzePriceResearchCompliance(data)
    .filter((finding) => finding.severity === 'error')
    .map((finding) => finding.message);
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
}

export function buildPriceResearchReportHtml(data: PriceResearchReportData, options: PriceResearchAuthenticationOptions = {}) {
  const managementSummary = buildPriceResearchManagementSummary(data);
  const abcRows = buildPriceResearchAbcCurve(data);
  const comparisonRows = buildPriceResearchComparisonMap(data);
  const reportServers = (data.reportServers ?? []).filter((server) => server.name.trim());
  const institutionHeader = `
    <div class="report-header">
      ${data.institutionLogo ? `<img class="institution-logo" src="${escapeHtml(data.institutionLogo)}" alt="Logotipo da instituicao" />` : ''}
      <div>
        <div class="institution-name">${escapeHtml(data.institutionName || 'Instituicao nao informada')}</div>
        ${data.institutionUnit ? `<div class="institution-unit">${escapeHtml(data.institutionUnit)}</div>` : ''}
        ${data.institutionDetails ? `<div class="institution-details">${escapeHtml(data.institutionDetails).replace(/\n/g, '<br />')}</div>` : ''}
      </div>
    </div>
  `;
  const serverRows = reportServers.map((server) => `
    <tr>
      <td>${escapeHtml(server.name)}</td>
      <td>${escapeHtml(server.role || '-')}</td>
      <td>${escapeHtml(server.registration || '-')}</td>
      <td>${escapeHtml(server.email || '-')}</td>
    </tr>
  `).join('');
  const authentication = buildPriceResearchAuthenticationPayload(options.authenticationData ?? data, {
    origin: typeof window !== 'undefined' ? window.location.origin : '',
    ...options,
    authenticationData: undefined,
  });
  const summaryRows = [
    ['Itens', managementSummary.itemsCount],
    ['Cotacoes selecionadas', managementSummary.selectedQuotesCount],
    ['Cotacoes excluidas', managementSummary.excludedQuotesCount],
    ['Fontes oficiais', managementSummary.officialQuotesCount],
    ['Pesquisa de mercado', managementSummary.marketQuotesCount],
    ['Fornecedores locais', managementSummary.localQuotesCount],
    ['Classe A', managementSummary.abcClassTotals.A],
    ['Estimativa geral', formatCurrency(managementSummary.estimatedTotal)],
  ].map(([label, value]) => `
    <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
  `).join('');

  const abcHtmlRows = abcRows.map((row) => `
    <tr>
      <td>${escapeHtml(row.itemNumber)}</td>
      <td>${escapeHtml(row.description)}</td>
      <td class="number">${formatCurrency(row.estimatedUnitPrice)}</td>
      <td class="number">${formatCurrency(row.estimatedTotal)}</td>
      <td class="number">${row.participationPercentage.toFixed(2)}%</td>
      <td class="number">${row.accumulatedPercentage.toFixed(2)}%</td>
      <td><strong>${row.abcClass}</strong></td>
    </tr>
  `).join('');

  const comparisonHtmlRows = comparisonRows.map((row) => `
    <tr>
      <td>${escapeHtml(row.itemNumber)}</td>
      <td>${escapeHtml(row.source)}</td>
      <td>${escapeHtml(row.supplier)}</td>
      <td>${escapeHtml(row.agency)}</td>
      <td>${escapeHtml([row.municipality, row.state].filter((entry) => entry && entry !== '-').join(' / ') || '-')}</td>
      <td>${formatDate(row.purchaseDate)}</td>
      <td>${row.selected ? 'Selecionada' : 'Excluida'}</td>
      <td class="number">${formatCurrency(row.unitPrice)}</td>
      <td class="number">${formatCurrency(row.estimatedUnitPrice)}</td>
      <td class="number">${row.deviationPercentage.toFixed(2)}%</td>
      <td>${escapeHtml(row.exclusionReason || '-')}</td>
    </tr>
  `).join('');

  const itemSections = data.items.map((item) => {
    const selected = item.candidates.filter((candidate) => candidate.selected);
    const excluded = item.candidates.filter((candidate) => !candidate.selected);
    const statistics = getSelectedStatistics(item);
    const estimatedUnitPrice = getEstimatedUnitPrice(item, data.method);
    const estimatedTotal = estimatedUnitPrice * item.quantity;

    const selectedRows = selected.map((candidate, index) => {
      const adjustedPrice = candidate.monetaryAdjustedPrice ?? candidate.comparableUnitPrice;
      const dev = estimatedUnitPrice > 0 ? ((adjustedPrice - estimatedUnitPrice) / estimatedUnitPrice) * 100 : 0;
      const devStr = dev > 0 ? `+${dev.toFixed(1)}%` : `${dev.toFixed(1)}%`;
      
      let adjustmentInfo = 'Sem reajuste';
      if (candidate.monetaryAdjustmentEnabled) {
        if (candidate.monetaryAdjustmentIndex === 'manual') {
          adjustmentInfo = `Manual (${candidate.monetaryAdjustmentManualRate ?? 0}%)`;
        } else {
          adjustmentInfo = `${candidate.monetaryAdjustmentIndex} (Fator: ${(candidate.monetaryAdjustmentFactor ?? 1).toFixed(4)})`;
        }
      }

      let agencyColHtml = '';
      let sourceColHtml = '';

      if (candidate.sourceType === 'compras_gov_precos') {
        agencyColHtml = escapeHtml(
          [candidate.agencyCode, candidate.agencyName].filter(Boolean).join(' - ') || '-'
        );
        sourceColHtml = `
          ${escapeHtml(candidate.purchaseId)} / item ${escapeHtml(candidate.purchaseItemId)}<br />
          <a href="${escapeHtml(candidate.sourceUrl)}" target="_blank" rel="noopener noreferrer">Fonte oficial</a>
          ${candidate.pncpSearchUrl ? ` | <a href="${escapeHtml(candidate.pncpSearchUrl)}" target="_blank" rel="noopener noreferrer">PNCP</a>` : ''}
        `;
      } else if (candidate.sourceType === 'custom') {
        agencyColHtml = `<strong>Fornecedor Local</strong>${candidate.supplierDocument ? `<br /><span style="font-size: 8px; color: #555;">CNPJ/CPF: ${escapeHtml(candidate.supplierDocument)}</span>` : ''}`;
        sourceColHtml = `Cotação direta (Física/E-mail)`;
      } else {
        agencyColHtml = `<strong>Internet</strong><br /><span style="font-size: 9px; color: #555;">${escapeHtml(candidate.agencyName || candidate.sourceLabel)}</span>`;
        sourceColHtml = `
          Pesquisa de Mercado (Internet)<br />
          ${candidate.sourceUrl ? `<a href="${escapeHtml(candidate.sourceUrl)}" target="_blank" rel="noopener noreferrer">Acessar link da oferta</a>` : ''}
        `;
      }

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${agencyColHtml}</td>
          <td>${escapeHtml(candidate.supplierName || '-')}</td>
          <td>${sourceColHtml}</td>
          <td>${formatDate(candidate.resultDate || candidate.purchaseDate)}</td>
          <td>${escapeHtml(candidate.originalUnitLabel)}</td>
          <td class="number">${formatCurrency(candidate.originalUnitPrice)}</td>
          <td class="number">${formatCurrency(candidate.comparableUnitPrice)}</td>
          <td>${escapeHtml(adjustmentInfo)}</td>
          <td class="number font-bold">${formatCurrency(adjustedPrice)}</td>
          <td class="number font-bold text-primary">${devStr}</td>
          <td>${escapeHtml(candidate.aiReason)}</td>
        </tr>
      `;
    }).join('');

    const excludedRows = excluded.map((candidate) => {
      let sourceName = '-';
      if (candidate.sourceType === 'compras_gov_precos') {
        sourceName = [candidate.agencyCode, 'Oficial'].filter(Boolean).join(' - ') || 'Oficial';
      } else if (candidate.sourceType === 'custom') {
        sourceName = 'Fornecedor Local';
      } else {
        sourceName = `Internet (${candidate.sourceLabel})`;
      }
      return `
        <tr>
          <td>${escapeHtml(sourceName)}</td>
          <td class="number">${formatCurrency(candidate.comparableUnitPrice)}</td>
          <td>${escapeHtml(candidate.exclusionReason || 'Sem justificativa registrada')}</td>
        </tr>
      `;
    }).join('');

    return `
      <section>
        <h2>Item ${escapeHtml(item.itemNumber)} - ${escapeHtml(item.description)}</h2>
        <p><strong>Catálogo:</strong> ${item.catalogType === 'material' ? 'CATMAT' : 'CATSER'} ${escapeHtml(item.catalogCode)}
          | <strong>Quantidade:</strong> ${escapeHtml(item.quantity)} ${escapeHtml(item.unit)}
          | <strong>Unidade comparável:</strong> ${escapeHtml(item.targetCapacity || 1)} ${escapeHtml(item.targetMeasureUnit || item.unit)}</p>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Órgão/UASG</th><th>Fornecedor</th><th>Compra e fonte</th><th>Data</th><th>Unidade original</th>
              <th>Preço original</th><th>Preço comparável</th><th>Ajuste monetário</th><th>Preço ajustado</th><th>Divergência</th><th>Análise de aderência</th>
            </tr>
          </thead>
          <tbody>${selectedRows || '<tr><td colspan="12">Nenhum preço selecionado.</td></tr>'}</tbody>
        </table>
        <div class="summary">
          <div><span>Amostra</span><strong>${statistics.count}</strong></div>
          <div><span>Média</span><strong>${formatCurrency(statistics.mean)}</strong></div>
          <div><span>Mediana</span><strong>${formatCurrency(statistics.median)}</strong></div>
          <div><span>Menor</span><strong>${formatCurrency(statistics.minimum)}</strong></div>
          <div><span>CV</span><strong>${statistics.coefficientOfVariation.toFixed(2)}%</strong></div>
          <div><span>Amplitude Div.</span><strong>${statistics.amplitudeDivergence.toFixed(2)}%</strong></div>
          <div><span>Preço estimado</span><strong>${formatCurrency(estimatedUnitPrice)}</strong></div>
          <div><span>Total estimado</span><strong>${formatCurrency(estimatedTotal)}</strong></div>
        </div>
        ${excluded.length > 0 ? `
          <h3>Preços desconsiderados</h3>
          <table>
            <thead><tr><th>Referência</th><th>Preço comparável</th><th>Justificativa</th></tr></thead>
            <tbody>${excludedRows}</tbody>
          </table>
        ` : ''}
      </section>
    `;
  }).join('');

  // Pré-gera a seção de evidências de forma limpa, evitando código complexo dentro do template string principal
  const evidenceSections = data.items
    .map((item) => {
      const selectedWithEvidence = item.candidates.filter(
        (c) =>
          c.selected &&
          c.sourceType !== 'compras_gov_precos' &&
          c.evidenceImage &&
          (c.evidenceImage.startsWith('http') || c.evidenceImage.startsWith('data:'))
      );
      if (selectedWithEvidence.length === 0) return '';

      const evidencesHtml = selectedWithEvidence
        .map((c) => {
          const captureDate = c.evidenceCapturedAt || c.resultDate || new Date().toISOString();
          let formattedDate = 'Data indisponível';
          try {
            formattedDate = new Date(captureDate).toLocaleString('pt-BR', {
              dateStyle: 'short',
              timeStyle: 'short',
            });
          } catch (e) {
            formattedDate = String(captureDate);
          }

          return `
            <div style="page-break-inside: avoid; padding: 12px 0; border-bottom: 1px dashed #ddd; margin-bottom: 16px;">
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 10px;">
                <tr>
                  <td style="padding: 4px 8px; background: #f0f7f0; border: 1px solid #c8e0c8; width: 120px; color: #444; font-weight: bold;">Fonte</td>
                  <td style="padding: 4px 8px; border: 1px solid #ddd;">${escapeHtml(c.sourceLabel)}</td>
                  <td style="padding: 4px 8px; background: #f0f7f0; border: 1px solid #c8e0c8; width: 120px; color: #444; font-weight: bold;">Preço unitário</td>
                  <td style="padding: 4px 8px; border: 1px solid #ddd; font-weight: bold;">${formatCurrency(c.originalUnitPrice)}</td>
                </tr>
                ${
                  c.freightCost != null && c.freightCost > 0
                    ? `
                <tr>
                  <td style="padding: 4px 8px; background: #f0f7f0; border: 1px solid #c8e0c8; color: #444; font-weight: bold;">Frete</td>
                  <td style="padding: 4px 8px; border: 1px solid #ddd;">${formatCurrency(c.freightCost)}</td>
                  <td style="padding: 4px 8px; background: #f0f7f0; border: 1px solid #c8e0c8; color: #444; font-weight: bold;">Preço + Frete</td>
                  <td style="padding: 4px 8px; border: 1px solid #ddd; font-weight: bold; color: #1f6f32;">${formatCurrency(c.comparableUnitPrice)}</td>
                </tr>`
                    : ''
                }
                <tr>
                  <td style="padding: 4px 8px; background: #f0f7f0; border: 1px solid #c8e0c8; color: #444; font-weight: bold;">URL</td>
                  <td colspan="3" style="padding: 4px 8px; border: 1px solid #ddd; word-break: break-all;">
                    <a href="${escapeHtml(c.sourceUrl)}" style="color:#1f5e9c; text-decoration: none; font-size: 9px;">${escapeHtml(c.sourceUrl)}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 8px; background: #f0f7f0; border: 1px solid #c8e0c8; color: #444; font-weight: bold;">Data captura</td>
                  <td colspan="3" style="padding: 4px 8px; border: 1px solid #ddd; color: #555; font-size: 9px;">${formattedDate}</td>
                </tr>
              </table>
              <div style="border: 1px solid #ccc; background: white; border-radius: 4px; padding: 4px; text-align: center;">
                <img src="${c.evidenceImage}" alt="Evidência ${escapeHtml(c.sourceLabel)}" style="width: 100%; max-height: 280px; object-fit: contain;" />
              </div>
            </div>
          `;
        })
        .join('');

      return `
        <div style="margin-bottom: 8px;">
          <h2 style="font-size: 12px; color: #1f6f32; margin-bottom: 12px; border-bottom: 1px dashed #ddd; padding-bottom: 4px;">Item ${escapeHtml(item.itemNumber)} — ${escapeHtml(item.description)}</h2>
          ${evidencesHtml}
        </div>
      `;
    })
    .join('');

  return `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(data.title || 'Relatório de Pesquisa de Preços')}</title>
      <style>
        @page { size: A4 landscape; margin: 14mm; }
        body { font-family: Arial, sans-serif; color: #222; font-size: 10px; line-height: 1.45; }
        h1 { font-size: 20px; margin: 0 0 4px; color: #1f6f32; }
        h2 { font-size: 14px; margin: 24px 0 8px; color: #1f6f32; }
        h3 { font-size: 12px; margin: 16px 0 6px; }
        .report-header { display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: center; border-bottom: 2px solid #1f6f32; padding-bottom: 10px; margin-bottom: 12px; }
        .institution-logo { width: 82px; max-height: 82px; object-fit: contain; }
        .institution-name { font-size: 16px; font-weight: 700; color: #1f6f32; }
        .institution-unit { margin-top: 2px; font-size: 12px; font-weight: 700; color: #333; }
        .institution-details { margin-top: 4px; font-size: 10px; color: #555; line-height: 1.35; }
        .meta { border: 1px solid #d9dfd9; background: #f6faf6; padding: 10px; margin: 12px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #d7d7d7; padding: 5px; vertical-align: top; }
        th { background: #edf6ef; text-align: left; }
        .number { text-align: right; white-space: nowrap; }
        .summary { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; margin-top: 8px; }
        .summary div { border: 1px solid #d9dfd9; padding: 6px; }
        .summary span { display: block; color: #666; font-size: 9px; }
        .summary strong { display: block; margin-top: 2px; }
        .footer { margin-top: 24px; border-top: 1px solid #ccc; padding-top: 8px; color: #555; }
        .auth { display: grid; grid-template-columns: 1fr 190px; gap: 16px; align-items: center; border: 1px solid #d9dfd9; background: #fbfdfb; padding: 12px; margin: 12px 0; }
        .auth img { width: 160px; height: 160px; object-fit: contain; }
        .hash { font-family: monospace; word-break: break-all; }
        a { color: #1f5e9c; }
      </style>
    </head>
    <body>
      ${institutionHeader}
      <h1>${escapeHtml(data.title || 'Relatório de Pesquisa de Preços')}</h1>
      <p>Pesquisa elaborada conforme a Lei nº 14.133/2021 e a IN SEGES/ME nº 65/2021.</p>
      <div class="meta">
        <strong>Objeto:</strong> ${escapeHtml(data.objectDescription)}<br />
        <strong>Processo:</strong> ${escapeHtml(data.processNumber || '-')}<br />
        <strong>Responsável:</strong> ${escapeHtml(data.responsibleName)}<br />
        <strong>Data da pesquisa:</strong> ${formatDate(data.researchDate)}<br />
        <strong>Arquivo de origem:</strong> ${escapeHtml(data.sourceFile || '-')}<br />
        <strong>Método estatístico:</strong> ${METHOD_LABELS[data.method]}<br />
        <strong>Justificativa da metodologia:</strong> ${escapeHtml(data.methodologyJustification || 'Método aplicado sobre a série de preços comparáveis selecionados após análise crítica.')}
      </div>
      <p><strong>Caracterização das fontes:</strong> preços homologados disponibilizados pela API oficial de Pesquisa de Preços do Compras.gov.br, com rastreabilidade por compra, item, órgão, UASG, fornecedor e data. O PNCP é apresentado como consulta complementar quando disponível.</p>
      <section>
        <h2>Servidores responsaveis e equipe de apoio</h2>
        <table>
          <thead><tr><th>Nome</th><th>Funcao no processo</th><th>Matricula/SIAPE</th><th>E-mail</th></tr></thead>
          <tbody>${serverRows || '<tr><td colspan="4">Nenhum servidor adicional informado.</td></tr>'}</tbody>
        </table>
      </section>
      <div class="auth">
        <div>
          <h2 style="margin-top:0">Autenticação do relatório</h2>
          <p>Acesse este QR Code para verificar a autenticidade deste relatório</p>
          <p><strong>Hash:</strong> <span class="hash">${escapeHtml(authentication.snapshotHash)}</span></p>
          <p><strong>Gerado em:</strong> ${escapeHtml(new Date(authentication.generatedAt).toLocaleString('pt-BR'))}<br />
          <strong>Versao:</strong> ${escapeHtml(authentication.reportVersion)}<br />
          <strong>URL:</strong> <a href="${escapeHtml(authentication.verificationUrl)}">${escapeHtml(authentication.verificationUrl)}</a></p>
        </div>
        <div style="text-align:center">
          <img src="${escapeHtml(authentication.qrCodeUrl)}" alt="QR Code de autenticacao do relatorio" />
        </div>
      </div>
      <section>
        <h2>Relatorio gerencial consolidado</h2>
        <div class="summary">${summaryRows}</div>
      </section>
      ${itemSections}
      <section>
        <h2>Curva ABC</h2>
        <table>
          <thead>
            <tr>
              <th>Item</th><th>Descricao</th><th>Preco estimado</th><th>Total estimado</th><th>Participacao</th><th>Acumulado</th><th>Classe</th>
            </tr>
          </thead>
          <tbody>${abcHtmlRows || '<tr><td colspan="7">Nenhum item calculado.</td></tr>'}</tbody>
        </table>
      </section>
      <section>
        <h2>Mapa comparativo</h2>
        <table>
          <thead>
            <tr>
              <th>Item</th><th>Fonte</th><th>Fornecedor</th><th>Orgao/UASG</th><th>Localidade</th><th>Data</th><th>Status</th><th>Preco</th><th>Estimado</th><th>Divergencia</th><th>Justificativa</th>
            </tr>
          </thead>
          <tbody>${comparisonHtmlRows || '<tr><td colspan="11">Nenhuma cotacao disponivel.</td></tr>'}</tbody>
        </table>
      </section>
      <div class="footer">
        <strong>Observações:</strong> ${escapeHtml(data.notes || 'Sem observações adicionais.')}<br />
        A classificação assistida por IA apenas ordena a aderência descritiva. A seleção, as exclusões e o método de cálculo permanecem sob responsabilidade do agente público.
      </div>
      ${
        data.items.some((item) => item.candidates.some((c) => c.selected && c.sourceType !== 'compras_gov_precos' && c.evidenceImage && (c.evidenceImage.startsWith('http') || c.evidenceImage.startsWith('data:'))))
          ? `
          <div style="page-break-before: always; margin-top: 30px;">
            <h1 style="border-bottom: 2px solid #1f6f32; padding-bottom: 6px; font-size: 16px; color: #1f6f32; margin-top: 0;">Anexo I — Evidências de Preços</h1>
            <p style="font-size: 10px; color: #555; margin-bottom: 20px;">Capturas de tela das cotações que compõem a cesta de preços como prova de conformidade legal (Instrução Normativa ME nº 65/2021).</p>
            ${evidenceSections}
          </div>
        `
          : ''
      }
    </body>
  </html>`;
}

export function createPriceResearchTemplate() {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['Item', 'Descrição', 'Quantidade', 'Unidade', 'CATMAT', 'CATSER', 'Capacidade', 'Unidade de medida', 'Custo unitário atual'],
    [1, 'Café torrado e moído, pacote de 500 g', 100, 'PCT', 606523, '', 500, 'G', ''],
    [2, 'Descrição do serviço', 12, 'MÊS', '', '00000', 1, 'MÊS', ''],
  ]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Itens');
  XLSX.writeFile(workbook, 'modelo-pesquisa-precos.xlsx');
}

export async function exportPriceResearchWorkbook(data: PriceResearchReportData, options: PriceResearchAuthenticationOptions = {}) {
  const managementSummary = buildPriceResearchManagementSummary(data);
  const abcRows = buildPriceResearchAbcCurve(data);
  const comparisonRows = buildPriceResearchComparisonMap(data);
  const authentication = buildPriceResearchAuthenticationPayload(data, {
    origin: typeof window !== 'undefined' ? window.location.origin : '',
    ...options,
  });
  const managementRows = [
    { Indicador: 'Itens', Valor: managementSummary.itemsCount },
    { Indicador: 'Cotacoes selecionadas', Valor: managementSummary.selectedQuotesCount },
    { Indicador: 'Cotacoes excluidas', Valor: managementSummary.excludedQuotesCount },
    { Indicador: 'Fontes oficiais', Valor: managementSummary.officialQuotesCount },
    { Indicador: 'Pesquisa de mercado', Valor: managementSummary.marketQuotesCount },
    { Indicador: 'Fornecedores locais', Valor: managementSummary.localQuotesCount },
    { Indicador: 'Itens classe A', Valor: managementSummary.abcClassTotals.A },
    { Indicador: 'Itens classe B', Valor: managementSummary.abcClassTotals.B },
    { Indicador: 'Itens classe C', Valor: managementSummary.abcClassTotals.C },
    { Indicador: 'Estimativa geral', Valor: managementSummary.estimatedTotal },
  ];
  const institutionRows = [
    { Campo: 'Instituicao', Valor: data.institutionName || '' },
    { Campo: 'Unidade/Setor', Valor: data.institutionUnit || '' },
    { Campo: 'Dados complementares', Valor: data.institutionDetails || '' },
    { Campo: 'Logotipo informado', Valor: data.institutionLogo ? 'Sim' : 'Nao' },
  ];
  const serverSheetRows = (data.reportServers ?? []).map((server) => ({
    Nome: server.name,
    Funcao: server.role,
    MatriculaSiape: server.registration,
    Email: server.email || '',
  }));
  const summaryRows = data.items.map((item) => {
    const stats = getSelectedStatistics(item);
    const estimatedUnitPrice = getEstimatedUnitPrice(item, data.method);
    return {
      Item: item.itemNumber,
      Descrição: item.description,
      Catálogo: item.catalogType === 'material' ? 'CATMAT' : 'CATSER',
      Código: item.catalogCode,
      Quantidade: item.quantity,
      Unidade: item.unit,
      'Preços selecionados': stats.count,
      Média: stats.mean,
      Mediana: stats.median,
      'Menor preço': stats.minimum,
      'Desvio padrão': stats.standardDeviation,
      'Coeficiente de variação (%)': stats.coefficientOfVariation,
      'Amplitude Divergência (%)': stats.amplitudeDivergence,
      Método: METHOD_LABELS[data.method],
      'Preço unitário estimado': estimatedUnitPrice,
      'Valor total estimado': estimatedUnitPrice * item.quantity,
    };
  });

  const quoteRows = data.items.flatMap((item) => {
    const estimatedPrice = getEstimatedUnitPrice(item, data.method);
    return item.candidates.map((candidate) => {
      const adjustedPrice = candidate.monetaryAdjustedPrice ?? candidate.comparableUnitPrice;
      const dev = estimatedPrice > 0 ? ((adjustedPrice - estimatedPrice) / estimatedPrice) * 100 : 0;
      return {
        Item: item.itemNumber,
        Selecionado: candidate.selected ? 'Sim' : 'Não',
        'Motivo da exclusão': candidate.exclusionReason,
        Fonte: candidate.sourceLabel,
        Compra: candidate.purchaseId,
        'Item da compra': candidate.purchaseItemId,
        Data: candidate.resultDate || candidate.purchaseDate,
        UASG: candidate.agencyCode,
        Órgão: candidate.agencyName,
        Fornecedor: candidate.supplierName,
        'CPF/CNPJ': candidate.supplierDocument,
        Descrição: candidate.description,
        'Unidade original': candidate.originalUnitLabel,
        'Preço original': candidate.originalUnitPrice,
        'Preço comparável': candidate.comparableUnitPrice,
        'Atualização Monetária Ativa': candidate.monetaryAdjustmentEnabled ? 'Sim' : 'Não',
        'Índice de Correção': candidate.monetaryAdjustmentIndex || '-',
        'Fator de Correção': candidate.monetaryAdjustmentFactor || 1,
        'Taxa Manual (%)': candidate.monetaryAdjustmentManualRate || 0,
        'Preço Ajustado': adjustedPrice,
        'Divergência (%)': dev,
        'Aderência IA': candidate.aiScore,
        'Justificativa IA': candidate.aiReason,
        'URL da fonte': candidate.sourceUrl,
        'Busca PNCP': candidate.pncpSearchUrl,
      };
    });
  });

  const abcSheetRows = abcRows.map((row) => ({
    Item: row.itemNumber,
    Descricao: row.description,
    Quantidade: row.quantity,
    'Preco unitario estimado': row.estimatedUnitPrice,
    'Valor total estimado': row.estimatedTotal,
    'Participacao (%)': row.participationPercentage,
    'Acumulado (%)': row.accumulatedPercentage,
    Classe: row.abcClass,
  }));

  const comparisonSheetRows = comparisonRows.map((row) => ({
    Item: row.itemNumber,
    Descricao: row.itemDescription,
    Fonte: row.source,
    Fornecedor: row.supplier,
    'Orgao/UASG': row.agency,
    UF: row.state,
    Municipio: row.municipality,
    Data: row.purchaseDate,
    Selecionado: row.selected ? 'Sim' : 'Nao',
    'Unidade compativel': row.unitCompatible ? 'Sim' : 'Nao',
    Preco: row.unitPrice,
    'Preco estimado': row.estimatedUnitPrice,
    'Divergencia (%)': row.deviationPercentage,
    'Justificativa de exclusao': row.exclusionReason,
  }));

  const authenticationRows = [
    { Campo: 'Hash do snapshot', Valor: authentication.snapshotHash },
    { Campo: 'URL de verificacao', Valor: authentication.verificationUrl },
    { Campo: 'QR Code', Valor: authentication.qrCodeUrl },
    { Campo: 'Gerado em', Valor: authentication.generatedAt },
    { Campo: 'Versao do relatorio', Valor: authentication.reportVersion },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(institutionRows), 'Instituicao');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(serverSheetRows), 'Servidores');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(managementRows), 'Gerencial');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Resumo');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(abcSheetRows), 'Curva ABC');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(comparisonSheetRows), 'Mapa Comparativo');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(quoteRows), 'Cotações');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(authenticationRows), 'Autenticacao');
  XLSX.writeFile(workbook, 'relatorio-pesquisa-precos.xlsx');
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function rowsToCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  return [
    headers.map(csvEscape).join(';'),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(';')),
  ].join('\r\n');
}

function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportPriceResearchHtml(data: PriceResearchReportData, options: PriceResearchAuthenticationOptions = {}) {
  downloadTextFile(
    'relatorio-pesquisa-precos.html',
    buildPriceResearchReportHtml(data, options),
    'text/html;charset=utf-8',
  );
}

export function exportPriceResearchCsvBundle(data: PriceResearchReportData, options: PriceResearchAuthenticationOptions = {}) {
  const managementSummary = buildPriceResearchManagementSummary(data);
  const managementRows = [
    { Indicador: 'Itens', Valor: managementSummary.itemsCount },
    { Indicador: 'Cotacoes selecionadas', Valor: managementSummary.selectedQuotesCount },
    { Indicador: 'Cotacoes excluidas', Valor: managementSummary.excludedQuotesCount },
    { Indicador: 'Fontes oficiais', Valor: managementSummary.officialQuotesCount },
    { Indicador: 'Pesquisa de mercado', Valor: managementSummary.marketQuotesCount },
    { Indicador: 'Fornecedores locais', Valor: managementSummary.localQuotesCount },
    { Indicador: 'Itens classe A', Valor: managementSummary.abcClassTotals.A },
    { Indicador: 'Itens classe B', Valor: managementSummary.abcClassTotals.B },
    { Indicador: 'Itens classe C', Valor: managementSummary.abcClassTotals.C },
    { Indicador: 'Estimativa geral', Valor: managementSummary.estimatedTotal },
  ];
  const institutionRows = [
    { Campo: 'Instituicao', Valor: data.institutionName || '' },
    { Campo: 'Unidade/Setor', Valor: data.institutionUnit || '' },
    { Campo: 'Dados complementares', Valor: data.institutionDetails || '' },
    { Campo: 'Logotipo informado', Valor: data.institutionLogo ? 'Sim' : 'Nao' },
  ];
  const serverRows = (data.reportServers ?? []).map((server) => ({
    Nome: server.name,
    Funcao: server.role,
    MatriculaSiape: server.registration,
    Email: server.email || '',
  }));
  const summaryRows = data.items.map((item) => {
    const stats = getSelectedStatistics(item);
    const estimatedUnitPrice = getEstimatedUnitPrice(item, data.method);
    return {
      Item: item.itemNumber,
      Descricao: item.description,
      Catalogo: item.catalogType === 'material' ? 'CATMAT' : 'CATSER',
      Codigo: item.catalogCode,
      Quantidade: item.quantity,
      Unidade: item.unit,
      PrecosSelecionados: stats.count,
      Media: stats.mean,
      Mediana: stats.median,
      MenorPreco: stats.minimum,
      DesvioPadrao: stats.standardDeviation,
      CoeficienteVariacaoPercentual: stats.coefficientOfVariation,
      Metodo: METHOD_LABELS[data.method],
      PrecoUnitarioEstimado: estimatedUnitPrice,
      ValorTotalEstimado: estimatedUnitPrice * item.quantity,
    };
  });
  const quoteRows = data.items.flatMap((item) => {
    const estimatedPrice = getEstimatedUnitPrice(item, data.method);
    return item.candidates.map((candidate) => {
      const adjustedPrice = candidate.monetaryAdjustedPrice ?? candidate.comparableUnitPrice;
      return {
        Item: item.itemNumber,
        Selecionado: candidate.selected ? 'Sim' : 'Nao',
        MotivoExclusao: candidate.exclusionReason,
        Fonte: candidate.sourceLabel,
        Compra: candidate.purchaseId,
        ItemCompra: candidate.purchaseItemId,
        Data: candidate.resultDate || candidate.purchaseDate,
        UASG: candidate.agencyCode,
        Orgao: candidate.agencyName,
        Fornecedor: candidate.supplierName,
        DocumentoFornecedor: candidate.supplierDocument,
        Descricao: candidate.description,
        UnidadeOriginal: candidate.originalUnitLabel,
        PrecoOriginal: candidate.originalUnitPrice,
        PrecoComparavel: candidate.comparableUnitPrice,
        PrecoAjustado: adjustedPrice,
        DivergenciaPercentual: estimatedPrice > 0 ? ((adjustedPrice - estimatedPrice) / estimatedPrice) * 100 : 0,
        UrlFonte: candidate.sourceUrl,
        BuscaPncp: candidate.pncpSearchUrl,
      };
    });
  });
  const abcRows = buildPriceResearchAbcCurve(data).map((row) => ({
    Item: row.itemNumber,
    Descricao: row.description,
    Quantidade: row.quantity,
    PrecoEstimado: row.estimatedUnitPrice,
    TotalEstimado: row.estimatedTotal,
    ParticipacaoPercentual: row.participationPercentage,
    AcumuladoPercentual: row.accumulatedPercentage,
    Classe: row.abcClass,
  }));
  const comparisonRows = buildPriceResearchComparisonMap(data).map((row) => ({
    Item: row.itemNumber,
    Descricao: row.itemDescription,
    Fonte: row.source,
    Fornecedor: row.supplier,
    OrgaoUasg: row.agency,
    UF: row.state,
    Municipio: row.municipality,
    Data: row.purchaseDate,
    Selecionado: row.selected ? 'Sim' : 'Nao',
    UnidadeCompativel: row.unitCompatible ? 'Sim' : 'Nao',
    Preco: row.unitPrice,
    PrecoEstimado: row.estimatedUnitPrice,
    DivergenciaPercentual: row.deviationPercentage,
    JustificativaExclusao: row.exclusionReason,
  }));
  const authentication = buildPriceResearchAuthenticationPayload(data, {
    origin: typeof window !== 'undefined' ? window.location.origin : '',
    ...options,
  });
  const authenticationRows = [
    { Campo: 'Hash do snapshot', Valor: authentication.snapshotHash },
    { Campo: 'URL de verificacao', Valor: authentication.verificationUrl },
    { Campo: 'QR Code', Valor: authentication.qrCodeUrl },
    { Campo: 'Gerado em', Valor: authentication.generatedAt },
    { Campo: 'Versao do relatorio', Valor: authentication.reportVersion },
  ];

  downloadTextFile('relatorio-pesquisa-precos-instituicao.csv', rowsToCsv(institutionRows), 'text/csv;charset=utf-8');
  downloadTextFile('relatorio-pesquisa-precos-servidores.csv', rowsToCsv(serverRows), 'text/csv;charset=utf-8');
  downloadTextFile('relatorio-pesquisa-precos-gerencial.csv', rowsToCsv(managementRows), 'text/csv;charset=utf-8');
  downloadTextFile('relatorio-pesquisa-precos-resumo.csv', rowsToCsv(summaryRows), 'text/csv;charset=utf-8');
  downloadTextFile('relatorio-pesquisa-precos-cotacoes.csv', rowsToCsv(quoteRows), 'text/csv;charset=utf-8');
  downloadTextFile('relatorio-pesquisa-precos-curva-abc.csv', rowsToCsv(abcRows), 'text/csv;charset=utf-8');
  downloadTextFile('relatorio-pesquisa-precos-mapa-comparativo.csv', rowsToCsv(comparisonRows), 'text/csv;charset=utf-8');
  downloadTextFile('relatorio-pesquisa-precos-autenticacao.csv', rowsToCsv(authenticationRows), 'text/csv;charset=utf-8');
}

export function buildDespachoConclusivoSuapText(data: {
  title?: string;
  processNumber?: string;
  responsibleName?: string;
  researchDate?: string;
  objectDescription?: string;
  demandSummary?: string;
  calculationMethod?: string;
  methodologyJustification?: string;
  overallEstimatedTotal?: number;
  items?: Array<{
    itemNumber: string;
    description: string;
    quantity: number;
    unit: string;
    estimatedUnitPrice: number;
    estimatedTotal?: number;
    coefficientOfVariation?: number;
    candidatesCount?: number;
  }>;
}): string {
  const dataPesquisa = data.researchDate ? formatDate(data.researchDate) : new Date().toLocaleDateString('pt-BR');
  const totalCalculado = data.overallEstimatedTotal || (data.items || []).reduce((acc, i) => acc + (i.estimatedTotal || (i.estimatedUnitPrice * i.quantity)), 0);
  const totalFormatado = formatCurrency(totalCalculado);
  const metodoLabel = data.calculationMethod === 'mean' ? 'Média' : data.calculationMethod === 'minimum' ? 'Menor Preço' : 'Mediana';

  const itemsTable = (data.items || []).map((i) => (
    `• Item ${i.itemNumber} - ${i.description}: ${i.quantity} ${i.unit} x ${formatCurrency(i.estimatedUnitPrice)} = ${formatCurrency(i.estimatedTotal || (i.estimatedUnitPrice * i.quantity))} (CV: ${(i.coefficientOfVariation ?? 0).toFixed(1)}%)`
  )).join('\n');

  return `DESPACHO CONCLUSIVO - PESQUISA DE PREÇOS

PROCESSO: ${data.processNumber || 'N/A'}
OBJETO: ${data.objectDescription || data.demandSummary || data.title || 'Aquisição / Contratação de Bens e Serviços'}
DATA DA PESQUISA: ${dataPesquisa}
RESPONSÁVEL: ${data.responsibleName || 'Agente Responsável'}

1. DA FUNDAMENTAÇÃO LEGAL
A presente pesquisa de preços foi conduzida em estrita observância ao art. 23 da Lei nº 14.133, de 1º de abril de 2021, e às disposições da Instrução Normativa SEGES/ME nº 65, de 7 de julho de 2021, utilizando prioritariamente as bases oficiais de dados do Portal Nacional de Contratações Públicas (PNCP) e do Painel de Preços / Compras.gov.br.

2. DA METODOLOGIA E DA MEMÓRIA DE CÁLCULO
Para a fixação do valor estimado da contratação, foi adotado o método da ${metodoLabel} como medida de tendência central, garantindo a obtenção de uma cesta de preços homogênea e expurgando eventuais valores inexequíveis ou excessivamente elevados.

${data.methodologyJustification || 'A adoção da Mediana como parâmetro reflete com fidelidade os preços praticados no mercado público para itens de mesma natureza e padrão de desempenho.'}

3. DO QUADRO RESUMO DOS ITENS
${itemsTable}

VALOR TOTAL ESTIMADO DA CONTRATAÇÃO: ${totalFormatado}

4. DA AUDITORIA DOCUMENTAL E SIMILARIDADE TÉCNICA
Certifica-se que as contratações públicas paradigmas coletadas no PNCP tiveram seus Editais e Termos de Referência consultados e auditados, restando comprovada a equivalência técnica e de desempenho em relação à demanda do órgão.

5. CONCLUSÃO
Diante do exposto, submetem-se os autos à autoridade competente com a manifestação favorável quanto à razoabilidade e conformidade orçamentária dos valores estimados, restando a presente pesquisa apta a instruir a fase preparatória da contratação.

Currais Novos/RN, ${dataPesquisa}.

__________________________________________
${data.responsibleName || 'Equipe / Agente Responsável'}
`;
}
