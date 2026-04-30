const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EtpQuestion = {
  id: string;
  title: string;
  prompt: string;
  guidance?: string;
  required?: boolean;
};

type EtpSuggestionRequest = {
  manualObject?: string;
  processo?: {
    numProcesso?: string | null;
    assunto?: string | null;
    beneficiario?: string | null;
  } | null;
  questions?: EtpQuestion[];
  contextSnippets?: Array<{
    id: string;
    kind: string;
    label: string;
    pageNumber?: number;
    excerpt: string;
    sourceType?: 'processo' | 'anexo' | 'etp' | 'institucional';
    sourceName?: string;
    sourceLabel?: string;
  }>;
  analysisWarnings?: string[];
};

type QuestionSuggestion = {
  questionId: string;
  status: 'suggested' | 'unanswered';
  value?: string;
  justification?: string;
  sourcePage?: number;
  sourceType?: 'processo' | 'anexo' | 'etp';
  sourceLabel?: string;
  sourceExcerpt?: string;
  confidence?: 'high' | 'medium';
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const stripJsonFence = (value: string) =>
  value
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

function parseGeminiJson(content: string): Record<string, unknown> {
  const stripped = stripJsonFence(content);
  try {
    return JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    const firstBrace = stripped.indexOf('{');
    const lastBrace = stripped.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(stripped.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
    }
  }

  throw new Error('A IA retornou JSON invalido ao sugerir respostas do ETP.');
}

function getGeminiApiKey() {
  return (
    Deno.env.get('GEMINI_API_KEY') ||
    Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY') ||
    Deno.env.get('GOOGLE_API_KEY') ||
    ''
  );
}

function getModelCandidates() {
  const configuredModel = Deno.env.get('GEMINI_ETP_PREFILL_MODEL') ||
    Deno.env.get('GEMINI_ETP_MODEL') ||
    Deno.env.get('GEMINI_REFERENCE_TERM_PREFILL_MODEL') ||
    Deno.env.get('GEMINI_REFERENCE_TERM_MODEL') ||
    'gemini-2.5-flash-lite';

  return [...new Set([configuredModel, 'gemini-2.5-flash-lite', 'gemini-2.5-flash'].filter(Boolean))];
}

function extractGeminiText(responseBody: Record<string, unknown>): string {
  const candidates = Array.isArray(responseBody.candidates) ? responseBody.candidates : [];
  const firstCandidate = candidates[0] && typeof candidates[0] === 'object'
    ? (candidates[0] as Record<string, unknown>)
    : null;
  const content = firstCandidate?.content && typeof firstCandidate.content === 'object'
    ? (firstCandidate.content as Record<string, unknown>)
    : null;
  const parts = Array.isArray(content?.parts) ? content?.parts : [];
  const firstPart = parts[0] && typeof parts[0] === 'object'
    ? (parts[0] as Record<string, unknown>)
    : null;
  return typeof firstPart?.text === 'string' ? firstPart.text : '';
}

function normalizeQuestions(request: EtpSuggestionRequest) {
  return Array.isArray(request.questions)
    ? request.questions.filter((question) => question?.id && question?.title && question?.prompt)
    : [];
}

type ContextSnippet = NonNullable<EtpSuggestionRequest['contextSnippets']>[number];

function isInstitutionalSnippet(snippet: ContextSnippet) {
  return snippet.kind === 'institucional' || snippet.sourceType === 'institucional';
}

function buildPrompt(request: EtpSuggestionRequest, questions: EtpQuestion[]) {
  const snippets = (request.contextSnippets || []).filter((snippet) => !isInstitutionalSnippet(snippet));

  return [
    'Voce e um assistente especializado em contratacoes publicas brasileiras.',
    'Sugira respostas para o questionario de Estudo Tecnico Preliminar de servicos continuos.',
    'Use somente os trechos-fonte fornecidos. Eles podem vir do processo ou de anexos tecnicos opcionais ja convertidos em texto. Nao invente informacao ausente.',
    'Contexto institucional da unidade demandante nao deve ser usado para sugerir respostas com fonte explicita.',
    'Se nao houver fonte suficiente para uma pergunta, retorne status "unanswered".',
    'Quando a fonte for anexo sem pagina, retorne sourceType "anexo" e preserve sourceLabel.',
    'Responda apenas JSON valido no formato:',
    '{"status":"generated","warnings":["..."],"suggestions":[{"questionId":"...","status":"suggested|unanswered","value":"...","justification":"...","sourcePage":1,"sourceType":"processo|anexo","sourceLabel":"... opcional","sourceExcerpt":"...","confidence":"high|medium"}]}',
    `Processo: ${JSON.stringify(request.processo || {})}`,
    `Objeto informado manualmente: ${request.manualObject || ''}`,
    `Perguntas: ${JSON.stringify(questions)}`,
    `Trechos tecnicos do processo/anexos: ${JSON.stringify(snippets)}`,
  ].join('\n\n');
}

function normalizeConfidence(value: unknown): 'high' | 'medium' | undefined {
  return value === 'high' || value === 'medium' ? value : undefined;
}

function normalizeSuggestion(raw: unknown, questionById: Map<string, EtpQuestion>): QuestionSuggestion | null {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const questionId = typeof record.questionId === 'string' ? record.questionId.trim() : '';
  const question = questionById.get(questionId);
  if (!question) return null;

  const status = record.status === 'suggested' ? 'suggested' : 'unanswered';
  const value = typeof record.value === 'string' ? record.value.trim() : '';
  const justification = typeof record.justification === 'string' ? record.justification.trim() : '';
  const sourcePage = typeof record.sourcePage === 'number' && Number.isFinite(record.sourcePage)
    ? record.sourcePage
    : undefined;
  const sourceType = record.sourceType === 'processo' || record.sourceType === 'anexo' || record.sourceType === 'etp'
    ? record.sourceType
    : undefined;
  const sourceLabel = typeof record.sourceLabel === 'string' ? record.sourceLabel.trim() : '';
  const sourceExcerpt = typeof record.sourceExcerpt === 'string' ? record.sourceExcerpt.trim() : '';

  if (status !== 'suggested') {
    return { questionId, status: 'unanswered' };
  }

  if (!value || !justification || !sourceExcerpt) {
    return { questionId, status: 'unanswered' };
  }

  if (!sourcePage && !(sourceType === 'anexo' && sourceLabel)) {
    return { questionId, status: 'unanswered' };
  }

  return {
    questionId,
    status: 'suggested',
    value,
    justification,
    sourcePage,
    sourceType,
    sourceLabel: sourceLabel || undefined,
    sourceExcerpt,
    confidence: normalizeConfidence(record.confidence) || 'medium',
  };
}

function normalizeSuggestionResult(raw: Record<string, unknown>, questions: EtpQuestion[], model?: string) {
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
    : [];
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const rawSuggestions = Array.isArray(raw.suggestions) ? raw.suggestions : [];
  const suggestionsById = new Map<string, QuestionSuggestion>();

  for (const rawSuggestion of rawSuggestions) {
    const suggestion = normalizeSuggestion(rawSuggestion, questionById);
    if (suggestion) {
      suggestionsById.set(suggestion.questionId, suggestion);
    }
  }

  for (const question of questions) {
    if (!suggestionsById.has(question.id)) {
      suggestionsById.set(question.id, { questionId: question.id, status: 'unanswered' });
    }
  }

  return {
    status: 'generated',
    warnings,
    suggestions: [...suggestionsById.values()],
    model,
  };
}

async function callGemini(prompt: string, geminiApiKey: string, model: string) {
  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    },
  );

  const responseBody = await geminiResponse.json();
  if (!geminiResponse.ok) {
    const errorMessage =
      typeof responseBody?.error?.message === 'string'
        ? responseBody.error.message
        : 'O Gemini recusou a sugestao de respostas do ETP.';
    throw new Error(errorMessage);
  }

  const content = extractGeminiText(responseBody as Record<string, unknown>);
  if (!content) {
    throw new Error('A resposta do Gemini veio vazia ao sugerir respostas do ETP.');
  }

  return content;
}

