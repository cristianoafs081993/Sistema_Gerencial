import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export type ReferenceTermSnippetKind =
  | 'objeto'
  | 'itens'
  | 'justificativa'
  | 'estimativa'
  | 'entrega'
  | 'habilitacao'
  | 'sustentabilidade'
  | 'garantia'
  | 'pagamento'
  | 'etp-dfd';

export type ReferenceTermPdfPage = {
  pageNumber: number;
  text: string;
  normalizedText: string;
};

export type ReferenceTermContextSnippet = {
  id: string;
  kind: ReferenceTermSnippetKind;
  label: string;
  pageNumber: number;
  excerpt: string;
};

export type ReferenceTermPdfAnalysis = {
  pageCount: number;
  searchablePageCount: number;
  snippets: ReferenceTermContextSnippet[];
  warnings: string[];
};

const MAX_SNIPPETS = 14;

const snippetRules: Array<{
  kind: ReferenceTermSnippetKind;
  label: string;
  patterns: string[];
  maxMatches: number;
}> = [
  {
    kind: 'objeto',
    label: 'Objeto da contratacao',
    patterns: ['objeto da contratacao', 'aquisicao de', 'descricao do objeto'],
    maxMatches: 2,
  },
  {
    kind: 'itens',
    label: 'Itens e quantitativos',
    patterns: ['descricao', 'quantidade', 'valor unitario', 'valor total', 'catmat'],
    maxMatches: 3,
  },
  {
    kind: 'justificativa',
    label: 'Justificativa da contratacao',
    patterns: ['justificativa da contratacao', 'necessidade da contratacao', 'motivacao da contratacao'],
    maxMatches: 2,
  },
  {
    kind: 'estimativa',
    label: 'Estimativa de valor',
    patterns: ['estimativa do valor', 'valor estimado', 'pesquisa de precos', 'mapa comparativo de precos'],
    maxMatches: 2,
  },
  {
    kind: 'entrega',
    label: 'Entrega e prazos',
    patterns: ['prazo de entrega', 'local de entrega', 'condicoes de entrega'],
    maxMatches: 2,
  },
  {
    kind: 'habilitacao',
    label: 'Habilitacao e qualificacao',
    patterns: ['habilitacao', 'qualificacao tecnica', 'qualificacao economico-financeira'],
    maxMatches: 2,
  },
  {
    kind: 'sustentabilidade',
    label: 'Sustentabilidade',
    patterns: ['sustentabilidade', 'criterios ambientais', 'desenvolvimento sustentavel'],
    maxMatches: 1,
  },
  {
    kind: 'garantia',
    label: 'Garantia e assistencia tecnica',
    patterns: ['garantia', 'assistencia tecnica'],
    maxMatches: 1,
  },
  {
    kind: 'pagamento',
    label: 'Pagamento',
    patterns: ['pagamento', 'liquidacao', 'nota fiscal'],
    maxMatches: 1,
  },
  {
    kind: 'etp-dfd',
    label: 'ETP ou DFD',
    patterns: ['estudo tecnico preliminar', 'documento de formalizacao da demanda', 'dfd'],
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

function excerptText(value: string, maxLength = 360): string {
  const collapsed = collapseWhitespace(value);
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength - 1).trimEnd()}...`;
}

export function analyzeReferenceTermPdfPages(rawPages: Array<{ pageNumber: number; text: string }>): ReferenceTermPdfAnalysis {
  const pages = rawPages.map((page) => ({
    pageNumber: page.pageNumber,
    text: page.text,
    normalizedText: normalizeText(page.text),
  }));

  const warnings: string[] = [];
  const searchablePageCount = pages.filter((page) => page.normalizedText.length > 0).length;
  const snippets: ReferenceTermContextSnippet[] = [];
  const seenIds = new Set<string>();

  if (searchablePageCount === 0) {
    warnings.push('O PDF do processo nao trouxe texto pesquisavel. Esta versao ainda nao faz OCR.');
  }

  for (const rule of snippetRules) {
    let matches = 0;

    for (const page of pages) {
      if (matches >= rule.maxMatches || snippets.length >= MAX_SNIPPETS) {
        break;
      }

      if (!rule.patterns.some((pattern) => page.normalizedText.includes(pattern))) {
        continue;
      }

      const id = `${rule.kind}-${page.pageNumber}`;
      if (seenIds.has(id)) {
        continue;
      }

      seenIds.add(id);
      matches += 1;
      snippets.push({
        id,
        kind: rule.kind,
        label: rule.label,
        pageNumber: page.pageNumber,
        excerpt: excerptText(page.text),
      });
    }
  }

  if (snippets.length === 0) {
    warnings.push('Nao encontrei trechos claros do processo para preencher o Termo de Referencia automaticamente.');
  }

  return {
    pageCount: pages.length,
    searchablePageCount,
    snippets,
    warnings,
  };
}

export async function extractReferenceTermPdfPagesFromArrayBuffer(arrayBuffer: ArrayBuffer): Promise<ReferenceTermPdfPage[]> {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const pages: ReferenceTermPdfPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');

    pages.push({
      pageNumber,
      text,
      normalizedText: normalizeText(text),
    });
  }

  return pages;
}

export async function analyzeReferenceTermPdfFromArrayBuffer(arrayBuffer: ArrayBuffer): Promise<ReferenceTermPdfAnalysis> {
  const pages = await extractReferenceTermPdfPagesFromArrayBuffer(arrayBuffer);
  return analyzeReferenceTermPdfPages(pages);
}
