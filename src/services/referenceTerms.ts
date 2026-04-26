import { base64ToUint8Array, parseDocxTemplateArrayBuffer, type DocxTemplateExportPlan } from '@/lib/docxDocumentTemplate';
import { analyzeReferenceTermPdfFromArrayBuffer, type ReferenceTermPdfAnalysis } from '@/lib/referenceTermProcessPdf';
import { sanitizeReferenceTermQuestionnaireSchema } from '@/lib/referenceTermQuestionnaire';
import { getSupabaseFunctionErrorMessage } from '@/lib/supabaseFunctionErrors';
import { supabase } from '@/lib/supabase';
import type { DocumentContextSnippet, DocumentContextSourceType } from '@/lib/documentContextSnippets';
import {
  documentTemplatesService,
  type DocumentTemplateQuestionnaireSchema,
  type DocumentTemplateRecord,
} from '@/services/documentTemplates';
import { suapProcessosService } from '@/services/suapProcessos';
import type { SuapProcesso } from '@/types';

export type ReferenceTermDraftField = {
  key: string;
  label: string;
  value?: string;
  status: 'confirmed' | 'inferred' | 'missing';
  source: string;
};

export type ReferenceTermDraftSource = {
  label: string;
  pageStart?: number;
  pageEnd?: number;
};

export type ReferenceTermDraftResult = {
  status: 'generated' | 'blocked';
  title: string;
  subtitle?: string;
  html?: string;
  warnings: string[];
  missingRequiredFields: string[];
  fields: ReferenceTermDraftField[];
  sources: ReferenceTermDraftSource[];
  blockedReason?: string;
  model?: string;
  templatePlan?: DocxTemplateExportPlan;
};

export type ReferenceTermQuestionAnswer = {
  questionId: string;
  kind: 'exclusive' | 'optional' | 'field';
  skipped?: boolean;
  selectedOptionId?: string;
  value?: string;
  optionValues?: Record<string, string>;
  origin?: 'user' | 'ai';
  approved?: boolean;
  confidence?: 'high' | 'medium';
  sourcePage?: number;
  sourceType?: DocumentContextSourceType;
  sourceLabel?: string;
  sourceExcerpt?: string;
  justification?: string;
};

export type ReferenceTermQuestionSuggestion = {
  questionId: string;
  kind: 'exclusive' | 'optional' | 'field';
  status: 'suggested' | 'unanswered';
  selectedOptionId?: string;
  value?: string;
  justification?: string;
  sourcePage?: number;
  sourceType?: DocumentContextSourceType;
  sourceLabel?: string;
  sourceExcerpt?: string;
  confidence?: 'high' | 'medium';
};

export type ReferenceTermQuestionSuggestionResult = {
  status: 'generated';
  suggestions: ReferenceTermQuestionSuggestion[];
  warnings: string[];
  model?: string;
};

type GenerateReferenceTermParams = {
  processo?: SuapProcesso | null;
  analysis?: ReferenceTermPdfAnalysis | null;
  template: DocumentTemplateRecord;
  questionnaireSchema?: DocumentTemplateQuestionnaireSchema;
  questionnaireAnswers?: ReferenceTermQuestionAnswer[];
  etpContextSnippets?: DocumentContextSnippet[];
};

type SuggestReferenceTermQuestionnaireParams = {
  processo?: SuapProcesso | null;
  analysis?: ReferenceTermPdfAnalysis | null;
  template: DocumentTemplateRecord;
  questionnaireSchema?: DocumentTemplateQuestionnaireSchema;
  etpContextSnippets?: DocumentContextSnippet[];
};

function normalizeConfidence(value: unknown): 'high' | 'medium' | undefined {
  return value === 'high' || value === 'medium' ? value : undefined;
}

function normalizeQuestionKind(value: unknown): 'exclusive' | 'optional' | 'field' | undefined {
  return value === 'exclusive' || value === 'optional' || value === 'field' ? value : undefined;
}

