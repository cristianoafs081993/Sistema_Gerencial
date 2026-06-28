import * as XLSX from 'xlsx';
import * as pdfWorkerAsset from 'pdfjs-dist/build/pdf.worker.min.js?url';
import type { PriceCatalogSuggestion } from '@/lib/priceCatalog';

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
  standardDeviation: number;
  coefficientOfVariation: number;
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

export function calculatePriceStatistics(values: number[]): PriceResearchStatistics {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  if (valid.length === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      minimum: 0,
      maximum: 0,
      standardDeviation: 0,
      coefficientOfVariation: 0,
    };
  }

  const mean = valid.reduce((total, value) => total + value, 0) / valid.length;
  const variance = valid.reduce((total, value) => total + ((value - mean) ** 2), 0) / valid.length;
  const standardDeviation = Math.sqrt(variance);

  return {
    count: valid.length,
    mean,
    median: median(valid),
    minimum: Math.min(...valid),
    maximum: Math.max(...valid),
    standardDeviation,
    coefficientOfVariation: mean > 0 ? (standardDeviation / mean) * 100 : 0,
  };
}

export function getSelectedStatistics(item: PriceResearchItem) {
  return calculatePriceStatistics(
    item.candidates
      .filter((candidate) => candidate.selected)
      .map((candidate) => candidate.comparableUnitPrice),
  );
}

export function getEstimatedUnitPrice(item: PriceResearchItem, method: PriceResearchMethod) {
  const statistics = getSelectedStatistics(item);
  if (method === 'mean') return statistics.mean;
  if (method === 'minimum') return statistics.minimum;
  return statistics.median;
}

