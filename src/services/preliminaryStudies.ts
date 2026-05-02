import { analyzePreliminaryStudyPdfFromArrayBuffer, type PreliminaryStudyPdfAnalysis } from '@/lib/preliminaryStudyProcessPdf';
import type { DocumentContextSnippet } from '@/lib/documentContextSnippets';
import { isEtpInstitutionalContextSnippet } from '@/lib/etpInstitutionalContexts';
import {
  getPreliminaryStudyMissingRequiredFields,
  normalizePreliminaryStudyAnswerValue,
  preliminaryStudyQuestions,
  type PreliminaryStudyQuestionAnswer,
  type PreliminaryStudyQuestionSuggestion,
} from '@/lib/preliminaryStudyQuestionnaire';
import { getSupabaseFunctionErrorMessage } from '@/lib/supabaseFunctionErrors';
import { supabase } from '@/lib/supabase';
import { suapProcessosService } from '@/services/suapProcessos';
import type { SuapProcesso } from '@/types';

export type PreliminaryStudyDraftField = {
  key: string;
  label: string;
  value?: string;
  status: 'confirmed' | 'inferred' | 'missing';
  source: string;
};

export type PreliminaryStudyDraftSection = {
  id: string;
  title: string;
  html: string;
};

export type PreliminaryStudyDraftResult = {
  status: 'generated' | 'blocked';
  title: string;
  subtitle?: string;
  html?: string;
  sections?: PreliminaryStudyDraftSection[];
  warnings: string[];
  missingRequiredFields: string[];
  fields: PreliminaryStudyDraftField[];
  blockedReason?: string;
  model?: string;
};

export type PreliminaryStudyQuestionSuggestionResult = {
  status: 'generated';
  suggestions: PreliminaryStudyQuestionSuggestion[];
  warnings: string[];
  model?: string;
};

export type PreliminaryStudyQuestionTextResult = {
  status: 'generated';
  value: string;
  warnings: string[];
  model?: string;
};

export type GeneratePreliminaryStudyParams = {
  processo?: SuapProcesso | null;
  manualObject?: string;
  analysis?: PreliminaryStudyPdfAnalysis | null;
  questionnaireAnswers?: PreliminaryStudyQuestionAnswer[];
  supplementalSnippets?: DocumentContextSnippet[];
};

export type GeneratePreliminaryStudyQuestionTextParams = GeneratePreliminaryStudyParams & {
  question: (typeof preliminaryStudyQuestions)[number];
  userNotes?: string;
};

export type SuggestPreliminaryStudyQuestionnaireParams = {
  processo?: SuapProcesso | null;
  manualObject?: string;
  analysis?: PreliminaryStudyPdfAnalysis | null;
  supplementalSnippets?: DocumentContextSnippet[];
};