export function normalizeReferenceTermQuestionSuggestionResult(value: unknown): ReferenceTermQuestionSuggestionResult {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const suggestions = Array.isArray(raw.suggestions)
    ? raw.suggestions
        .map((item) => {
          const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
          const questionId = typeof record.questionId === 'string' ? record.questionId.trim() : '';
          const kind = normalizeQuestionKind(record.kind);
          const status = record.status === 'suggested' ? 'suggested' : 'unanswered';
          const sourcePage = typeof record.sourcePage === 'number' && Number.isFinite(record.sourcePage)
            ? record.sourcePage
            : undefined;
          const sourceType = record.sourceType === 'processo' || record.sourceType === 'anexo' || record.sourceType === 'etp'
            ? record.sourceType
            : undefined;
          const sourceLabel = typeof record.sourceLabel === 'string' ? record.sourceLabel.trim() : '';
          const sourceExcerpt = typeof record.sourceExcerpt === 'string' ? record.sourceExcerpt.trim() : '';
          const justification = typeof record.justification === 'string' ? record.justification.trim() : '';
          const selectedOptionId = typeof record.selectedOptionId === 'string' ? record.selectedOptionId.trim() : '';
          const answerValue = typeof record.value === 'string' ? record.value.trim() : '';

          if (!questionId || !kind) return null;
          const hasPageSource = Boolean(sourcePage && sourceExcerpt && justification);
          const hasEtpSource = sourceType === 'etp' && Boolean(sourceLabel && sourceExcerpt && justification);
          if (status === 'suggested' && !hasPageSource && !hasEtpSource) return null;

          return {
            questionId,
            kind,
            status,
            selectedOptionId: selectedOptionId || undefined,
            value: answerValue || undefined,
            justification: justification || undefined,
            sourcePage,
            sourceType,
            sourceLabel: sourceLabel || undefined,
            sourceExcerpt: sourceExcerpt || undefined,
            confidence: normalizeConfidence(record.confidence) || (status === 'suggested' ? 'medium' : undefined),
          } satisfies ReferenceTermQuestionSuggestion;
        })
        .filter((item): item is ReferenceTermQuestionSuggestion => Boolean(item))
    : [];

  return {
    status: 'generated',
    suggestions,
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
      : [],
    model: typeof raw.model === 'string' && raw.model.trim() ? raw.model.trim() : undefined,
  };
}

function buildReferenceTermPayload({
  processo,
  analysis,
  template,
  questionnaireSchema,
  questionnaireAnswers,
  etpContextSnippets,
}: {
  processo?: SuapProcesso | null;
  analysis?: ReferenceTermPdfAnalysis | null;
  template: DocumentTemplateRecord;
  questionnaireSchema?: DocumentTemplateQuestionnaireSchema;
  questionnaireAnswers?: ReferenceTermQuestionAnswer[];
  etpContextSnippets?: DocumentContextSnippet[];
}) {
  const contextSnippets = [
    ...(analysis?.snippets || []).map((snippet) => ({ ...snippet, sourceType: 'processo' as const })),
    ...(etpContextSnippets || []),
  ];

  return {
    processo: processo
      ? {
          id: processo.id,
          suapId: processo.suapId,
          numProcesso: processo.numProcesso,
          beneficiario: processo.beneficiario,
          cpfCnpj: processo.cpfCnpj,
          assunto: processo.assunto,
          contrato: processo.contrato || processo.dadosCompletos?.contrato_numero,
          valorLiquido: processo.dadosCompletos?.val_nf,
          empenhos: processo.dadosCompletos?.empenhos || [],
        }
      : null,
    template: {
      id: template.id,
      code: template.code,
      name: template.name,
      description: template.description,
      versionLabel: template.versionLabel,
      fileName: template.fileName,
      templateText: template.templateText,
      editableBlocks: template.editableBlocks,
      questionnaireSchema: questionnaireSchema || template.questionnaireSchema,
    },
    questionnaireAnswers: questionnaireAnswers || [],
    contextSnippets: contextSnippets.map((snippet) => ({
      id: snippet.id,
      kind: snippet.kind,
      label: snippet.label,
      pageNumber: snippet.pageNumber,
      excerpt: snippet.excerpt,
      sourceType: snippet.sourceType || 'processo',
      sourceName: snippet.sourceName,
      sourceLabel: snippet.sourceLabel,
    })),
    analysisWarnings: analysis?.warnings || [],
  };
}

