import { getSupabaseFunctionErrorMessage } from '@/lib/supabaseFunctionErrors';
import { supabase } from '@/lib/supabase';
import {
  comprasnetEtpQuestions,
  normalizeComprasnetEtpText,
  type ComprasnetEtpAnswer,
} from '@/lib/comprasnetEtpQuestionnaire';
import type { DocumentContextSnippet } from '@/lib/documentContextSnippets';
import type { PreliminaryStudyPdfAnalysis } from '@/lib/preliminaryStudyProcessPdf';
import type { SuapProcesso } from '@/types';

export type ComprasnetEtpDraftField = {
  key: string;
  label: string;
  value?: string;
  status: 'confirmed' | 'inferred' | 'missing';
  source: string;
};

export type ComprasnetEtpDraftSection = {
  id: string;
  title: string;
  html: string;
};

export type ComprasnetEtpDraftResult = {
  status: 'generated' | 'blocked';
  title: string;
  subtitle?: string;
  html?: string;
  sections?: ComprasnetEtpDraftSection[];
  warnings: string[];
  missingRequiredFields: string[];
  fields: ComprasnetEtpDraftField[];
  blockedReason?: string;
  model?: string;
};

export type GenerateComprasnetEtpParams = {
  processo?: SuapProcesso | null;
  manualObject?: string;
  analysis?: PreliminaryStudyPdfAnalysis | null;
  questionnaireAnswers?: ComprasnetEtpAnswer[];
  supplementalSnippets?: DocumentContextSnippet[];
};

function buildPayload(params: GenerateComprasnetEtpParams) {
  const answers = params.questionnaireAnswers || [];
  const contextSnippets = [
    ...(params.analysis?.snippets || []).map((snippet) => ({ ...snippet, sourceType: snippet.sourceType || 'processo' as const })),
    ...(params.supplementalSnippets || []),
  ];

  return {
    processo: params.processo
      ? {
          id: params.processo.id,
          suapId: params.processo.suapId,
          numProcesso: params.processo.numProcesso,
          beneficiario: params.processo.beneficiario,
          assunto: params.processo.assunto,
          contrato: params.processo.contrato || params.processo.dadosCompletos?.contrato_numero,
        }
      : null,
    manualObject: normalizeComprasnetEtpText(params.manualObject),
    questions: comprasnetEtpQuestions,
    questionnaireAnswers: answers,
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
    analysisWarnings: params.analysis?.warnings || [],
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildLocalDraft(params: GenerateComprasnetEtpParams, warning?: string): ComprasnetEtpDraftResult {
  const answers = new Map((params.questionnaireAnswers || []).map((answer) => [answer.questionId, answer]));
  const sections = comprasnetEtpQuestions.map((question) => {
    const value = normalizeComprasnetEtpText(answers.get(question.id)?.value);
    const content = value || `[CAMPO PENDENTE: ${question.title}]`;
    return {
      id: question.id,
      title: question.title,
      html: `<p>${escapeHtml(content)}</p>`,
    };
  });
  const missingRequiredFields = comprasnetEtpQuestions
    .filter((question) => question.required && !normalizeComprasnetEtpText(answers.get(question.id)?.value))
    .map((question) => question.title);

  return {
    status: 'generated',
    title: 'Estudo Técnico Preliminar',
    subtitle: params.processo?.numProcesso ? `Processo ${params.processo.numProcesso}` : 'Rascunho para revisão',
    sections,
    html: sections.map((section) => `<h2>${escapeHtml(section.title)}</h2>${section.html}`).join(''),
    warnings: [...(params.analysis?.warnings || []), ...(warning ? [warning] : [])],
    missingRequiredFields,
    fields: comprasnetEtpQuestions.map((question) => ({
      key: question.id,
      label: question.title,
      value: normalizeComprasnetEtpText(answers.get(question.id)?.value) || undefined,
      status: normalizeComprasnetEtpText(answers.get(question.id)?.value) ? 'confirmed' : 'missing',
      source: answers.get(question.id)?.origin === 'ai' ? 'IA revisada pelo usuário' : 'dados informados',
    })),
    model: 'fallback-local',
  };
}

export const comprasnetEtpService = {
  async generateDraft(params: GenerateComprasnetEtpParams): Promise<ComprasnetEtpDraftResult> {
    try {
      const { data, error } = await supabase.functions.invoke('gerar-etp-comprasnet', {
        body: buildPayload(params),
      });
      if (error) throw new Error(await getSupabaseFunctionErrorMessage(error));
      return data as ComprasnetEtpDraftResult;
    } catch (error) {
      console.warn('Falha ao chamar gerar-etp-comprasnet; usando fallback local.', error);
      return buildLocalDraft(
        params,
        'A função de geração do ETP não respondeu. Foi usado um rascunho local para revisão.',
      );
    }
  },
};

