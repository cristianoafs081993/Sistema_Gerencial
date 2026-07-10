import * as XLSX from 'xlsx';
import * as pdfWorkerAsset from 'pdfjs-dist/build/pdf.worker.min.js?url';
import type { PriceCatalogSuggestion } from '@/lib/priceCatalog';
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

export type PriceResearchReportData = {
  title: string;
  processNumber: string;
  objectDescription: string;
  responsibleName: string;
  researchDate: string;
  method: PriceResearchMethod;
  methodologyJustification: string;
  notes: string;
  sourceFile: string;
  items: PriceResearchItem[];
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
};

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

export function buildPriceResearchReportHtml(data: PriceResearchReportData) {
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

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(candidate.agencyCode || '-')} - ${escapeHtml(candidate.agencyName || '-')}</td>
          <td>${escapeHtml(candidate.supplierName || '-')}</td>
          <td>
            ${escapeHtml(candidate.purchaseId)} / item ${escapeHtml(candidate.purchaseItemId)}<br />
            <a href="${escapeHtml(candidate.sourceUrl)}">Fonte oficial</a>
            ${candidate.pncpSearchUrl ? ` | <a href="${escapeHtml(candidate.pncpSearchUrl)}">PNCP</a>` : ''}
          </td>
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

    const excludedRows = excluded.map((candidate) => `
      <tr>
        <td>${escapeHtml(candidate.agencyCode || candidate.purchaseItemId)}</td>
        <td class="number">${formatCurrency(candidate.comparableUnitPrice)}</td>
        <td>${escapeHtml(candidate.exclusionReason || 'Sem justificativa registrada')}</td>
      </tr>
    `).join('');

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
      <title>${escapeHtml(data.title || 'Relatório de Pesquisa de Preços')}</title>
      <style>
        @page { size: A4 landscape; margin: 14mm; }
        body { font-family: Arial, sans-serif; color: #222; font-size: 10px; line-height: 1.45; }
        h1 { font-size: 20px; margin: 0 0 4px; color: #1f6f32; }
        h2 { font-size: 14px; margin: 24px 0 8px; color: #1f6f32; }
        h3 { font-size: 12px; margin: 16px 0 6px; }
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
        a { color: #1f5e9c; }
      </style>
    </head>
    <body>
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
      ${itemSections}
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

export async function exportPriceResearchWorkbook(data: PriceResearchReportData) {
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

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Resumo');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(quoteRows), 'Cotações');
  XLSX.writeFile(workbook, 'relatorio-pesquisa-precos.xlsx');
}
