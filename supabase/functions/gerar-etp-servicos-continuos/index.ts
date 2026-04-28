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

type EtpAnswer = {
  questionId: string;
  value?: string;
  skipped?: boolean;
  origin?: 'user' | 'ai' | 'system';
  approved?: boolean;
  sourcePage?: number;
  sourceExcerpt?: string;
  justification?: string;
};

type EtpRequest = {
  manualObject?: string;
  processo?: {
    id?: string;
    suapId?: string;
    numProcesso?: string | null;
    beneficiario?: string | null;
    assunto?: string | null;
    contrato?: string | null;
    valorLiquido?: string | number | null;
    empenhos?: string[];
  } | null;
  questions?: EtpQuestion[];
  questionnaireAnswers?: EtpAnswer[];
  contextSnippets?: Array<{
    id: string;
    kind: string;
    label: string;
    pageNumber?: number;
    excerpt: string;
    sourceType?: 'processo' | 'anexo' | 'etp';
    sourceName?: string;
    sourceLabel?: string;
  }>;
  analysisWarnings?: string[];
  localMissingRequiredFields?: string[];
};

type EtpSection = {
  id: string;
  title: string;
  html: string;
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

  throw new Error('A IA retornou JSON invalido ao gerar o ETP.');
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
  const configuredModel = Deno.env.get('GEMINI_ETP_MODEL') ||
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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function collapseSpaces(value?: string | null) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function normalizeQuestions(request: EtpRequest) {
  return Array.isArray(request.questions)
    ? request.questions.filter((question) => question?.id && question?.title && question?.prompt)
    : [];
}

function buildAnswerMap(answers?: EtpAnswer[]) {
  const answerMap = new Map<string, EtpAnswer>();
  for (const answer of answers || []) {
    const questionId = collapseSpaces(answer.questionId);
    if (!questionId) continue;
    answerMap.set(questionId, answer);
  }
  return answerMap;
}

function answerValue(answer?: EtpAnswer) {
  if (!answer || answer.skipped) return '';
  return collapseSpaces(answer.value);
}

function pendingText(question: EtpQuestion) {
  return `[CAMPO PENDENTE: ${question.title}]`;
}

function buildFallbackSections(request: EtpRequest, questions: EtpQuestion[]): EtpSection[] {
  const answers = buildAnswerMap(request.questionnaireAnswers);
  const sections: EtpSection[] = [
    {
      id: 'identificacao',
      title: 'Identificacao',
      html: [
        '<h2>1. Identificacao</h2>',
        `<p><strong>Processo:</strong> ${escapeHtml(request.processo?.numProcesso || request.processo?.suapId || 'Nao informado')}</p>`,
        `<p><strong>Objeto:</strong> ${escapeHtml(collapseSpaces(request.manualObject || request.processo?.assunto) || '[CAMPO PENDENTE: objeto da licitacao]')}</p>`,
      ].join(''),
    },
  ];

  questions.forEach((question, index) => {
    const value = answerValue(answers.get(question.id));
    sections.push({
      id: question.id,
      title: question.title,
      html: `<h2>${index + 2}. ${escapeHtml(question.title)}</h2><p>${escapeHtml(value || pendingText(question))}</p>`,
    });
  });

  return sections;
}

function buildHtml(sections: EtpSection[]) {
  return [
    '<h1>Estudo Tecnico Preliminar</h1>',
    '<p><strong>Tipo:</strong> Servicos continuos</p>',
    ...sections.map((section) => section.html),
  ].join('\n');
}

function buildFields(request: EtpRequest, questions: EtpQuestion[]) {
  const answers = buildAnswerMap(request.questionnaireAnswers);
  return questions.map((question) => {
    const value = answerValue(answers.get(question.id));
    return {
      key: question.id,
      label: question.title,
      value: value || undefined,
      status: value ? 'confirmed' : 'missing',
      source: answers.get(question.id)?.origin === 'ai' ? 'sugestao da IA aprovada' : 'questionario do ETP',
    };
  });
}

function missingRequiredFields(request: EtpRequest, questions: EtpQuestion[]) {
  const answers = buildAnswerMap(request.questionnaireAnswers);
  return questions
    .filter((question) => question.required && !answerValue(answers.get(question.id)))
    .map((question) => question.title);
}

function normalizeSections(raw: unknown): EtpSection[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const id = typeof record.id === 'string' ? record.id.trim() : '';
      const title = typeof record.title === 'string' ? record.title.trim() : '';
      const html = typeof record.html === 'string' ? record.html.trim() : '';
      if (!id || !title || !html) return null;
      return { id, title, html };
    })
    .filter((item): item is EtpSection => Boolean(item));
}

