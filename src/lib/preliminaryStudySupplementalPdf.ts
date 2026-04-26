import {
  analyzePreliminaryStudyPdfPages,
  extractPreliminaryStudyPdfPagesFromArrayBuffer,
  type PreliminaryStudyContextSnippet,
  type PreliminaryStudyPdfAnalysis,
  type PreliminaryStudySnippetKind,
} from '@/lib/preliminaryStudyProcessPdf';

export const PRELIMINARY_STUDY_SUPPLEMENTAL_MAX_FILES = 5;
export const PRELIMINARY_STUDY_SUPPLEMENTAL_MAX_FILE_SIZE = 20 * 1024 * 1024;

type SupplementalRule = {
  kind: PreliminaryStudySnippetKind;
  label: string;
  patterns: string[];
  maxMatches: number;
};

export type PreliminaryStudySupplementalPdfAnalysis = PreliminaryStudyPdfAnalysis & {
  fileName: string;
};

const supplementalRules: SupplementalRule[] = [
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

function buildSupplementalSnippets(
  fileName: string,
  pages: Array<{ pageNumber: number; text: string; normalizedText?: string }>,
) {
  const snippets: PreliminaryStudyContextSnippet[] = [];
  const seenIds = new Set<string>();
  const slug = fileSlug(fileName);

  for (const rule of supplementalRules) {
    let matches = 0;

    for (const page of pages) {
      if (matches >= rule.maxMatches) break;
      const normalizedText = page.normalizedText || normalizeText(page.text);
      if (!rule.patterns.some((pattern) => normalizedText.includes(pattern))) continue;

      const id = `anexo-${slug}-${rule.kind}-${page.pageNumber}`;
      if (seenIds.has(id)) continue;

      seenIds.add(id);
      matches += 1;
      snippets.push({
        id,
        kind: rule.kind,
        label: rule.label,
        pageNumber: page.pageNumber,
        excerpt: excerptText(page.text),
        sourceType: 'anexo',
        sourceName: fileName,
        sourceLabel: `${fileName}, pagina ${page.pageNumber}`,
      });
    }
  }

  return snippets;
}

export function analyzePreliminaryStudySupplementalPdfPages(
  fileName: string,
  rawPages: Array<{ pageNumber: number; text: string }>,
): PreliminaryStudySupplementalPdfAnalysis {
  const baseAnalysis = analyzePreliminaryStudyPdfPages(rawPages);
  const pages = rawPages.map((page) => ({
    ...page,
    normalizedText: normalizeText(page.text),
  }));
  const cctSnippets = buildSupplementalSnippets(fileName, pages);
  const baseSnippets = baseAnalysis.snippets.map((snippet) => ({
    ...snippet,
    id: `anexo-${fileSlug(fileName)}-${snippet.id}`,
    sourceType: 'anexo' as const,
    sourceName: fileName,
    sourceLabel: `${fileName}, pagina ${snippet.pageNumber}`,
  }));
  const snippetById = new Map<string, PreliminaryStudyContextSnippet>();

  for (const snippet of [...baseSnippets, ...cctSnippets]) {
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
    snippets,
    warnings,
  };
}

export async function analyzePreliminaryStudySupplementalPdfFile(file: File): Promise<PreliminaryStudySupplementalPdfAnalysis> {
  if (file.type && file.type !== 'application/pdf') {
    throw new Error(`${file.name} nao e um arquivo PDF.`);
  }

  if (file.size > PRELIMINARY_STUDY_SUPPLEMENTAL_MAX_FILE_SIZE) {
    throw new Error(`${file.name} excede o limite de 20 MB.`);
  }

  const pages = await extractPreliminaryStudyPdfPagesFromArrayBuffer(await file.arrayBuffer());
  return analyzePreliminaryStudySupplementalPdfPages(file.name, pages);
}