function normalizeConfidence(value: unknown): 'high' | 'medium' | undefined {
  return value === 'high' || value === 'medium' ? value : undefined;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function answerValue(answer?: PreliminaryStudyQuestionAnswer) {
  if (!answer || answer.skipped) return '';
  return normalizePreliminaryStudyAnswerValue(answer.value);
}

function limitContextText(value: string, maxLength = 650) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).replace(/\s+\S*$/, '').trim()}...`;
}

function isInstitutionalSnippet(snippet: DocumentContextSnippet) {
  return isEtpInstitutionalContextSnippet(snippet) || snippet.sourceType === 'institucional';
}

function isProcessSuggestionSnippet(snippet: DocumentContextSnippet) {
  return !isInstitutionalSnippet(snippet) && snippet.sourceType !== 'anexo';
}

function findRelevantContextExcerpt(params: GeneratePreliminaryStudyQuestionTextParams) {
  const questionId = params.question.id.toLowerCase();
  const title = params.question.title.toLowerCase();
  const snippets = [
    ...(params.analysis?.snippets || []),
    ...(params.supplementalSnippets || []).filter((snippet) => !isInstitutionalSnippet(snippet)),
  ];
  const matchingSnippet = snippets.find((snippet) => {
    const kind = snippet.kind.toLowerCase();
    const label = snippet.label.toLowerCase();
    return questionId.includes(kind) || kind.includes(questionId) || title.includes(label) || label.includes(title);
  });

  return matchingSnippet?.excerpt ? normalizePreliminaryStudyAnswerValue(matchingSnippet.excerpt) : '';
}

function findInstitutionalContextExcerpt(params: Pick<GeneratePreliminaryStudyParams, 'supplementalSnippets'>) {
  const snippet = params.supplementalSnippets?.find(isInstitutionalSnippet);
  return snippet?.excerpt ? limitContextText(normalizePreliminaryStudyAnswerValue(snippet.excerpt)) : '';
}

function buildLocalQuestionText(params: GeneratePreliminaryStudyQuestionTextParams, warning?: string): PreliminaryStudyQuestionTextResult {
  const objectValue = normalizePreliminaryStudyAnswerValue(
    params.manualObject || params.processo?.assunto || 'objeto da contratacao a ser detalhado',
  );
  const notes = normalizePreliminaryStudyAnswerValue(params.userNotes || '');
  const contextExcerpt = findRelevantContextExcerpt(params);
  const institutionalContext = findInstitutionalContextExcerpt(params);
  const baseContext = notes || contextExcerpt || objectValue;
  const institutionalSupport = institutionalContext
    ? `A unidade demandante e o campus descrito no contexto institucional: ${institutionalContext}. Use esse campus como dado real da contratacao, nao como exemplo.`
    : '';
  const pendingMarker = `[CAMPO PENDENTE: ${params.question.title}]`;

  const sectionTemplates: Record<string, string> = {
    necessidade: `A necessidade da contratacao deve ser registrada a partir do atendimento continuo da demanda administrativa relacionada a ${objectValue}. ${institutionalSupport} ${baseContext ? `Como ponto de partida para revisao, considera-se: ${baseContext}.` : ''} ${pendingMarker}`,
    alinhamento: `A contratacao deve ser vinculada ao planejamento institucional aplicavel e aos instrumentos de governanca de contratacoes. ${institutionalSupport} ${baseContext ? `Informacao inicial considerada: ${baseContext}.` : ''} ${pendingMarker}`,
    requisitos: `Os requisitos da solucao devem observar a natureza continua do servico, os padroes minimos de qualidade, as condicoes de execucao, a fiscalizacao contratual e as obrigacoes da contratada. ${institutionalSupport} ${baseContext ? `Informacao inicial considerada: ${baseContext}.` : ''}`,
    quantitativos: `Os quantitativos devem ser definidos com base na demanda estimada, historico de consumo, locais de execucao, frequencia dos servicos e parametros tecnicos aplicaveis. ${institutionalSupport} ${baseContext ? `Informacao inicial considerada: ${baseContext}.` : ''} ${pendingMarker}`,
    mercado: `O levantamento de mercado deve comparar alternativas capazes de atender a necessidade administrativa, incluindo modelos de execucao, praticas usuais para servicos continuos e eventuais ganhos de eficiencia. ${institutionalSupport} ${baseContext ? `Ponto de partida: ${baseContext}.` : ''}`,
    estimativa: `A estimativa de valor deve ser demonstrada por pesquisa de precos idonea e memoria de calculo compativel com os quantitativos e requisitos da contratacao. ${institutionalSupport} ${baseContext ? `Informacao inicial considerada: ${baseContext}.` : ''} ${pendingMarker}`,
    solucao: `A solucao proposta deve descrever, de forma integrada, como a contratacao atendera a necessidade identificada para ${objectValue}, considerando escopo, forma de execucao, vigencia e mecanismos de acompanhamento. ${institutionalSupport} ${baseContext ? `Informacao inicial considerada: ${baseContext}.` : ''}`,
    parcelamento: `A analise de parcelamento deve avaliar a viabilidade tecnica e economica da divisao do objeto, indicando se o parcelamento amplia a competitividade sem prejudicar a eficiencia, a padronizacao e a gestao contratual. ${institutionalSupport} ${baseContext ? `Informacao inicial considerada: ${baseContext}.` : ''} ${pendingMarker}`,
    resultados: `Os resultados pretendidos devem indicar os beneficios esperados com a contratacao, como continuidade operacional, melhoria da qualidade do servico, reducao de riscos administrativos e atendimento adequado ao interesse publico. ${institutionalSupport} ${baseContext ? `Ponto de partida: ${baseContext}.` : ''}`,
    providencias: `As providencias previas devem registrar medidas necessarias antes da contratacao, como ajustes de fiscalizacao, definicao de rotinas, verificacao de disponibilidade orcamentaria e preparacao da equipe responsavel. ${institutionalSupport} ${baseContext ? `Informacao inicial considerada: ${baseContext}.` : ''}`,
    correlatas: `Devem ser verificadas contratacoes correlatas ou interdependentes que possam influenciar o escopo, a execucao, os quantitativos ou a estrategia de contratacao. ${institutionalSupport} ${baseContext ? `Informacao inicial considerada: ${baseContext}.` : ''}`,
    ambientais: `Os impactos ambientais e criterios de sustentabilidade devem ser avaliados conforme a natureza do servico, incluindo uso racional de recursos, reducao de residuos, exigencias de materiais adequados e boas praticas de execucao. ${institutionalSupport} ${baseContext ? `Informacao inicial considerada: ${baseContext}.` : ''}`,
    conclusao: `Com base nas informacoes preliminares, a viabilidade da contratacao deve ser concluida apos confirmacao da necessidade, dos quantitativos, da estimativa de valor, da estrategia de parcelamento e dos demais requisitos legais. ${institutionalSupport} ${baseContext ? `Ponto de partida: ${baseContext}.` : ''} ${pendingMarker}`,
  };

  const value = sectionTemplates[params.question.id] ||
    `Texto preliminar para a secao "${params.question.title}". ${institutionalSupport} ${baseContext ? `Informacao inicial considerada: ${baseContext}.` : ''} ${pendingMarker}`;

  return {
    status: 'generated',
    value: value.replace(/\s+/g, ' ').trim(),
    warnings: warning ? [warning] : [],
    model: 'fallback-local',
  };
}

function buildLocalPreliminaryStudyDraft(params: GeneratePreliminaryStudyParams, warning?: string): PreliminaryStudyDraftResult {
  const answers = params.questionnaireAnswers || [];
  const answerByQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));
  const processoLabel = params.processo?.numProcesso || params.processo?.suapId;
  const objectValue = normalizePreliminaryStudyAnswerValue(params.manualObject || params.processo?.assunto || '');
  const sections: PreliminaryStudyDraftSection[] = [
    {
      id: 'identificacao',
      title: 'Identificacao',
      html: [
        '<h2>1. Identificacao</h2>',
        `<p><strong>Processo:</strong> ${escapeHtml(processoLabel || 'Nao informado')}</p>`,
        `<p><strong>Objeto:</strong> ${escapeHtml(objectValue || '[CAMPO PENDENTE: objeto da licitacao]')}</p>`,
      ].join(''),
    },
    ...preliminaryStudyQuestions.map((question, index) => {
      const value = answerValue(answerByQuestion.get(question.id));
      const pending = `[CAMPO PENDENTE: ${question.title}]`;
      return {
        id: question.id,
        title: question.title,
        html: `<h2>${index + 2}. ${escapeHtml(question.title)}</h2><p>${escapeHtml(value || pending)}</p>`,
      };
    }),
  ];
  const missingRequiredFields = getPreliminaryStudyMissingRequiredFields(answers);

  return {
    status: 'generated',
    title: 'Estudo Tecnico Preliminar - Servicos Continuos',
    subtitle: processoLabel ? `Processo ${processoLabel}` : 'Rascunho a partir de objeto informado manualmente',
    html: [
      '<h1>Estudo Tecnico Preliminar</h1>',
      '<p><strong>Tipo:</strong> Servicos continuos</p>',
      ...sections.map((section) => section.html),
    ].join('\n'),
    sections,
    warnings: [
      ...(params.analysis?.warnings || []),
      ...(warning ? [warning] : []),
    ],
    missingRequiredFields,
    fields: preliminaryStudyQuestions.map((question) => {
      const value = answerValue(answerByQuestion.get(question.id));
      return {
        key: question.id,
        label: question.title,
        value: value || undefined,
        status: value ? 'confirmed' : 'missing',
        source: answerByQuestion.get(question.id)?.origin === 'ai' ? 'sugestao da IA aprovada' : 'questionario do ETP',
      };
    }),
    model: 'fallback-local',
  };
}

export function normalizePreliminaryStudyQuestionSuggestionResult(value: unknown): PreliminaryStudyQuestionSuggestionResult {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const knownQuestionIds = new Set(preliminaryStudyQuestions.map((question) => question.id));
  const suggestions = Array.isArray(raw.suggestions)
    ? raw.suggestions
        .map((item) => {
          const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
          const questionId = typeof record.questionId === 'string' ? record.questionId.trim() : '';
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
          const answerValue = typeof record.value === 'string' ? record.value.trim() : '';

          if (!questionId || !knownQuestionIds.has(questionId)) return null;
          if (status === 'suggested' && (!sourceExcerpt || !justification || !answerValue)) return null;
          if (status === 'suggested' && sourceType === 'anexo') return null;
          if (status === 'suggested' && !sourcePage) return null;

          return {
            questionId,
            status,
            value: answerValue || undefined,
            justification: justification || undefined,
            sourcePage,
            sourceType,
            sourceLabel: sourceLabel || undefined,
            sourceExcerpt: sourceExcerpt || undefined,
            confidence: normalizeConfidence(record.confidence) || (status === 'suggested' ? 'medium' : undefined),
          } satisfies PreliminaryStudyQuestionSuggestion;
        })
        .filter((item): item is PreliminaryStudyQuestionSuggestion => Boolean(item))
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

export function normalizePreliminaryStudyQuestionTextResult(
  value: unknown,
  fallbackParams: GeneratePreliminaryStudyQuestionTextParams,
): PreliminaryStudyQuestionTextResult {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const generatedValue = typeof raw.value === 'string' ? raw.value.trim() : '';
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
    : [];
  const model = typeof raw.model === 'string' && raw.model.trim() ? raw.model.trim() : undefined;

  if (!generatedValue) {
    return buildLocalQuestionText(fallbackParams, 'A IA nao retornou texto para a secao. Foi usado um texto local de apoio.');
  }

  return {
    status: 'generated',
    value: generatedValue,
    warnings,
    model,
  };
}

function buildPreliminaryStudyPayload({
  processo,
  manualObject,
  analysis,
  questionnaireAnswers,
  supplementalSnippets,
}: GeneratePreliminaryStudyParams) {
  const answers = questionnaireAnswers || [];
  const contextSnippets = [
    ...(analysis?.snippets || []).map((snippet) => ({ ...snippet, sourceType: snippet.sourceType || 'processo' as const })),
    ...(supplementalSnippets || []),
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
    manualObject: manualObject || '',
    questions: preliminaryStudyQuestions,
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
    analysisWarnings: analysis?.warnings || [],
    localMissingRequiredFields: getPreliminaryStudyMissingRequiredFields(answers),
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

export const preliminaryStudiesService = {
  async analyzeProcessPdf(processo: SuapProcesso): Promise<PreliminaryStudyPdfAnalysis> {
    const arrayBuffer = await fetchPdfArrayBuffer(processo);
    return analyzePreliminaryStudyPdfFromArrayBuffer(arrayBuffer);
  },

  async generateDraft(params: GeneratePreliminaryStudyParams): Promise<PreliminaryStudyDraftResult> {
    const payload = buildPreliminaryStudyPayload(params);

    try {
      const { data, error } = await supabase.functions.invoke('gerar-etp-servicos-continuos', {
        body: payload,
      });

      if (error) {
        throw new Error(await getSupabaseFunctionErrorMessage(error));
      }

      return data as PreliminaryStudyDraftResult;
    } catch (error) {
      console.warn('Falha ao chamar gerar-etp-servicos-continuos; usando fallback local.', error);
      return buildLocalPreliminaryStudyDraft(
        params,
        'A Edge Function de geracao do ETP nao respondeu. O rascunho foi montado localmente com as respostas e pendencias informadas.',
      );
    }
  },

  async suggestQuestionnaireAnswers(
    params: SuggestPreliminaryStudyQuestionnaireParams,
  ): Promise<PreliminaryStudyQuestionSuggestionResult> {
    const payload = buildPreliminaryStudyPayload({
      ...params,
      supplementalSnippets: params.supplementalSnippets?.filter(isProcessSuggestionSnippet),
    });

    try {
      const { data, error } = await supabase.functions.invoke('sugerir-respostas-etp-servicos-continuos', {
        body: payload,
      });

      if (error) {
        throw new Error(await getSupabaseFunctionErrorMessage(error));
      }

      return normalizePreliminaryStudyQuestionSuggestionResult(data);
    } catch (error) {
      console.warn('Falha ao chamar sugerir-respostas-etp-servicos-continuos; seguindo sem sugestoes.', error);
      return {
        status: 'generated',
        suggestions: [],
        warnings: ['Nao foi possivel consultar a Edge Function de sugestoes do ETP. Revise o questionario manualmente.'],
        model: 'fallback-local',
      };
    }
  },

  async generateQuestionText(
    params: GeneratePreliminaryStudyQuestionTextParams,
  ): Promise<PreliminaryStudyQuestionTextResult> {
    const payload = {
      ...buildPreliminaryStudyPayload(params),
      question: params.question,
      userNotes: params.userNotes || '',
    };

    try {
      const { data, error } = await supabase.functions.invoke('gerar-texto-etp-secao', {
        body: payload,
      });

      if (error) {
        throw new Error(await getSupabaseFunctionErrorMessage(error));
      }

      return normalizePreliminaryStudyQuestionTextResult(data, params);
    } catch (error) {
      console.warn('Falha ao chamar gerar-texto-etp-secao; usando texto local de apoio.', error);
      return buildLocalQuestionText(
        params,
        'A Edge Function de texto por secao do ETP nao respondeu. Foi usado um texto local de apoio para revisao.',
      );
    }
  },
};
