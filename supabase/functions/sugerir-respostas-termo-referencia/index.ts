const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type QuestionnaireOption = {
  id?: string;
  label?: string;
  text?: string;
};

type QuestionnaireQuestion = {
  id?: string;
  kind?: 'exclusive' | 'optional' | 'field';
  title?: string;
  prompt?: string;
  guidance?: string;
  placeholder?: string;
  options?: QuestionnaireOption[];
};

type ReferenceTermSuggestionRequest = {
  processo?: Record<string, unknown>;
  template?: {
    id?: string;
    code?: string;
    name?: string;
    description?: string;
    versionLabel?: string;
    fileName?: string;
    questionnaireSchema?: {
      questions?: QuestionnaireQuestion[];
    };
  };
  contextSnippets?: Array<{
    id?: string;
    label?: string;
    kind?: string;
    pageNumber?: number;
    excerpt?: string;
    sourceType?: 'processo' | 'anexo' | 'etp';
    sourceName?: string;
    sourceLabel?: string;
  }>;
  analysisWarnings?: string[];
};

type QuestionSuggestion = {
  questionId: string;
  kind: 'exclusive' | 'optional' | 'field';
  status: 'suggested' | 'unanswered';
  selectedOptionId?: string;
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
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const stripJsonFence = (value: string) =>
  value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

function parseGeminiJson(content: string): Record<string, unknown> {
  const stripped = stripJsonFence(content);

  try {
    return JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    const firstBrace = stripped.indexOf('{');
    const lastBrace = stripped.lastIndexOf('}');

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(stripped.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
      } catch {
        // Fall through to the operational error below.
      }
    }
  }

  throw new Error('A IA retornou JSON invalido ao sugerir respostas do questionario.');
}

