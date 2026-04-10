const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

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
          observacao: String(registro.observacao || 'Sem observações detalhadas.'),
        };
      })
    : [];

  return {
    statusGeral: normalizeStatus(raw.statusGeral),
    resumo: String(raw.resumo || 'Análise concluída sem resumo retornado pelo modelo.'),
    recomendacao: raw.recomendacao ? String(raw.recomendacao) : undefined,
    itens,
    analisadoEm: new Date().toISOString(),
    modelo: model,
    quantidadePrints: screenshotCount,
  };
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      return jsonResponse(
        { error: 'A função de análise precisa da variável OPENAI_API_KEY configurada no Supabase.' },
        500,
      );
    }

    const { processo, screenshots }: LiquidacaoRequest = await request.json();

    if (!processo || !Array.isArray(screenshots) || screenshots.length === 0) {
      return jsonResponse(
        { error: 'Envie os dados do processo e pelo menos um print do SIAFI para a análise.' },
        400,
      );
    }

    const model = Deno.env.get('OPENAI_VISION_MODEL') || 'gpt-4.1-mini';
    const userContent = [
      {
        type: 'text',
        text: [
          'Você é um auditor de liquidação de despesa pública.',
          'Compare os prints do SIAFI com os dados do processo abaixo e identifique erros, inconsistências, ausência de campos e sinais de preenchimento indevido.',
          'Se alguma informação não estiver visível nos prints, trate como alerta e não invente valores.',
          'Responda somente em JSON com o formato:',
          '{"statusGeral":"ok|warning|error","resumo":"...","recomendacao":"...","itens":[{"campo":"...","status":"ok|warning|error","esperado":"...","encontrado":"...","observacao":"..."}]}',
          `Dados do processo: ${JSON.stringify(processo, null, 2)}`,
        ].join('\n\n'),
      },
      ...screenshots.map((screenshot) => ({
        type: 'image_url',
        image_url: {
          url: screenshot.dataUrl,
          detail: 'high',
        },
      })),
    ];

    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Você analisa liquidações no SIAFI com rigor documental. Sempre responda em JSON válido e destaque riscos reais de preenchimento.',
          },
          {
            role: 'user',
            content: userContent,
          },
        ],
      }),
    });

    const responseBody = await openAiResponse.json();

    if (!openAiResponse.ok) {
      return jsonResponse(
        {
          error:
            responseBody?.error?.message ||
            'A OpenAI recusou a análise dos prints. Verifique a chave e o modelo configurado.',
        },
        500,
      );
    }

    const messageContent = responseBody?.choices?.[0]?.message?.content;
    if (!messageContent || typeof messageContent !== 'string') {
      return jsonResponse({ error: 'A resposta do modelo veio vazia.' }, 500);
    }

    const parsed = JSON.parse(stripJsonFence(messageContent)) as Record<string, unknown>;
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
