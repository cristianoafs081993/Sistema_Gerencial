const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ScreenshotPayload = {
  name: string;
  type: string;
  dataUrl: string;
};

type LiquidacaoRequest = {
  processo?: Record<string, unknown>;
  screenshots?: ScreenshotPayload[];
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
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

const parseGeminiJson = (content: string): Record<string, unknown> => {
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

  throw new Error('A IA retornou JSON invalido ao analisar os prints do SIAFI.');
};

const getGeminiApiKey = () =>
  Deno.env.get('GEMINI_API_KEY') ||
  Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY') ||
  Deno.env.get('GOOGLE_API_KEY') ||
  '';

const getModelCandidates = () => {
  const configuredModel = Deno.env.get('GEMINI_LIQUIDACAO_MODEL') ||
    Deno.env.get('GEMINI_VISION_MODEL') ||
    'gemini-2.5-flash-lite';

  return [...new Set([configuredModel, 'gemini-2.5-flash-lite', 'gemini-2.5-flash'].filter(Boolean))];
};

const extractGeminiText = (responseBody: Record<string, unknown>) => {
  const candidates = Array.isArray(responseBody.candidates) ? responseBody.candidates : [];
  const firstCandidate = candidates[0] && typeof candidates[0] === 'object'
    ? (candidates[0] as Record<string, unknown>)
    : null;
  const content = firstCandidate?.content && typeof firstCandidate.content === 'object'
    ? (firstCandidate.content as Record<string, unknown>)
    : null;
  const parts = Array.isArray(content?.parts) ? content.parts : [];

  return parts
    .map((part) => {
      const record = part && typeof part === 'object' ? (part as Record<string, unknown>) : {};
      return typeof record.text === 'string' ? record.text : '';
    })
    .join('')
    .trim();
};

const dataUrlToInlineData = (screenshot: ScreenshotPayload) => {
  const match = screenshot.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  const mimeType = match?.[1] || screenshot.type || 'image/png';
  const data = match?.[2] || screenshot.dataUrl;

  return {
    inlineData: {
      mimeType,
      data,
    },
  };
};

const normalizeStatus = (value: unknown): 'ok' | 'warning' | 'error' => {
  if (value === 'ok' || value === 'error') return value;
  return 'warning';
};

const normalizeResult = (raw: Record<string, unknown>, screenshotCount: number, model: string) => {
  const itens = Array.isArray(raw.itens)
    ? raw.itens.map((item) => {
        const registro = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        return {
          campo: String(registro.campo || 'Campo'),
          status: normalizeStatus(registro.status),
          esperado: registro.esperado ? String(registro.esperado) : undefined,
          encontrado: registro.encontrado ? String(registro.encontrado) : undefined,
          observacao: String(registro.observacao || 'Sem observacoes detalhadas.'),
        };
      })
    : [];

  return {
    statusGeral: normalizeStatus(raw.statusGeral),
    resumo: String(raw.resumo || 'Analise concluida sem resumo retornado pelo modelo.'),
    recomendacao: raw.recomendacao ? String(raw.recomendacao) : undefined,
    itens,
    analisadoEm: new Date().toISOString(),
    modelo: model,
    quantidadePrints: screenshotCount,
  };
};

const buildPrompt = (processo: Record<string, unknown>) => [
  'Voce e um auditor de liquidacao de despesa publica.',
  'Compare os prints do SIAFI com os dados do processo abaixo e identifique erros, inconsistencias, ausencia de campos e sinais de preenchimento indevido.',
  'Se alguma informacao nao estiver visivel nos prints, trate como alerta e nao invente valores.',
  'Responda somente em JSON valido, sem markdown, com o formato:',
  '{"statusGeral":"ok|warning|error","resumo":"...","recomendacao":"...","itens":[{"campo":"...","status":"ok|warning|error","esperado":"...","encontrado":"...","observacao":"..."}]}',
  `Dados do processo: ${JSON.stringify(processo, null, 2)}`,
].join('\n\n');

async function callGemini(
  prompt: string,
  screenshots: ScreenshotPayload[],
  geminiApiKey: string,
  model: string,
) {
  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              ...screenshots.map(dataUrlToInlineData),
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  const responseBody = await geminiResponse.json();
  if (!geminiResponse.ok) {
    const errorMessage =
      typeof responseBody?.error?.message === 'string'
        ? responseBody.error.message
        : 'O Gemini recusou a analise dos prints. Verifique a chave e o modelo configurado.';
    throw new Error(errorMessage);
  }

  const content = extractGeminiText(responseBody as Record<string, unknown>);
  if (!content) {
    throw new Error('A resposta do Gemini veio vazia.');
  }

  return content;
}

async function callGeminiWithFallback(
  prompt: string,
  screenshots: ScreenshotPayload[],
  geminiApiKey: string,
  modelCandidates: string[],
) {
  const errors: string[] = [];

  for (const model of modelCandidates) {
    try {
      return {
        content: await callGemini(prompt, screenshots, geminiApiKey, model),
        model,
      };
    } catch (error) {
      errors.push(`${model}: ${error instanceof Error ? error.message : 'falha desconhecida'}`);
    }
  }

  throw new Error(`Nao foi possivel analisar os prints com os modelos Gemini configurados. ${errors.join(' | ')}`);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const geminiApiKey = getGeminiApiKey();
    if (!geminiApiKey) {
      return jsonResponse(
        { error: 'A funcao de analise precisa de GEMINI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY ou GOOGLE_API_KEY configurada no Supabase.' },
        500,
      );
    }

    const { processo, screenshots }: LiquidacaoRequest = await request.json();

    if (!processo || !Array.isArray(screenshots) || screenshots.length === 0) {
      return jsonResponse(
        { error: 'Envie os dados do processo e pelo menos um print do SIAFI para a analise.' },
        400,
      );
    }

    const { content, model } = await callGeminiWithFallback(
      buildPrompt(processo),
      screenshots,
      geminiApiKey,
      getModelCandidates(),
    );
    const parsed = parseGeminiJson(content);
    return jsonResponse(normalizeResult(parsed, screenshots.length, model));
  } catch (error) {
    console.error('analisar-liquidacao-siafi', error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Falha inesperada ao analisar os prints do SIAFI.',
      },
      500,
    );
  }
});