async function callGeminiWithFallback(prompt: string, geminiApiKey: string, modelCandidates: string[]) {
  const errors: string[] = [];

  for (const model of modelCandidates) {
    try {
      return {
        content: await callGemini(prompt, geminiApiKey, model),
        model,
      };
    } catch (error) {
      errors.push(`${model}: ${error instanceof Error ? error.message : 'falha desconhecida'}`);
    }
  }

  throw new Error(`Nao foi possivel sugerir respostas do ETP com os modelos Gemini configurados. ${errors.join(' | ')}`);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await request.json()) as EtpSuggestionRequest;
    const questions = normalizeQuestions(body);

    if (questions.length === 0) {
      return jsonResponse({
        status: 'generated',
        warnings: ['O questionario do ETP nao possui perguntas para sugestao automatica.'],
        suggestions: [],
      });
    }

    const evidenceSnippets = (body.contextSnippets || []).filter((snippet) => !isInstitutionalSnippet(snippet));

    if (!evidenceSnippets.length) {
      return jsonResponse({
        status: 'generated',
        warnings: ['Nao ha trechos tecnicos de processo ou anexo para sugerir respostas com fonte explicita.'],
        suggestions: questions.map((question) => ({ questionId: question.id, status: 'unanswered' })),
      });
    }

    const geminiApiKey = getGeminiApiKey();
    if (!geminiApiKey) {
      return jsonResponse(
        {
          error:
            'A funcao de sugestao do ETP precisa de GEMINI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY ou GOOGLE_API_KEY no ambiente do Supabase.',
        },
        500,
      );
    }

    const prompt = buildPrompt({ ...body, contextSnippets: evidenceSnippets }, questions);
    const { content, model } = await callGeminiWithFallback(prompt, geminiApiKey, getModelCandidates());
    const parsed = parseGeminiJson(content);
    return jsonResponse(normalizeSuggestionResult(parsed, questions, model));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado ao sugerir respostas do ETP.';
    console.error('sugerir-respostas-etp-servicos-continuos', error);
    return jsonResponse({ error: message }, 500);
  }
});
