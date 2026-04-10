const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeminiAtasHistoryMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface GeminiAtasRequestBody {
  module: 'adesao' | 'pesquisa_precos';
  query: string;
  history?: GeminiAtasHistoryMessage[];
  context: Record<string, unknown>;
}

const systemInstruction = `
Voce e um assistente conversacional do IFRN para triagem de atas de registro de precos.

Regras obrigatorias:
- Responda sempre em portugues do Brasil.
- Seja objetivo, claro e operacional.
- Nunca trate o ranking como decisao conclusiva.
- Nunca diga que a adesao esta aprovada, apta, segura ou definitiva.
- No modulo de pesquisa de precos, deixe claro que a resposta e apenas apoio informacional.
- Use no maximo 2 paragrafos curtos.
- Se houver resultados, destaque o que parece mais util primeiro.
- Se nao houver resultados, explique isso de forma curta e sugira como refinar a busca.
- Apoie a analise humana; nao substitua a decisao humana.
`.trim();

const buildPrompt = (payload: GeminiAtasRequestBody) => `
Historico recente da conversa:
${JSON.stringify(payload.history || [], null, 2)}

Contexto estruturado da busca atual:
${JSON.stringify(payload.context, null, 2)}

Pedido:
Gere a proxima resposta do assistente para a consulta "${payload.query}" no modulo "${payload.module}".
Resuma o entendimento, destaque os achados mais relevantes e oriente o proximo passo sem linguagem conclusiva.
`.trim();

const extractText = (responseJson: Record<string, unknown>) => {
  const candidates = Array.isArray(responseJson.candidates) ? responseJson.candidates : [];
  const firstCandidate = candidates[0] as Record<string, unknown> | undefined;
  const content = firstCandidate?.content as Record<string, unknown> | undefined;
  const parts = Array.isArray(content?.parts) ? content?.parts : [];

  return parts
    .map((part) => (typeof (part as Record<string, unknown>).text === 'string' ? (part as Record<string, unknown>).text : ''))
    .join('\n')
    .trim();
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY nao configurada no Supabase.' }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const payload = (await request.json()) as GeminiAtasRequestBody;
    if (!payload?.query || !payload?.context || !payload?.module) {
      return new Response(
        JSON.stringify({ error: 'Payload invalido para resposta conversacional de atas.' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: buildPrompt(payload),
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            topP: 0.8,
            maxOutputTokens: 700,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      return new Response(
        JSON.stringify({ error: 'Falha ao consultar Gemini.', details: errorText }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const responseJson = (await geminiResponse.json()) as Record<string, unknown>;
    const message = extractText(responseJson);

    return new Response(
      JSON.stringify({
        message,
        model,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro inesperado na Edge Function do Gemini.',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