async function fetchPdfArrayBuffer(processo: SuapProcesso): Promise<ArrayBuffer> {
  if (!processo.pdfUrl) {
    throw new Error('Este processo ainda nao possui PDF sincronizado.');
  }

  const signedUrl = await suapProcessosService.getPdfSignedUrl(processo.pdfUrl);
  if (!signedUrl) {
    throw new Error('Nao foi possivel gerar o link temporario do PDF do processo.');
  }

  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error(`Falha ao baixar o PDF sincronizado. HTTP ${response.status}.`);
  }

  return response.arrayBuffer();
}

async function ensureTemplateQuestionnaireSchema(template: DocumentTemplateRecord): Promise<DocumentTemplateRecord> {
  if (template.questionnaireSchema?.questions?.length) {
    return {
      ...template,
      questionnaireSchema: sanitizeReferenceTermQuestionnaireSchema(
        template.questionnaireSchema,
        template.editableBlocks,
      ),
    };
  }

  try {
    const bytes = base64ToUint8Array(template.templateBase64);
    const parsed = await parseDocxTemplateArrayBuffer(bytes.buffer);
    return {
      ...template,
      questionnaireSchema: sanitizeReferenceTermQuestionnaireSchema(
        parsed.questionnaireSchema,
        parsed.editableBlocks,
      ),
    };
  } catch (error) {
    console.warn('Nao foi possivel derivar questionario do modelo DOCX ativo.', error);
    return template;
  }
}

export const referenceTermsService = {
  async analyzeProcessPdf(processo: SuapProcesso): Promise<ReferenceTermPdfAnalysis> {
    const arrayBuffer = await fetchPdfArrayBuffer(processo);
    return analyzeReferenceTermPdfFromArrayBuffer(arrayBuffer);
  },

  async getActiveTemplate(): Promise<DocumentTemplateRecord | null> {
    const template = await documentTemplatesService.getActiveTemplate('termo-referencia-compras');
    return template ? ensureTemplateQuestionnaireSchema(template) : null;
  },

  async generateDraft({
    processo,
    analysis,
    template,
    questionnaireSchema,
    questionnaireAnswers,
    etpContextSnippets,
  }: GenerateReferenceTermParams): Promise<ReferenceTermDraftResult> {
    const payload = buildReferenceTermPayload({ processo, analysis, template, questionnaireSchema, questionnaireAnswers, etpContextSnippets });

    const { data, error } = await supabase.functions.invoke('gerar-termo-referencia-compras', {
      body: payload,
    });

    if (error) {
      throw new Error(await getSupabaseFunctionErrorMessage(error));
    }

    return data as ReferenceTermDraftResult;
  },

  async suggestQuestionnaireAnswers({
    processo,
    analysis,
    template,
    questionnaireSchema,
    etpContextSnippets,
  }: SuggestReferenceTermQuestionnaireParams): Promise<ReferenceTermQuestionSuggestionResult> {
    const payload = buildReferenceTermPayload({ processo, analysis, template, questionnaireSchema, etpContextSnippets });

    const { data, error } = await supabase.functions.invoke('sugerir-respostas-termo-referencia', {
      body: payload,
    });

    if (error) {
      throw new Error(await getSupabaseFunctionErrorMessage(error));
    }

    return normalizeReferenceTermQuestionSuggestionResult(data);
  },
};
