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
  placeholder?: string;
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

type EtpSectionTextRequest = {
  manualObject?: string;
  userNotes?: string;
  question?: EtpQuestion;
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
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function collapseSpaces(value?: string | null) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function stripJsonFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

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

  throw new Error('A IA retornou JSON invalido ao gerar o texto da secao do ETP.');
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

function fallbackText(request: EtpSectionTextRequest) {
  const questionTitle = request.question?.title || 'Secao do ETP';
  const objectValue = collapseSpaces(request.manualObject || request.processo?.assunto) ||
    'objeto da contratacao a ser detalhado';
  const notes = collapseSpaces(request.userNotes);
  const firstSnippet = collapseSpaces(request.contextSnippets?.[0]?.excerpt);
  const context = notes || firstSnippet || objectValue;

  return [
    `Texto preliminar para "${questionTitle}".`,
    `Considerando ${objectValue}, a secao deve registrar as informacoes relevantes para demonstrar a adequacao da contratacao ao interesse publico.`,
    context ? `Informacao inicial considerada: ${context}.` : '',
    `Revisar e complementar antes da aprovacao final. [CAMPO PENDENTE: ${questionTitle}]`,
  ].filter(Boolean).join(' ');
}

function normalizeAiResult(raw: Record<string, unknown>, request: EtpSectionTextRequest, model?: string) {
  const value = typeof raw.value === 'string' ? raw.value.trim() : '';
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
    : [];

  return {
    status: 'generated',
    value: value || fallbackText(request),
    warnings,
    model: value ? model : 'fallback-local',
  };
}

function buildPrompt(request: EtpSectionTextRequest) {
  return [
    'Voce e um assistente especializado em contratacoes publicas brasileiras.',
    'Gere texto para uma unica secao de Estudo Tecnico Preliminar de servicos continuos, com base na Lei 14.133/2021 e na IN SEGES 58/2022.',
    'O texto deve ser formal, objetivo, editavel e adequado a minuta de apoio.',
    'Se o usuario nao informou nada, gere mesmo assim um texto preliminar util, mas use marcadores [CAMPO PENDENTE: ...] para dados concretos ausentes.',
    'Nao invente numeros, datas, valores, locais, nomes de unidades ou fatos especificos sem fonte.',
    'Os trechos de apoio podem vir do processo ou de anexos opcionais. Quando usar anexo, preserve a referencia do arquivo/pagina indicada.',
    'Responda apenas JSON valido no formato: {"status":"generated","value":"texto da secao","warnings":["..."]}.',
    `Pergunta atual: ${JSON.stringify(request.question || {})}`,
    `Notas digitadas pelo usuario: ${request.userNotes || ''}`,
    `Processo: ${JSON.stringify(request.processo || {})}`,
    `Objeto manual: ${request.manualObject || ''}`,
    `Respostas ja registradas: ${JSON.stringify(request.questionnaireAnswers || [])}`,
    `Trechos de apoio: ${JSON.stringify(request.contextSnippets || [])}`,
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
        generationConfig: { temperature: 0.35, responseMimeType: 'application/json' },
      }),
    },
  );

  const responseBody = await geminiResponse.json();
  if (!geminiResponse.ok) {
    const errorMessage =
      typeof responseBody?.error?.message === 'string'
        ? responseBody.error.message
        : 'O Gemini recusou a geracao do texto da secao do ETP.';
    throw new Error(errorMessage);
  }

  const content = extractGeminiText(responseBody as Record<string, unknown>);
  if (!content) {
    throw new Error('A resposta do Gemini veio vazia ao gerar o texto da secao do ETP.');
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

  throw new Error(`Nao foi possivel gerar o texto da secao do ETP com os modelos Gemini configurados. ${errors.join(' | ')}`);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await request.json()) as EtpSectionTextRequest;

    if (!body.question?.id || !body.question?.title) {
      return jsonResponse({ error: 'A pergunta da secao do ETP nao foi enviada.' }, 400);
    }

    const geminiApiKey = getGeminiApiKey();
    if (!geminiApiKey) {
      return jsonResponse({
        status: 'generated',
        value: fallbackText(body),
        warnings: ['GEMINI_API_KEY nao configurada. Foi usado texto local de apoio.'],
        model: 'fallback-local',
      });
    }

    const prompt = buildPrompt(body);
    const { content, model } = await callGeminiWithFallback(prompt, geminiApiKey, getModelCandidates());
    const parsed = parseGeminiJson(content);
    return jsonResponse(normalizeAiResult(parsed, body, model));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado ao gerar o texto da secao do ETP.';
    console.error('gerar-texto-etp-secao', error);
    return jsonResponse({ error: message }, 500);
  }
});