function normalizeAiResult(raw: Record<string, unknown>, fallbackSections: EtpSection[], request: EtpRequest, questions: EtpQuestion[], model?: string) {
  const sections = normalizeSections(raw.sections);
  const safeSections = sections.length > 0 ? sections : fallbackSections;
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
    : [];
  const missing = missingRequiredFields(request, questions);

  return {
    status: 'generated',
    title: 'Estudo Tecnico Preliminar - Servicos Continuos',
    subtitle: request.processo?.numProcesso
      ? `Processo ${request.processo.numProcesso}`
      : 'Rascunho a partir de objeto informado manualmente',
    html: typeof raw.html === 'string' && raw.html.trim() ? raw.html.trim() : buildHtml(safeSections),
    sections: safeSections,
    warnings: [...new Set([...(request.analysisWarnings || []), ...warnings])],
    missingRequiredFields: missing,
    fields: buildFields(request, questions),
    model,
  };
}

function buildPrompt(request: EtpRequest, questions: EtpQuestion[], fallbackSections: EtpSection[]) {
  return [
    'Voce e um assistente especializado em contratacoes publicas brasileiras.',
    'Gere um rascunho de Estudo Tecnico Preliminar para servicos continuos sob a Lei 14.133/2021 e IN SEGES 58/2022.',
    'Use somente respostas do questionario, objeto manual e trechos fornecidos. Os trechos podem vir do processo ou de anexos opcionais ja convertidos em texto pelo frontend. Nao invente dados ausentes.',
    'Quando usar anexo, preserve a referencia do arquivo/pagina indicada em sourceName, sourceLabel ou pageNumber.',
    'Quando faltar informacao, escreva [CAMPO PENDENTE: ...].',
    'Preserve linguagem formal, objetiva e adequada a ETP. A saida sera revisada por servidor.',
    'Responda apenas JSON valido no formato:',
    '{"status":"generated","warnings":["..."],"sections":[{"id":"...","title":"...","html":"<h2>...</h2><p>...</p>"}]}',
    `Processo: ${JSON.stringify(request.processo || {})}`,
    `Objeto manual: ${request.manualObject || ''}`,
    `Perguntas: ${JSON.stringify(questions)}`,
    `Respostas: ${JSON.stringify(request.questionnaireAnswers || [])}`,
    `Trechos de apoio: ${JSON.stringify(request.contextSnippets || [])}`,
    `Estrutura minima esperada: ${JSON.stringify(fallbackSections.map(({ id, title }) => ({ id, title })))}`,
  ].join('\n\n');
}

async function callGemini(prompt: string, geminiApiKey: string, model: string) {
  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.25, responseMimeType: 'application/json' },
      }),
    },
  );

  const responseBody = await geminiResponse.json();
  if (!geminiResponse.ok) {
    const errorMessage =
      typeof responseBody?.error?.message === 'string'
        ? responseBody.error.message
        : 'O Gemini recusou a geracao do ETP.';
    throw new Error(errorMessage);
  }

  const content = extractGeminiText(responseBody as Record<string, unknown>);
  if (!content) {
    throw new Error('A resposta do Gemini veio vazia ao gerar o ETP.');
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

  throw new Error(`Nao foi possivel gerar o ETP com os modelos Gemini configurados. ${errors.join(' | ')}`);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await request.json()) as EtpRequest;
    const questions = normalizeQuestions(body);
    const fallbackSections = buildFallbackSections(body, questions);

    if (questions.length === 0) {
      return jsonResponse({
        status: 'blocked',
        title: 'Estudo Tecnico Preliminar - Servicos Continuos',
        warnings: [],
        missingRequiredFields: [],
        fields: [],
        blockedReason: 'O questionario fixo do ETP nao foi enviado pelo frontend.',
      });
    }

    const geminiApiKey = getGeminiApiKey();
    if (!geminiApiKey) {
      return jsonResponse(normalizeAiResult({}, fallbackSections, body, questions, 'fallback-local'));
    }

    const prompt = buildPrompt(body, questions, fallbackSections);
    const { content, model } = await callGeminiWithFallback(prompt, geminiApiKey, getModelCandidates());
    const parsed = parseGeminiJson(content);
    return jsonResponse(normalizeAiResult(parsed, fallbackSections, body, questions, model));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado ao gerar o ETP.';
    console.error('gerar-etp-servicos-continuos', error);
    return jsonResponse({ error: message }, 500);
  }
});
