import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type HistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AssistantBody = {
  message?: string;
  history?: HistoryMessage[];
};

type ContextSection = {
  label: string;
  rows: unknown[];
  count: number | null;
  warning?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getGeminiApiKey() {
  return Deno.env.get('GEMINI_API_KEY') ||
    Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY') ||
    Deno.env.get('GOOGLE_API_KEY') ||
    '';
}

function getModelCandidates() {
  const configuredModel = Deno.env.get('GEMINI_ASSISTENTE_GERENCIAL_MODEL') || 'gemini-2.5-flash-lite';
  return [...new Set([configuredModel, 'gemini-2.5-flash-lite', 'gemini-2.5-flash'].filter(Boolean))];
}

function cleanText(value: unknown, maxLength = 2500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function parseSuggestions(text: string) {
  const splitRegex = /(?:\*\*?)?\|\|\s*SUGEST[OÕ]ES\s*\|\|(?:\*\*?)?/i;
  const parts = text.split(splitRegex);
  const response = parts[0]?.trim() || text.trim();
  const suggestions = parts.length > 1
    ? parts[1]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line))
      .map((line) => line.replace(/^[-*\d.]+\s*/, '').replace(/\[|\]|"/g, '').trim())
      .filter(Boolean)
      .slice(0, 3)
    : [];

  return { response, suggestions };
}

async function readSection(
  label: string,
  query: PromiseLike<{ data: unknown[] | null; error: { message?: string } | null; count?: number | null }>,
): Promise<ContextSection> {
  try {
    const { data, error, count } = await query;
    if (error) {
      return {
        label,
        rows: [],
        count: null,
        warning: `${label}: ${error.message || 'nao foi possivel consultar esta fonte.'}`,
      };
    }

    return {
      label,
      rows: Array.isArray(data) ? data : [],
      count: typeof count === 'number' ? count : null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    return {
      label,
      rows: [],
      count: null,
      warning: `${label}: ${message}`,
    };
  }
}

function compactContext(sections: ContextSection[]) {
  return sections.reduce<Record<string, unknown>>((acc, section) => {
    acc[section.label] = {
      totalAmostra: section.rows.length,
      totalDisponivel: section.count,
      aviso: section.warning,
      linhas: section.rows,
    };
    return acc;
  }, {});
}

function buildPrompt(params: {
  message: string;
  history: HistoryMessage[];
  sections: ContextSection[];
  userEmail: string | null;
}) {
  const warnings = params.sections
    .map((section) => section.warning)
    .filter((warning): warning is string => Boolean(warning));
  const history = params.history
    .slice(-8)
    .map((item) => `${item.role === 'user' ? 'Usuario' : 'Assistente'}: ${cleanText(item.content, 1200)}`)
    .join('\n');

  return [
    'Voce e o Assistente Gerencial IA do GovFlow/Sistema Gerencial do IFRN Campus Currais Novos.',
    'Responda em Portugues do Brasil, com Markdown simples, no maximo 5 bullets ou 3 paragrafos curtos.',
    'Use somente os dados fornecidos no contexto para falar de numeros, saldos, empenhos, contratos, PFs, liquidacoes ou financeiro.',
    'Se a pergunta exigir uma tabela/fonte nao disponivel no contexto, diga claramente qual dado nao foi consultado.',
    'Nao invente valores, datas, contratos, processos, credores nem conclusoes operacionais sem base nos dados.',
    'Quando citar valores monetarios, use formato brasileiro e explique se o dado veio de amostra limitada.',
    'No final, se fizer sentido, inclua exatamente este bloco com 2 ou 3 proximas perguntas:',
    '||SUGESTOES||',
    '- pergunta sugerida',
    '- pergunta sugerida',
    '',
    `Usuario autenticado: ${params.userEmail || 'nao informado'}`,
    warnings.length ? `Avisos de fontes indisponiveis:\n${warnings.join('\n')}` : '',
    history ? `Historico recente:\n${history}` : '',
    `Contexto gerencial consultado:\n${JSON.stringify(compactContext(params.sections), null, 2)}`,
    `Pergunta do usuario: ${params.message}`,
  ].filter(Boolean).join('\n\n');
}

function extractGeminiText(responseBody: Record<string, unknown>) {
  const candidates = Array.isArray(responseBody.candidates) ? responseBody.candidates : [];
  const firstCandidate = candidates[0] as Record<string, unknown> | undefined;
  const content = firstCandidate?.content as Record<string, unknown> | undefined;
  const parts = Array.isArray(content?.parts) ? content.parts : [];

  return parts
    .map((part) => (part && typeof part === 'object' && 'text' in part ? String((part as { text?: unknown }).text || '') : ''))
    .join('')
    .trim();
}

async function callGemini(prompt: string, apiKey: string, model: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.25,
        },
      }),
    },
  );
  const data = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    const error = data.error as { message?: string } | undefined;
    throw new Error(error?.message || `Gemini HTTP ${response.status}`);
  }

  const text = extractGeminiText(data);
  if (!text) {
    throw new Error('Resposta vazia do Gemini.');
  }

  return text;
}

