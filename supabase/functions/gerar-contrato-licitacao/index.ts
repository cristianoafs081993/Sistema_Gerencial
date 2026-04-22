const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ContractRequest = {
  processo?: Record<string, unknown>;
  selectedModel?: {
    title?: string;
    subtitle?: string;
    pageStart?: number;
    pageEnd?: number;
    excerpt?: string;
    templateText?: string;
    truncated?: boolean;
  };
  contextSnippets?: Array<{
    label?: string;
    kind?: string;
    pageNumber?: number;
    excerpt?: string;
  }>;
  analysisWarnings?: string[];
};

type DraftFieldStatus = 'confirmed' | 'inferred' | 'missing';

type DraftField = {
  key: string;
  label: string;
  value?: string;
  status: DraftFieldStatus;
  source: string;
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

function getGeminiApiKey() {
  return (
    Deno.env.get('GEMINI_API_KEY') ||
    Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY') ||
    Deno.env.get('GOOGLE_API_KEY')
  );
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function normalizeFieldStatus(value: unknown): DraftFieldStatus {
  if (value === 'confirmed' || value === 'missing') return value;
  return 'inferred';
}

function normalizeFields(value: unknown): DraftField[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const key = typeof record.key === 'string' ? record.key.trim() : '';
      const label = typeof record.label === 'string' ? record.label.trim() : '';
      const source = typeof record.source === 'string' ? record.source.trim() : '';
      const rawValue = typeof record.value === 'string' ? record.value.trim() : undefined;

      if (!key || !label || !source) return null;

      return {
        key,
        label,
        value: rawValue || undefined,
        status: normalizeFieldStatus(record.status),
        source,
      } satisfies DraftField;
    })
    .filter((item): item is DraftField => Boolean(item));
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

function buildSources(request: ContractRequest) {
  const sources: Array<{ label: string; pageStart: number; pageEnd: number }> = [];

  if (typeof request.selectedModel?.pageStart === 'number' && typeof request.selectedModel?.pageEnd === 'number') {
    sources.push({
      label: request.selectedModel.title || 'Modelo do contrato',
      pageStart: request.selectedModel.pageStart,
      pageEnd: request.selectedModel.pageEnd,
    });
  }

  for (const snippet of request.contextSnippets || []) {
    if (typeof snippet?.pageNumber !== 'number') continue;
    const label = typeof snippet.label === 'string' && snippet.label.trim()
      ? snippet.label.trim()
      : 'Trecho de apoio';
    const alreadyAdded = sources.some(
      (source) => source.label === label && source.pageStart === snippet.pageNumber && source.pageEnd === snippet.pageNumber,
    );

    if (!alreadyAdded) {
      sources.push({
        label,
        pageStart: snippet.pageNumber,
        pageEnd: snippet.pageNumber,
      });
    }
  }

  return sources;
}

function normalizeDraftResult(raw: Record<string, unknown>, request: ContractRequest, model: string) {
  const status = raw.status === 'blocked' ? 'blocked' : 'generated';
  const title = typeof raw.title === 'string' && raw.title.trim()
    ? raw.title.trim()
    : request.selectedModel?.title || 'Contrato gerado por IA';
  const subtitle = typeof raw.subtitle === 'string' && raw.subtitle.trim() ? raw.subtitle.trim() : undefined;
  const html = typeof raw.html === 'string' && raw.html.trim() ? raw.html.trim() : undefined;
  const warnings = toStringArray(raw.warnings);
  const missingRequiredFields = toStringArray(raw.missingRequiredFields);
  const fields = normalizeFields(raw.fields);

  return {
    status,
    title,
    subtitle,
    html,
    warnings,
    missingRequiredFields,
    fields,
    blockedReason: typeof raw.blockedReason === 'string' && raw.blockedReason.trim()
      ? raw.blockedReason.trim()
      : undefined,
    sources: buildSources(request),
    model,
  };
}

function buildPrompt(request: ContractRequest) {
  const selectedModel = request.selectedModel;
  const snippets = request.contextSnippets || [];

  return [
    'Voce e um assistente de contratacao publica do IFRN.',
    'Sua tarefa e gerar uma minuta de contrato administrativo em HTML usando como modelo principal o trecho do processo informado.',
    'Use o modelo selecionado como base estrutural: preserve estilo, clausulas, numeracao, cabecalho e redacao juridica sempre que possivel.',
    'Use os trechos de apoio apenas para preencher dados variaveis, como contratada, CNPJ, objeto, modalidade, processo, itens, valores e vigencia.',
    'Nao invente dados. Quando um dado obrigatorio nao aparecer na fonte, mantenha um placeholder no formato [CAMPO PENDENTE] e registre o campo em missingRequiredFields.',
    'Se o modelo selecionado nao for claramente uma minuta ou termo de contrato, responda com status "blocked" e explique o motivo em blockedReason.',
    'Responda somente JSON valido, sem markdown, sem comentarios e sem texto antes ou depois.',
    'O JSON deve seguir exatamente este formato:',
    '{"status":"generated|blocked","blockedReason":"... opcional ...","title":"...","subtitle":"...","html":"...","warnings":["..."],"missingRequiredFields":["..."],"fields":[{"key":"contratada","label":"Contratada","value":"...","status":"confirmed|inferred|missing","source":"pagina X"}]}',
    '',
    `Processo: ${JSON.stringify(request.processo || {}, null, 2)}`,
    '',
    `Modelo selecionado: ${JSON.stringify(selectedModel || {}, null, 2)}`,
    '',
    `Texto do modelo selecionado:\n${selectedModel?.templateText || ''}`,
    '',
    `Trechos de apoio:\n${JSON.stringify(snippets, null, 2)}`,
    '',
    `Alertas da analise local:\n${JSON.stringify(request.analysisWarnings || [], null, 2)}`,
    '',
    'Regras extras para o html:',
    '- retornar apenas o corpo do documento, sem <html> e sem <body>;',
    '- usar tags simples como <div>, <p>, <table>, <tr>, <td>, <strong> e <em>;',
    '- nao usar markdown;',
    '- se o modelo trouxer tabela de itens, reproduza a tabela em HTML;',
    '- nao inserir assinatura, numero ou CNPJ que nao estejam suportados pelo processo ou pelos trechos de apoio.',
  ].join('\n');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const geminiApiKey = getGeminiApiKey();
    if (!geminiApiKey) {
      return jsonResponse(
        {
          error:
            'A funcao de geracao de contrato precisa de GEMINI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY ou GOOGLE_API_KEY no ambiente do Supabase.',
        },
        500,
      );
    }

    const body = (await request.json()) as ContractRequest;
    if (!body.selectedModel?.templateText || typeof body.selectedModel.pageStart !== 'number') {
      return jsonResponse(
        { error: 'Envie o modelo selecionado do contrato com o texto extraido do PDF.' },
        400,
      );
    }

    const model = Deno.env.get('GEMINI_CONTRACT_MODEL') || 'gemini-2.0-flash';
    const prompt = buildPrompt(body);

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
            temperature: 0.1,
            maxOutputTokens: 8192,
          },
        }),
      },
    );

    const responseBody = await geminiResponse.json();

    if (!geminiResponse.ok) {
      const errorMessage =
        (responseBody?.error && typeof responseBody.error === 'object' && 'message' in responseBody.error
          ? String(responseBody.error.message)
          : '') || 'O Gemini recusou a geracao do contrato.';

      return jsonResponse({ error: errorMessage }, 500);
    }

    const content = extractGeminiText(responseBody as Record<string, unknown>);
    if (!content) {
      return jsonResponse({ error: 'A resposta do Gemini veio vazia.' }, 500);
    }

    const parsed = JSON.parse(stripJsonFence(content)) as Record<string, unknown>;
    const normalized = normalizeDraftResult(parsed, body, model);

    if (normalized.status === 'generated' && !normalized.html) {
      return jsonResponse(
        { error: 'O Gemini nao retornou html para a minuta do contrato.' },
        500,
      );
    }

    return jsonResponse(normalized);
  } catch (error) {
    console.error('gerar-contrato-licitacao', error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Falha inesperada ao gerar o contrato.',
      },
      500,
    );
  }
});
