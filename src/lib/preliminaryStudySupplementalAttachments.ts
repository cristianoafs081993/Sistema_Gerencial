import * as CFB from 'cfb';
import * as XLSX from 'xlsx';

import {
  analyzePreliminaryStudyPdfPages,
  extractPreliminaryStudyPdfPagesFromArrayBuffer,
  type PreliminaryStudyContextSnippet,
  type PreliminaryStudyPdfAnalysis,
  type PreliminaryStudySnippetKind,
} from '@/lib/preliminaryStudyProcessPdf';

export const PRELIMINARY_STUDY_SUPPLEMENTAL_MAX_FILES = 5;
export const PRELIMINARY_STUDY_SUPPLEMENTAL_MAX_FILE_SIZE = 20 * 1024 * 1024;
export const PRELIMINARY_STUDY_SUPPLEMENTAL_ACCEPT =
  '.pdf,.xlsx,.xls,.ods,.csv,.txt,.md,.docx,application/pdf,text/csv,text/plain,text/markdown,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

type SupplementalRule = {
  kind: PreliminaryStudySnippetKind;
  label: string;
  patterns: string[];
  maxMatches: number;
};

type AttachmentTextChunk = {
  id: string;
  text: string;
  sourceLabel: string;
  pageNumber?: number;
};

export type PreliminaryStudySupplementalAttachmentAnalysis = PreliminaryStudyPdfAnalysis & {
  fileName: string;
  fileType: 'PDF' | 'Planilha' | 'CSV' | 'Texto' | 'DOCX';
  sourceSummary: string;
};