async function callGeminiWithFallback(prompt: string, apiKey: string) {
  const errors: string[] = [];

  for (const model of getModelCandidates()) {
    try {
      return {
        model,
        text: await callGemini(prompt, apiKey, model),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'erro desconhecido';
      errors.push(`${model}: ${message}`);
    }
  }

  throw new Error(`Nao foi possivel consultar o Gemini. ${errors.join(' | ')}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Metodo nao permitido.' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Usuario nao autenticado.' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return json({ error: 'Usuario nao autenticado.' }, 401);
    }

    const body = await req.json() as AssistantBody;
    const message = cleanText(body.message, 2500);
    const history = Array.isArray(body.history)
      ? body.history
        .filter((item) => item?.role === 'user' || item?.role === 'assistant')
        .filter((item) => cleanText(item.content))
        .slice(-8)
        .map((item) => ({ role: item.role, content: cleanText(item.content, 1500) }))
      : [];

    if (!message) {
      return json({ error: 'Mensagem obrigatoria.' }, 400);
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return json({ error: 'GEMINI_API_KEY nao configurada no ambiente da Edge Function.' }, 503);
    }

    const sections = await Promise.all([
      readSection(
        'atividades',
        supabase
          .from('atividades')
          .select('tipo_atividade,dimensao,componente_funcional,atividade,descricao,valor_total,origem_recurso,natureza_despesa,plano_interno', { count: 'exact' })
          .order('created_at', { ascending: false })
          .limit(250),
      ),
      readSection(
        'descentralizacoes',
        supabase
          .from('descentralizacoes')
          .select('dimensao,nota_credito,operacao_tipo,origem_recurso,natureza_despesa,plano_interno,data_emissao,descricao,valor', { count: 'exact' })
          .order('data_emissao', { ascending: false, nullsFirst: false })
          .limit(250),
      ),
      readSection(
        'creditos_disponiveis',
        supabase
          .from('creditos_disponiveis')
          .select('ptres,metrica,valor,updated_at', { count: 'exact' })
          .order('updated_at', { ascending: false })
          .limit(200),
      ),
      readSection(
        'empenhos',
        supabase
          .from('empenhos')
          .select('numero,descricao,valor,status,tipo,plano_interno,origem_recurso,natureza_despesa,favorecido_nome,valor_liquidado,valor_liquidado_oficial,valor_pago_oficial,saldo_rap_oficial,valor_liquidado_a_pagar,rap_inscrito,rap_a_liquidar,rap_liquidado,rap_pago,data_empenho,processo', { count: 'exact' })
          .order('created_at', { ascending: false })
          .limit(300),
      ),
      readSection(
        'documentos_habeis',
        supabase
          .from('documentos_habeis')
          .select('data_emissao,processo,estado,favorecido_nome,valor_original,valor_pago,fonte_sof,empenho_numero', { count: 'exact' })
          .order('data_emissao', { ascending: false })
          .limit(160),
      ),
      readSection(
        'financeiro_fonte_vinculacao',
        supabase
          .from('financeiro_fonte_vinculacao')
          .select('ug_codigo,mes_lancamento,fonte_codigo,fonte_descricao,vinculacao_codigo,vinculacao_descricao,saldo_disponivel,imported_at', { count: 'exact' })
          .order('imported_at', { ascending: false })
          .limit(160),
      ),
      readSection(
        'contratos_api',
        supabase
          .from('contratos_api')
          .select('numero,fornecedor_nome,unidade_codigo,unidade_origem_codigo,objeto,processo,vigencia_inicio_derivada,vigencia_fim_derivada,valor_global,valor_acumulado,situacao_derivada,campus_scope_reason,updated_at', { count: 'exact' })
          .order('updated_at', { ascending: false })
          .limit(160),
      ),
      readSection(
        'contratos_api_empenhos',
        supabase
          .from('contratos_api_empenhos')
          .select('numero,unidade_gestora,valor_empenhado,valor_a_liquidar,valor_liquidado,valor_pago,rp_inscrito,rp_a_liquidar,rp_liquidado,rp_pago,rp_a_pagar', { count: 'exact' })
          .limit(220),
      ),
      readSection(
        'vw_rastreabilidade_pf',
        supabase
          .from('vw_rastreabilidade_pf')
          .select('ppf_campus,data_solicitacao,tipo,mes_referencia,fonte_recurso,valor,finalidade,status', { count: 'exact' })
          .order('data_solicitacao', { ascending: false })
          .limit(120),
      ),
      readSection(
        'vw_conciliacao_diaria_pf',
        supabase
          .from('vw_conciliacao_diaria_pf')
          .select('data_emissao,fonte_sof,total_documentos,qtd_documentos,total_pfs,qtd_pfs,saldo,status_conciliacao', { count: 'exact' })
          .order('data_emissao', { ascending: false })
          .limit(120),
      ),
    ]);

    const prompt = buildPrompt({
      message,
      history,
      sections,
      userEmail: user.email || null,
    });
    const { model, text } = await callGeminiWithFallback(prompt, apiKey);
    const parsed = parseSuggestions(text);
    const warnings = sections
      .map((section) => section.warning)
      .filter((warning): warning is string => Boolean(warning));

    return json({
      response: parsed.response,
      suggestions: parsed.suggestions,
      warnings,
      model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado no Assistente Gerencial.';
    console.error('assistente-gerencial', error);
    return json({ error: message }, 500);
  }
});