export function validatePriceResearchReport(data: PriceResearchReportData) {
  const errors: string[] = [];
  if (!data.objectDescription.trim()) errors.push('Informe o objeto da contratação.');
  if (!data.responsibleName.trim()) errors.push('Informe o agente responsável pela pesquisa.');
  if (!data.methodologyJustification.trim()) errors.push('Justifique o método estatístico adotado.');
  if (data.items.length === 0) errors.push('Importe ao menos um item.');

  for (const item of data.items) {
    if (!item.catalogCode) errors.push(`Item ${item.itemNumber}: informe o código CATMAT/CATSER.`);
    const selected = item.candidates.filter((candidate) => candidate.selected);
    if (selected.length < 3) errors.push(`Item ${item.itemNumber}: selecione ao menos três preços ou registre justificativa excepcional nos autos.`);
    const exclusionsWithoutReason = item.candidates.filter(
      (candidate) => !candidate.selected && !candidate.exclusionReason.trim(),
    );
    if (exclusionsWithoutReason.length > 0) {
      errors.push(`Item ${item.itemNumber}: justifique todas as exclusões.`);
    }
  }
  return errors;
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

    const selectedRows = selected.map((candidate, index) => `
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
        <td>${escapeHtml(candidate.aiReason)}</td>
      </tr>
    `).join('');

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
              <th>Preço original</th><th>Preço comparável</th><th>Análise de aderência</th>
            </tr>
          </thead>
          <tbody>${selectedRows || '<tr><td colspan="9">Nenhum preço selecionado.</td></tr>'}</tbody>
        </table>
        <div class="summary">
          <div><span>Amostra</span><strong>${statistics.count}</strong></div>
          <div><span>Média</span><strong>${formatCurrency(statistics.mean)}</strong></div>
          <div><span>Mediana</span><strong>${formatCurrency(statistics.median)}</strong></div>
          <div><span>Menor</span><strong>${formatCurrency(statistics.minimum)}</strong></div>
          <div><span>CV</span><strong>${statistics.coefficientOfVariation.toFixed(2)}%</strong></div>
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
        .summary { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin-top: 8px; }
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
            ${data.items
              .map((item) => {
                const selectedWithEvidence = item.candidates.filter((c) => c.selected && c.sourceType !== 'compras_gov_precos' && c.evidenceImage && (c.evidenceImage.startsWith('http') || c.evidenceImage.startsWith('data:')));
                if (selectedWithEvidence.length === 0) return '';
                return `
                  <div style="margin-bottom: 8px;">
                    <h2 style="font-size: 12px; color: #1f6f32; margin-bottom: 12px; border-bottom: 1px dashed #ddd; padding-bottom: 4px;">Item ${escapeHtml(item.itemNumber)} — ${escapeHtml(item.description)}</h2>
                    ${selectedWithEvidence
                      .map(
                        (c) => `
                      <div style="page-break-before: always; padding: 16px 0;">
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10px;">
                          <tr>
                            <td style="padding: 4px 8px; background: #f0f7f0; border: 1px solid #c8e0c8; width: 120px; color: #444; font-weight: bold;">Fonte</td>
                            <td style="padding: 4px 8px; border: 1px solid #ddd;">${escapeHtml(c.sourceLabel)}</td>
                            <td style="padding: 4px 8px; background: #f0f7f0; border: 1px solid #c8e0c8; width: 120px; color: #444; font-weight: bold;">Preço unitário</td>
                            <td style="padding: 4px 8px; border: 1px solid #ddd; font-weight: bold;">${formatCurrency(c.originalUnitPrice)}</td>
                          </tr>
                          ${c.freightCost != null && c.freightCost > 0 ? `
                          <tr>
                            <td style="padding: 4px 8px; background: #f0f7f0; border: 1px solid #c8e0c8; color: #444; font-weight: bold;">Frete</td>
                            <td style="padding: 4px 8px; border: 1px solid #ddd;">${formatCurrency(c.freightCost)}</td>
                            <td style="padding: 4px 8px; background: #f0f7f0; border: 1px solid #c8e0c8; color: #444; font-weight: bold;">Preço + Frete</td>
                            <td style="padding: 4px 8px; border: 1px solid #ddd; font-weight: bold; color: #1f6f32;">${formatCurrency(c.comparableUnitPrice)}</td>
                          </tr>` : ''}
                          <tr>
                            <td style="padding: 4px 8px; background: #f0f7f0; border: 1px solid #c8e0c8; color: #444; font-weight: bold;">URL</td>
                            <td colspan="3" style="padding: 4px 8px; border: 1px solid #ddd; word-break: break-all;">
                              <a href="${escapeHtml(c.sourceUrl)}" style="color:#1f5e9c; text-decoration: none; font-size: 9px;">${escapeHtml(c.sourceUrl)}</a>
                            </td>
                          </tr>
                          ${c.evidenceCapturedAt ? `
                          <tr>
                            <td style="padding: 4px 8px; background: #f0f7f0; border: 1px solid #c8e0c8; color: #444; font-weight: bold;">Data captura</td>
                            <td colspan="3" style="padding: 4px 8px; border: 1px solid #ddd; color: #555; font-size: 9px;">${new Date(c.evidenceCapturedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                          </tr>` : ''}
                        </table>
                        <div style="border: 1px solid #ccc; background: white; border-radius: 4px; padding: 4px; text-align: center;">
                          <img src="${c.evidenceImage}" alt="Evidência ${escapeHtml(c.sourceLabel)}" style="width: 100%; max-height: 520px; object-fit: contain;" />
                        </div>
                      </div>
                    `,
                      )
                      .join('')}
                  </div>
                `;
              })
              .join('')}
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
      Método: METHOD_LABELS[data.method],
      'Preço unitário estimado': estimatedUnitPrice,
      'Valor total estimado': estimatedUnitPrice * item.quantity,
    };
  });

  const quoteRows = data.items.flatMap((item) => item.candidates.map((candidate) => ({
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
    'Aderência IA': candidate.aiScore,
    'Justificativa IA': candidate.aiReason,
    'URL da fonte': candidate.sourceUrl,
    'Busca PNCP': candidate.pncpSearchUrl,
  })));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Resumo');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(quoteRows), 'Cotações');
  XLSX.writeFile(workbook, 'relatorio-pesquisa-precos.xlsx');
}
