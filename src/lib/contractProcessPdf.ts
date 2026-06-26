import * as pdfjsLib from 'pdfjs-dist';
import * as pdfWorkerAsset from 'pdfjs-dist/build/pdf.worker.min.js?url';

const bundledWorkerUrl = (pdfWorkerAsset as { default?: unknown }).default;
pdfjsLib.GlobalWorkerOptions.workerSrc = typeof bundledWorkerUrl === 'string'
  ? bundledWorkerUrl
  : new URL('../../node_modules/pdfjs-dist/build/pdf.worker.min.js', import.meta.url).href;

export type ContractSnippetKind =
  | 'termo-referencia'
  | 'proposta-vencedora'
  | 'homologacao'
  | 'adjudicacao'
  | 'resultado'
  | 'planilha'
  | 'fornecedor';

export type ContractPdfPage = {
  pageNumber: number;
  text: string;
  normalizedText: string;
};

export type ContractTemplateCandidate = {
  id: string;
  title: string;
  subtitle: string;
  pageStart: number;
  pageEnd: number;
  pageNumbers: number[];
  excerpt: string;
  templateText: string;
  truncated: boolean;
};

export type ContractContextSnippet = {
  id: string;
  kind: ContractSnippetKind;
  label: string;
  pageNumber: number;
  excerpt: string;
};

export type ContractPdfAnalysis = {
  pageCount: number;
  searchablePageCount: number;
  templateCandidates: ContractTemplateCandidate[];
  snippets: ContractContextSnippet[];
  warnings: string[];
};

type CandidateDraft = {
  pageStart: number;
  pageEnd: number;
  score: number;
  truncated: boolean;
};

const MAX_TEMPLATE_PAGES = 18;
const MAX_TEMPLATE_CHARS = 42000;
const MAX_SNIPPETS = 10;

const templateEntryTokens = ['termo de contrato', 'minuta de contrato', 'minuta contratual'];
const contractContinueTokens = [
  'clausula',
  'contratante',
  'contratada',
  'obrigacoes do contratante',
  'obrigacoes da contratada',
  'vigencia',
  'preco',
  'pagamento',
  'garantia',
  'rescisao',
  'fiscalizacao',
  'execucao contratual',
];
const stopTokens = [
  'termo de referencia',
  'estudo tecnico preliminar',
  'resultado por fornecedor',
  'aviso de contratacao direta',
  'ata de registro de precos',
  'convenio coletivo',
  'convencao coletiva',
  'planilha de custos',
  'pesquisa de precos',
  'mapa de riscos',
];