const supplementalRules: SupplementalRule[] = [
  {
    kind: 'necessidade',
    label: 'Necessidade da contratacao',
    patterns: ['necessidade da contratacao', 'descricao da necessidade', 'problema a ser resolvido', 'justificativa da contratacao'],
    maxMatches: 3,
  },
  {
    kind: 'objeto',
    label: 'Objeto',
    patterns: ['objeto da contratacao', 'descricao do objeto', 'contratacao de', 'prestacao de servicos'],
    maxMatches: 2,
  },
  {
    kind: 'servico-continuo',
    label: 'Servico continuo',
    patterns: ['servico continuado', 'servicos continuos', 'natureza continuada', 'continuidade dos servicos'],
    maxMatches: 3,
  },
  {
    kind: 'quantitativos',
    label: 'Quantitativos e memoria de calculo',
    patterns: ['quantitativo', 'quantidade', 'postos', 'posto de trabalho', 'memoria de calculo', 'area a ser atendida'],
    maxMatches: 4,
  },
  {
    kind: 'vigencia',
    label: 'Vigencia e prazo',
    patterns: ['vigencia', 'prazo de vigencia', 'prorrogacao', 'meses'],
    maxMatches: 2,
  },
  {
    kind: 'dedicacao-exclusiva',
    label: 'Dedicacao exclusiva de mao de obra',
    patterns: ['dedicacao exclusiva', 'mao de obra', 'postos de trabalho', 'jornada de trabalho'],
    maxMatches: 3,
  },
  {
    kind: 'locais',
    label: 'Locais de execucao',
    patterns: ['local de execucao', 'locais de execucao', 'campus', 'unidade demandante', 'ambientes'],
    maxMatches: 2,
  },
  {
    kind: 'estimativa',
    label: 'Estimativa de valor',
    patterns: ['estimativa do valor', 'valor estimado', 'pesquisa de precos', 'planilha de custos', 'formacao de precos'],
    maxMatches: 3,
  },
  {
    kind: 'mercado',
    label: 'Levantamento de mercado',
    patterns: ['levantamento de mercado', 'alternativas de mercado', 'solucoes disponiveis', 'analise de mercado'],
    maxMatches: 2,
  },
  {
    kind: 'riscos',
    label: 'Riscos e providencias',
    patterns: ['risco', 'riscos', 'providencias', 'gestao de riscos', 'mapa de riscos'],
    maxMatches: 2,
  },
  {
    kind: 'sustentabilidade',
    label: 'Sustentabilidade',
    patterns: ['sustentabilidade', 'criterios ambientais', 'impactos ambientais', 'residuos'],
    maxMatches: 2,
  },
  {
    kind: 'fiscalizacao',
    label: 'Fiscalizacao e gestao contratual',
    patterns: ['fiscalizacao', 'gestao do contrato', 'gestor do contrato', 'fiscal tecnico', 'fiscal administrativo'],
    maxMatches: 2,
  },
  {
    kind: 'estimativa',
    label: 'CCT - Piso salarial e custos',
    patterns: ['piso salarial', 'salario normativo', 'salario base', 'remuneracao minima'],
    maxMatches: 3,
  },
  {
    kind: 'estimativa',
    label: 'CCT - Beneficios',
    patterns: ['auxilio alimentacao', 'vale alimentacao', 'vale transporte', 'cesta basica', 'beneficio'],
    maxMatches: 3,
  },
  {
    kind: 'dedicacao-exclusiva',
    label: 'CCT - Jornada de trabalho',
    patterns: ['jornada de trabalho', 'carga horaria', '44 horas', 'escala de trabalho', 'regime de trabalho'],
    maxMatches: 3,
  },
  {
    kind: 'dedicacao-exclusiva',
    label: 'CCT - Adicionais',
    patterns: ['adicional noturno', 'insalubridade', 'periculosidade', 'hora extra', 'adicional'],
    maxMatches: 3,
  },
  {
    kind: 'vigencia',
    label: 'CCT - Vigencia',
    patterns: ['vigencia', 'data base', 'convencao coletiva', 'termo aditivo'],
    maxMatches: 2,
  },
  {
    kind: 'objeto',
    label: 'CCT - Sindicato ou categoria',
    patterns: ['sindicato', 'categoria profissional', 'categoria economica', 'abrangencia territorial'],
    maxMatches: 2,
  },
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function excerptText(value: string, maxLength = 900): string {
  const collapsed = collapseWhitespace(value);
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength - 1).trimEnd()}...`;
}

function fileSlug(fileName: string) {
  return normalizeText(fileName).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'anexo';
}

function getFileExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || '';
}

function decodeBuffer(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.slice(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.slice(2));
  }
  const utf8Text = new TextDecoder('utf-8').decode(bytes);
  if (utf8Text.includes('\uFFFD')) {
    return new TextDecoder('latin1').decode(bytes);
  }
  return utf8Text.replace(/^\uFEFF/, '');
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function buildSnippets(fileName: string, chunks: AttachmentTextChunk[]) {
  const snippets: PreliminaryStudyContextSnippet[] = [];
  const seenIds = new Set<string>();
  const slug = fileSlug(fileName);

  for (const rule of supplementalRules) {
    let matches = 0;

    for (const chunk of chunks) {
      if (matches >= rule.maxMatches) break;
      if (!rule.patterns.some((pattern) => normalizeText(chunk.text).includes(pattern))) continue;

      const id = `anexo-${slug}-${rule.kind}-${chunk.id}`;
      if (seenIds.has(id)) continue;

      seenIds.add(id);
      matches += 1;
      snippets.push({
        id,
        kind: rule.kind,
        label: rule.label,
        pageNumber: chunk.pageNumber,
        excerpt: excerptText(chunk.text),
        sourceType: 'anexo',
        sourceName: fileName,
        sourceLabel: chunk.sourceLabel,
      });
    }
  }

  return snippets;
}

function analyzeChunks(
  fileName: string,
  fileType: PreliminaryStudySupplementalAttachmentAnalysis['fileType'],
  chunks: AttachmentTextChunk[],
): PreliminaryStudySupplementalAttachmentAnalysis {
  const searchablePageCount = chunks.filter((chunk) => normalizeText(chunk.text).length > 0).length;
  const snippets = buildSnippets(fileName, chunks);
  const warnings: string[] = [];

  if (searchablePageCount === 0) {
    warnings.push(`Nao encontrei texto pesquisavel em ${fileName}.`);
  } else if (snippets.length === 0) {
    warnings.push(`Nao encontrei trechos uteis no anexo ${fileName}.`);
  }

  return {
    fileName,
    fileType,
    sourceSummary: `${searchablePageCount}/${chunks.length} origem(ns) com texto`,
    pageCount: chunks.length,
    searchablePageCount,
    snippets,
    warnings,
  };
}

export function analyzePreliminaryStudySupplementalPdfPages(
  fileName: string,
  rawPages: Array<{ pageNumber: number; text: string }>,
): PreliminaryStudySupplementalAttachmentAnalysis {
  const baseAnalysis = analyzePreliminaryStudyPdfPages(rawPages);
  const chunks = rawPages.map((page) => ({
    id: `pagina-${page.pageNumber}`,
    text: page.text,
    pageNumber: page.pageNumber,
    sourceLabel: `${fileName}, pagina ${page.pageNumber}`,
  }));
  const supplementalSnippets = buildSnippets(fileName, chunks);
  const baseSnippets = baseAnalysis.snippets.map((snippet) => ({
    ...snippet,
    id: `anexo-${fileSlug(fileName)}-${snippet.id}`,
    sourceType: 'anexo' as const,
    sourceName: fileName,
    sourceLabel: `${fileName}, pagina ${snippet.pageNumber}`,
  }));
  const snippetById = new Map<string, PreliminaryStudyContextSnippet>();

  for (const snippet of [...baseSnippets, ...supplementalSnippets]) {
    snippetById.set(snippet.id, snippet);
  }

  const snippets = Array.from(snippetById.values());
  const warnings = [...baseAnalysis.warnings];
  if (baseAnalysis.searchablePageCount > 0 && snippets.length === 0) {
    warnings.push(`Nao encontrei trechos uteis no anexo ${fileName}.`);
  }

  return {
    ...baseAnalysis,
    fileName,
    fileType: 'PDF',
    sourceSummary: `${baseAnalysis.searchablePageCount}/${baseAnalysis.pageCount} pagina(s) com texto`,
    snippets,
    warnings,
  };
}

function workbookToChunks(fileName: string, workbook: XLSX.WorkBook): AttachmentTextChunk[] {
  const chunks: AttachmentTextChunk[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as unknown[][];
    const nonEmptyRows = rows
      .map((row, index) => ({
        rowNumber: index + 1,
        values: row.map((cell) => collapseWhitespace(String(cell || ''))).filter(Boolean),
      }))
      .filter((row) => row.values.length > 0);

    for (let index = 0; index < nonEmptyRows.length; index += 30) {
      const slice = nonEmptyRows.slice(index, index + 30);
      if (slice.length === 0) continue;
      const firstRow = slice[0].rowNumber;
      const lastRow = slice[slice.length - 1].rowNumber;
      const text = slice.map((row) => `Linha ${row.rowNumber}: ${row.values.join(' | ')}`).join('\n');

      chunks.push({
        id: `${fileSlug(sheetName)}-linhas-${firstRow}-${lastRow}`,
        text,
        sourceLabel: `${fileName}, aba ${sheetName}, linhas ${firstRow}-${lastRow}`,
      });
    }
  }

  return chunks;
}

function textToChunks(fileName: string, text: string): AttachmentTextChunk[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(collapseWhitespace)
    .filter(Boolean);
  const chunks: AttachmentTextChunk[] = [];
  let current: string[] = [];
  let startBlock = 1;

  for (const [index, paragraph] of paragraphs.entries()) {
    if (current.join(' ').length + paragraph.length > 2000 && current.length > 0) {
      const endBlock = startBlock + current.length - 1;
      chunks.push({
        id: `blocos-${startBlock}-${endBlock}`,
        text: current.join('\n\n'),
        sourceLabel: `${fileName}, blocos ${startBlock}-${endBlock}`,
      });
      current = [];
      startBlock = index + 1;
    }
    current.push(paragraph);
  }

  if (current.length > 0) {
    const endBlock = startBlock + current.length - 1;
    chunks.push({
      id: `blocos-${startBlock}-${endBlock}`,
      text: current.join('\n\n'),
      sourceLabel: `${fileName}, blocos ${startBlock}-${endBlock}`,
    });
  }

  return chunks;
}

export function extractDocxTextFromArrayBuffer(arrayBuffer: ArrayBuffer): string {
  const cfb = CFB.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const fullPath = cfb.FullPaths.find((entry) => entry.replace(/^\/+/, '').toLowerCase().endsWith('word/document.xml'));
  const documentEntry = fullPath ? CFB.find(cfb, fullPath) : null;
  const content = documentEntry?.content;

  if (!content) {
    throw new Error('O DOCX nao possui word/document.xml.');
  }

  const xml = new TextDecoder('utf-8').decode(content instanceof Uint8Array ? content : Uint8Array.from(content));
  const textParts = Array.from(xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)).map((match) => decodeXml(match[1]));
  return collapseWhitespace(textParts.join(' '));
}

function readCsvWorkbook(fileName: string, arrayBuffer: ArrayBuffer) {
  const text = decodeBuffer(arrayBuffer);
  const delimiter = text.includes('\t') ? '\t' : text.includes(';') ? ';' : ',';
  return XLSX.read(text, { type: 'string', raw: false, FS: delimiter });
}

export function analyzePreliminaryStudySupplementalText(
  fileName: string,
  text: string,
  fileType: PreliminaryStudySupplementalAttachmentAnalysis['fileType'] = 'Texto',
) {
  return analyzeChunks(fileName, fileType, textToChunks(fileName, text));
}

export async function analyzePreliminaryStudySupplementalAttachmentFile(
  file: File,
): Promise<PreliminaryStudySupplementalAttachmentAnalysis> {
  if (file.size > PRELIMINARY_STUDY_SUPPLEMENTAL_MAX_FILE_SIZE) {
    throw new Error(`${file.name} excede o limite de 20 MB.`);
  }

  const extension = getFileExtension(file.name);
  if (extension === 'doc') {
    throw new Error(`${file.name} usa o formato DOC legado. Converta para DOCX ou PDF antes de anexar.`);
  }

  const arrayBuffer = await file.arrayBuffer();

  if (extension === 'pdf' || file.type === 'application/pdf') {
    const pages = await extractPreliminaryStudyPdfPagesFromArrayBuffer(arrayBuffer);
    return analyzePreliminaryStudySupplementalPdfPages(file.name, pages);
  }

  if (['xlsx', 'xls', 'ods'].includes(extension)) {
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    return analyzeChunks(file.name, 'Planilha', workbookToChunks(file.name, workbook));
  }

  if (extension === 'csv' || file.type.includes('csv')) {
    const workbook = readCsvWorkbook(file.name, arrayBuffer);
    return analyzeChunks(file.name, 'CSV', workbookToChunks(file.name, workbook));
  }

  if (extension === 'txt' || extension === 'md' || file.type.startsWith('text/')) {
    return analyzePreliminaryStudySupplementalText(file.name, decodeBuffer(arrayBuffer), 'Texto');
  }

  if (extension === 'docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return analyzePreliminaryStudySupplementalText(file.name, extractDocxTextFromArrayBuffer(arrayBuffer), 'DOCX');
  }

  throw new Error(`${file.name} nao e um formato suportado. Use PDF, XLSX, XLS, ODS, CSV, TXT, MD ou DOCX.`);
}
