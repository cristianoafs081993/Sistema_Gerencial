import { base64ToUint8Array, parseDocxTemplateArrayBuffer, type DocxTemplateExportPlan } from '@/lib/docxDocumentTemplate';
import { analyzeReferenceTermPdfFromArrayBuffer, type ReferenceTermPdfAnalysis } from '@/lib/referenceTermProcessPdf';
import { getSupabaseFunctionErrorMessage } from '@/lib/supabaseFunctionErrors';
import { supabase } from '@/lib/supabase';
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
  pageStart: number;
  pageEnd: number;
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
  justification?: string;
};

type GenerateReferenceTermParams = {
  processo: SuapProcesso;
  analysis: ReferenceTermPdfAnalysis;
  template: DocumentTemplateRecord;
  questionnaireSchema?: DocumentTemplateQuestionnaireSchema;
  questionnaireAnswers?: ReferenceTermQuestionAnswer[];
};

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
    return template;
  }

  try {
    const bytes = base64ToUint8Array(template.templateBase64);
    const parsed = await parseDocxTemplateArrayBuffer(bytes.buffer);
    return {
      ...template,
      questionnaireSchema: parsed.questionnaireSchema,
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
  }: GenerateReferenceTermParams): Promise<ReferenceTermDraftResult> {
    const payload = {
      processo: {
        id: processo.id,
        suapId: processo.suapId,
        numProcesso: processo.numProcesso,
        beneficiario: processo.beneficiario,
        cpfCnpj: processo.cpfCnpj,
        assunto: processo.assunto,
        contrato: processo.contrato || processo.dadosCompletos?.contrato_numero,
        valorLiquido: processo.dadosCompletos?.val_nf,
        empenhos: processo.dadosCompletos?.empenhos || [],
      },
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
      contextSnippets: analysis.snippets.map((snippet) => ({
        id: snippet.id,
        kind: snippet.kind,
        label: snippet.label,
        pageNumber: snippet.pageNumber,
        excerpt: snippet.excerpt,
      })),
      analysisWarnings: analysis.warnings,
    };

    const { data, error } = await supabase.functions.invoke('gerar-termo-referencia-compras', {
      body: payload,
    });

    if (error) {
      throw new Error(await getSupabaseFunctionErrorMessage(error));
    }

    return data as ReferenceTermDraftResult;
  },
};