function getGeminiApiKey() {
  return (
    Deno.env.get('GEMINI_API_KEY') ||
    Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY') ||
    Deno.env.get('GOOGLE_API_KEY')
  );
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function getModelCandidates() {
  const configuredModel = Deno.env.get('GEMINI_REFERENCE_TERM_PREFILL_MODEL') ||
    Deno.env.get('GEMINI_REFERENCE_TERM_MODEL') ||
    'gemini-2.5-flash-lite';

  return uniqueStrings([
    configuredModel,
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
  ]);
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

function questionPrompt(question: QuestionnaireQuestion) {
  return typeof question.prompt === 'string' && question.prompt.trim()
    ? question.prompt.trim()
    : typeof question.title === 'string' && question.title.trim()
      ? question.title.trim()
      : 'Pergunta do modelo';
}

function normalizeQuestionKind(value: unknown): 'exclusive' | 'optional' | 'field' | undefined {
  return value === 'exclusive' || value === 'optional' || value === 'field' ? value : undefined;
}

function normalizeConfidence(value: unknown): 'high' | 'medium' | undefined {
  return value === 'high' || value === 'medium' ? value : undefined;
}

function normalizeQuestions(request: ReferenceTermSuggestionRequest) {
  const questions = request.template?.questionnaireSchema?.questions;
  if (!Array.isArray(questions)) return [];

  return questions
    .map((question) => (question && typeof question === 'object' ? question : null))
    .filter((question): question is QuestionnaireQuestion => Boolean(question?.id && question.kind));
}

function buildQuestionContext(questions: QuestionnaireQuestion[]) {
  return questions.map((question) => ({
    id: question.id,
    kind: question.kind,
    title: question.title,
    prompt: questionPrompt(question),
    guidance: question.guidance,
    placeholder: question.placeholder,
    options: (question.options || []).map((option) => ({
      id: option.id,
      label: option.label,
      text: option.text,
    })),
  }));
}

function buildPrompt(request: ReferenceTermSuggestionRequest, questions: QuestionnaireQuestion[]) {
  return [
    'Voce e um assistente especializado em contratacoes publicas e Termos de Referencia de compras sob a Lei 14.133/2021.',
    'Sua tarefa e sugerir respostas para o questionario do modelo AGU antes da revisao do usuario.',
    'Regra principal: responda somente quando houver fonte explicita nos trechos de apoio. Esses trechos podem vir do processo ou do ETP editado no editor. Nao inferir sem trecho-fonte.',
    'Se nao houver fonte clara para uma pergunta, marque status "unanswered".',
    'Para perguntas exclusive ou optional, escolha apenas uma option id existente quando o texto do processo sustentar diretamente a escolha.',
    'Para perguntas field, preencha value com texto objetivo baseado no processo.',
    'Toda sugestao precisa trazer justification, sourceExcerpt e confidence. Quando a fonte for processo/anexo, traga sourcePage se existir. Quando a fonte for ETP, traga sourceType "etp" e sourceLabel.',
    'sourceExcerpt deve copiar ou resumir fielmente o trecho usado como evidencia.',
    'Responda somente JSON valido, sem markdown e sem comentarios.',
    'O JSON deve seguir exatamente este formato:',
    '{"status":"generated","warnings":["..."],"suggestions":[{"questionId":"...","kind":"exclusive|optional|field","status":"suggested|unanswered","selectedOptionId":"... opcional","value":"... opcional","justification":"...","sourcePage":1,"sourceType":"processo|anexo|etp","sourceLabel":"...","sourceExcerpt":"...","confidence":"high|medium"}]}',
    '',
    `Processo: ${JSON.stringify(request.processo || {}, null, 2)}`,
    '',
    `Modelo: ${JSON.stringify({
      id: request.template?.id,
      code: request.template?.code,
      name: request.template?.name,
      description: request.template?.description,
      versionLabel: request.template?.versionLabel,
      fileName: request.template?.fileName,
    }, null, 2)}`,
    '',
    `Perguntas do questionario:\n${JSON.stringify(buildQuestionContext(questions), null, 2)}`,
    '',
    `Trechos de apoio:\n${JSON.stringify(request.contextSnippets || [], null, 2)}`,
    '',
    `Alertas da analise local:\n${JSON.stringify(request.analysisWarnings || [], null, 2)}`,
  ].join('\n');
}

function normalizeSuggestion(raw: unknown, questionById: Map<string, QuestionnaireQuestion>): QuestionSuggestion | null {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const questionId = typeof record.questionId === 'string' ? record.questionId.trim() : '';
  const question = questionById.get(questionId);
  if (!question) return null;

  const kind = normalizeQuestionKind(record.kind) || question.kind;
  if (!kind) return null;

  const status = record.status === 'suggested' ? 'suggested' : 'unanswered';
  const selectedOptionId = typeof record.selectedOptionId === 'string' ? record.selectedOptionId.trim() : '';
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
  const confidence = normalizeConfidence(record.confidence) || 'medium';

  if (status !== 'suggested') {
    return {
      questionId,
      kind,
      status: 'unanswered',
    };
  }

  const hasPageSource = Boolean(justification && sourcePage && sourceExcerpt);
  const hasEtpSource = sourceType === 'etp' && Boolean(justification && sourceLabel && sourceExcerpt);
  if (!hasPageSource && !hasEtpSource) {
    return {
      questionId,
      kind,
      status: 'unanswered',
    };
  }

  if ((kind === 'exclusive' || kind === 'optional') && !question.options?.some((option) => option.id === selectedOptionId)) {
    return {
      questionId,
      kind,
      status: 'unanswered',
    };
  }

  if (kind === 'field' && !value) {
    return {
      questionId,
      kind,
      status: 'unanswered',
    };
  }

  return {
    questionId,
    kind,
    status: 'suggested',
    selectedOptionId: selectedOptionId || undefined,
    value: value || undefined,
    justification,
    sourcePage,
    sourceType,
    sourceLabel: sourceLabel || undefined,
    sourceExcerpt,
    confidence,
  };
}

function normalizeSuggestionResult(raw: Record<string, unknown>, questions: QuestionnaireQuestion[], model: string) {
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
    : [];
  const questionById = new Map(questions.map((question) => [question.id || '', question]));
  const rawSuggestions = Array.isArray(raw.suggestions) ? raw.suggestions : [];
  const suggestionsById = new Map<string, QuestionSuggestion>();

  for (const rawSuggestion of rawSuggestions) {
    const suggestion = normalizeSuggestion(rawSuggestion, questionById);
    if (suggestion) {
      suggestionsById.set(suggestion.questionId, suggestion);
    }
  }

  for (const question of questions) {
    const questionId = question.id || '';
    if (!suggestionsById.has(questionId)) {
      suggestionsById.set(questionId, {
        questionId,
        kind: question.kind || 'field',
        status: 'unanswered',
      });
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.05,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  const responseBody = await geminiResponse.json();

  if (!geminiResponse.ok) {
    const errorMessage =
      (responseBody?.error && typeof responseBody.error === 'object' && 'message' in responseBody.error
        ? String(responseBody.error.message)
        : '') || 'O Gemini recusou a sugestao de respostas do questionario.';

    throw new Error(errorMessage);
  }

  const content = extractGeminiText(responseBody as Record<string, unknown>);
  if (!content) {
    throw new Error('A resposta do Gemini veio vazia ao sugerir respostas do questionario.');
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

  throw new Error(`Nao foi possivel sugerir respostas com os modelos Gemini configurados. ${errors.join(' | ')}`);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await request.json()) as ReferenceTermSuggestionRequest;
    const questions = normalizeQuestions(body);

    if (questions.length === 0) {
      return jsonResponse({
        status: 'generated',
        warnings: ['O modelo ativo nao possui perguntas para sugestao automatica.'],
        suggestions: [],
      });
    }

    const geminiApiKey = getGeminiApiKey();
    if (!geminiApiKey) {
      return jsonResponse(
        {
          error:
            'A funcao de sugestao de respostas do Termo de Referencia precisa de GEMINI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY ou GOOGLE_API_KEY no ambiente do Supabase.',
        },
        500,
      );
    }

    const prompt = buildPrompt(body, questions);
    const { content, model } = await callGeminiWithFallback(prompt, geminiApiKey, getModelCandidates());
    const parsed = parseGeminiJson(content);

    return jsonResponse(normalizeSuggestionResult(parsed, questions, model));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado ao sugerir respostas do questionario.';
    return jsonResponse({ error: message }, 500);
  }
});