const snippetRules: Array<{
  kind: ContractSnippetKind;
  label: string;
  patterns: string[];
  maxMatches: number;
}> = [
  {
    kind: 'termo-referencia',
    label: 'Termo de Referencia',
    patterns: ['termo de referencia'],
    maxMatches: 2,
  },
  {
    kind: 'proposta-vencedora',
    label: 'Proposta vencedora',
    patterns: ['proposta vencedora', 'proposta do contratado', 'proposta comercial'],
    maxMatches: 2,
  },
  {
    kind: 'homologacao',
    label: 'Homologacao',
    patterns: ['homolog'],
    maxMatches: 2,
  },
  {
    kind: 'adjudicacao',
    label: 'Adjudicacao',
    patterns: ['adjudic'],
    maxMatches: 2,
  },
  {
    kind: 'resultado',
    label: 'Resultado do certame',
    patterns: ['resultado por fornecedor', 'fornecedor vencedor', 'proposta classificada em primeiro lugar', 'vencedor'],
    maxMatches: 2,
  },
  {
    kind: 'planilha',
    label: 'Planilha de custos e valores',
    patterns: ['valor total', 'valor mensal', 'planilha de custos', 'quadro-resumo do custo'],
    maxMatches: 1,
  },
  {
    kind: 'fornecedor',
    label: 'Identificacao do fornecedor',
    patterns: ['cnpj', 'razao social'],
    maxMatches: 1,
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

function hasAnyToken(haystack: string, tokens: string[]): boolean {
  return tokens.some((token) => haystack.includes(token));
}

function excerptText(value: string, maxLength = 320): string {
  const collapsed = collapseWhitespace(value);
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength - 1).trimEnd()}...`;
}

function scoreTemplatePage(page: ContractPdfPage): number {
  let score = 0;

  if (hasAnyToken(page.normalizedText, templateEntryTokens)) score += 5;
  if (page.normalizedText.includes('clausula primeira')) score += 2;
  if (page.normalizedText.includes('contratante')) score += 1;
  if (page.normalizedText.includes('contratada')) score += 1;
  if (page.normalizedText.includes('processo administrativo')) score += 1;
  if (page.normalizedText.includes('cnpj')) score += 1;

  return score;
}

function extractContractNumber(text: string): string | undefined {
  const match = text.match(/Contrato\s*n[ou]?:?\s*([0-9./-]+\s*(?:-\s*[A-Z/]+)?)/i);
  return match?.[1] ? collapseWhitespace(match[1]) : undefined;
}

function extractFornecedor(text: string): string | undefined {
  const companyMatch = text.match(/E A (?:EMPRESA\s+)?([A-Z0-9\s.,&/-]{8,}?)\s+(?:O |inscrito|inscrita|doravante)/i);
  if (companyMatch?.[1]) return collapseWhitespace(companyMatch[1]);

  const contractedMatch = text.match(/CONTRATADA\s*,?\s*neste ato representada|CONTRATADA\b/i);
  if (!contractedMatch) return undefined;

  const beforeMarker = text.slice(0, contractedMatch.index);
  const tail = beforeMarker.split('.').pop();
  return tail ? excerptText(tail, 120) : undefined;
}

function looksLikeContractContinuation(page: ContractPdfPage): boolean {
  return (
    hasAnyToken(page.normalizedText, contractContinueTokens) ||
    /clausula\s+(segunda|terceira|quarta|quinta|sexta|setima|oitava|nona|decima)/.test(page.normalizedText)
  );
}

function shouldStopContractWindow(page: ContractPdfPage): boolean {
  return hasAnyToken(page.normalizedText, stopTokens) && !looksLikeContractContinuation(page);
}

function buildTemplateWindow(pages: ContractPdfPage[], startIndex: number): CandidateDraft {
  let pageEnd = startIndex;
  let score = scoreTemplatePage(pages[startIndex]);
  let truncated = false;

  for (let index = startIndex + 1; index < pages.length; index += 1) {
    const page = pages[index];
    const distance = index - startIndex + 1;

    if (distance > MAX_TEMPLATE_PAGES) {
      truncated = true;
      break;
    }

    if (shouldStopContractWindow(page)) {
      break;
    }

    if (!looksLikeContractContinuation(page) && distance > 2) {
      break;
    }

    score += scoreTemplatePage(page);
    pageEnd = index;

    if (page.normalizedText.includes('clausula decima oitava') || page.normalizedText.includes('publicacao') && page.normalizedText.includes('foro')) {
      break;
    }
  }

  return {
    pageStart: pages[startIndex].pageNumber,
    pageEnd: pages[pageEnd].pageNumber,
    score,
    truncated,
  };
}

function buildTemplateText(pages: ContractPdfPage[], pageStart: number, pageEnd: number): { text: string; truncated: boolean } {
  const selectedPages = pages.filter((page) => page.pageNumber >= pageStart && page.pageNumber <= pageEnd);
  let text = '';
  let truncated = false;

  for (const page of selectedPages) {
    const next = `--- Pagina ${page.pageNumber} ---\n${collapseWhitespace(page.text)}\n\n`;
    if ((text + next).length > MAX_TEMPLATE_CHARS) {
      truncated = true;
      break;
    }
    text += next;
  }

  return { text: text.trim(), truncated };
}

function dedupeCandidates(candidates: ContractTemplateCandidate[]): ContractTemplateCandidate[] {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = `${candidate.pageStart}:${candidate.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectTemplateCandidates(pages: ContractPdfPage[]): ContractTemplateCandidate[] {
  const drafts = pages
    .map((page, index) => ({ page, index, score: scoreTemplatePage(page) }))
    .filter((candidate) => candidate.score >= 5)
    .map(({ page, index }) => {
      const draft = buildTemplateWindow(pages, index);
      const supplier = extractFornecedor(page.text);
      const contractNumber = extractContractNumber(page.text);
      const templateText = buildTemplateText(pages, draft.pageStart, draft.pageEnd);
      const title = contractNumber ? `Contrato ${contractNumber}` : `Modelo de contrato (pagina ${page.pageNumber})`;
      const subtitleParts = [
        supplier,
        `Paginas ${draft.pageStart}-${draft.pageEnd}`,
        templateText.truncated || draft.truncated ? 'trecho reduzido' : undefined,
      ].filter(Boolean);

      return {
        id: `contract-template-${draft.pageStart}-${draft.pageEnd}`,
        title,
        subtitle: subtitleParts.join(' | '),
        pageStart: draft.pageStart,
        pageEnd: draft.pageEnd,
        pageNumbers: Array.from({ length: draft.pageEnd - draft.pageStart + 1 }, (_, offset) => draft.pageStart + offset),
        excerpt: excerptText(page.text),
        templateText: templateText.text,
        truncated: draft.truncated || templateText.truncated,
      } satisfies ContractTemplateCandidate;
    })
    .sort((left, right) => left.pageStart - right.pageStart);

  return dedupeCandidates(drafts);
}

function collectSnippets(pages: ContractPdfPage[]): ContractContextSnippet[] {
  const snippets: ContractContextSnippet[] = [];
  const seenSnippetIds = new Set<string>();

  for (const rule of snippetRules) {
    let matches = 0;

    for (const page of pages) {
      if (matches >= rule.maxMatches || snippets.length >= MAX_SNIPPETS) {
        break;
      }

      if (!rule.patterns.some((pattern) => page.normalizedText.includes(pattern))) {
        continue;
      }

      const snippetId = `${rule.kind}-${page.pageNumber}`;
      if (seenSnippetIds.has(snippetId)) {
        continue;
      }

      snippets.push({
        id: snippetId,
        kind: rule.kind,
        label: rule.label,
        pageNumber: page.pageNumber,
        excerpt: excerptText(page.text, 420),
      });
      seenSnippetIds.add(snippetId);
      matches += 1;
    }
  }

  return snippets;
}

export function analyzeContractPdfPages(
  pagesInput: Array<Pick<ContractPdfPage, 'pageNumber' | 'text'>>
): ContractPdfAnalysis {
  const pages = pagesInput.map((page) => ({
    pageNumber: page.pageNumber,
    text: page.text,
    normalizedText: normalizeText(page.text),
  }));

  const searchablePageCount = pages.filter((page) => page.normalizedText.length > 30).length;
  const templateCandidates = collectTemplateCandidates(pages);
  const snippets = collectSnippets(pages);
  const warnings: string[] = [];

  if (searchablePageCount === 0) {
    warnings.push('O PDF do processo nao trouxe texto pesquisavel. Esta versao ainda nao faz OCR.');
  }

  if (templateCandidates.length === 0) {
    warnings.push('Nao encontrei uma minuta ou termo de contrato claro dentro do processo.');
  }

  if (templateCandidates.length > 1) {
    warnings.push('Encontrei mais de um modelo de contrato possivel. Selecione o correto antes de gerar.');
  }

  return {
    pageCount: pages.length,
    searchablePageCount,
    templateCandidates,
    snippets,
    warnings,
  };
}

export async function extractContractPdfPagesFromArrayBuffer(arrayBuffer: ArrayBuffer): Promise<ContractPdfPage[]> {
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    verbosity: (pdfjsLib as unknown as { VerbosityLevel?: { ERRORS?: number } }).VerbosityLevel?.ERRORS ?? 0,
  }).promise;

  const pages: ContractPdfPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ('str' in item ? String(item.str) : '')).join(' ');

    pages.push({
      pageNumber,
      text,
      normalizedText: normalizeText(text),
    });
  }

  return pages;
}

export async function analyzeContractPdfFromArrayBuffer(arrayBuffer: ArrayBuffer): Promise<ContractPdfAnalysis> {
  const pages = await extractContractPdfPagesFromArrayBuffer(arrayBuffer);
  return analyzeContractPdfPages(pages);
}
