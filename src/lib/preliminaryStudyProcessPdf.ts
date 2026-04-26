import * as pdfjsLib from 'pdfjs-dist';
import type { DocumentContextSnippet } from '@/lib/documentContextSnippets';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export type PreliminaryStudySnippetKind =
  | 'necessidade'
  | 'objeto'
  | 'servico-continuo'
  | 'quantitativos'
  | 'vigencia'
  | 'dedicacao-exclusiva'
  | 'locais'
  | 'estimativa'
  | 'mercado'
  | 'riscos'
  | 'sustentabilidade'
  | 'fiscalizacao';

export type PreliminaryStudyPdfPage = {
  pageNumber: number;
  text: string;
  normalizedText: string;
};

export type PreliminaryStudyContextSnippet = DocumentContextSnippet & {
  id: string;
  kind: PreliminaryStudySnippetKind;
  label: string;
  pageNumber: number;
  excerpt: string;
};

export type PreliminaryStudyPdfAnalysis = {
  pageCount: number;
  searchablePageCount: number;
  snippets: PreliminaryStudyContextSnippet[];
  warnings: string[];
};

const MAX_SNIPPETS = 28;

const snippetRules: Array<{
  kind: PreliminaryStudySnippetKind;
  label: string;
  patterns: string[];
  maxMatches: number;
}> = [
  {
    kind: 'necessidade',
    label: 'Necessidade da contratação',
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
    label: 'Serviço contínuo',
    patterns: ['servico continuado', 'servicos continuos', 'natureza continuada', 'continuidade dos servicos'],
    maxMatches: 3,
  },
  {
    kind: 'quantitativos',
    label: 'Quantitativos e memória de cálculo',
    patterns: ['quantitativo', 'quantidade', 'postos', 'posto de trabalho', 'memoria de calculo', 'area a ser atendida'],
    maxMatches: 4,
  },
  {
    kind: 'vigencia',
    label: 'Vigência e prazo',
    patterns: ['vigencia', 'prazo de vigencia', 'prorrogacao', 'meses'],
    maxMatches: 2,
  },
  {
    kind: 'dedicacao-exclusiva',
    label: 'Dedicação exclusiva de mão de obra',
    patterns: ['dedicacao exclusiva', 'mao de obra', 'postos de trabalho', 'jornada de trabalho'],
    maxMatches: 3,
  },
  {
    kind: 'locais',
    label: 'Locais de execução',
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
    label: 'Riscos e providências',
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
    label: 'Fiscalização e gestão contratual',
    patterns: ['fiscalizacao', 'gestao do contrato', 'gestor do contrato', 'fiscal tecnico', 'fiscal administrativo'],
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

export function analyzePreliminaryStudyPdfPages(
  rawPages: Array<{ pageNumber: number; text: string }>,
): PreliminaryStudyPdfAnalysis {
  const pages = rawPages.map((page) => ({
    pageNumber: page.pageNumber,
    text: page.text,
    normalizedText: normalizeText(page.text),
  }));

  const warnings: string[] = [];
  const searchablePageCount = pages.filter((page) => page.normalizedText.length > 0).length;
  const snippets: PreliminaryStudyContextSnippet[] = [];
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

  if (searchablePageCount > 0 && snippets.length === 0) {
    warnings.push('Nao encontrei trechos claros do processo para preencher o ETP automaticamente.');
  }

  return {
    pageCount: pages.length,
    searchablePageCount,
    snippets,
    warnings,
  };
}

export async function extractPreliminaryStudyPdfPagesFromArrayBuffer(arrayBuffer: ArrayBuffer): Promise<PreliminaryStudyPdfPage[]> {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const pages: PreliminaryStudyPdfPage[] = [];

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

export async function analyzePreliminaryStudyPdfFromArrayBuffer(arrayBuffer: ArrayBuffer): Promise<PreliminaryStudyPdfAnalysis> {
  const pages = await extractPreliminaryStudyPdfPagesFromArrayBuffer(arrayBuffer);
  return analyzePreliminaryStudyPdfPages(pages);
}
