import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { executeConversationalPriceResearch } from './price-research.ts';
import {
  assessDemandClarity,
  buildGerencialAnalysis,
  detectAssistantIntent,
  extractDemandItems,
  extractPtresTarget,
  isPriceResearchClarification,
  mergeClarificationWithDemand,
  normalizeSectionSources,
  type ContextSection,
  type HistoryMessage,
} from './domain.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type AssistantBody = {
  message?: string;
  history?: HistoryMessage[];
};

type ConversationalPriceResearchData = Awaited<ReturnType<typeof executeConversationalPriceResearch>>;

function buildPriceResearchPrompt(params: {
  message: string;
  history: HistoryMessage[];
  priceResearchData: ConversationalPriceResearchData;
  userEmail: string | null;
}) {
  const history = params.history
    .slice(-6)
    .map((item) => `${item.role === 'user' ? 'Usuario' : 'Assistente'}: ${cleanText(item.content, 1000)}`)
    .join('\n');

  const hasShortSample = params.priceResearchData.items.some((i) => i.selectedCount < 3);
  const usedSynonyms = params.priceResearchData.usedSynonyms || [];

  return [
    'Voce e o Assistente Gerencial IA do GovFlow / IFRN Campus Currais Novos, especialista em compras publicas, contratacoes e pesquisa de precos (Lei 14.133/2021 e IN SEGES/ME 65/2021).',
    'Apresente somente os resultados e limitações comprovados no JSON. A pesquisa é preliminar. Não declare conformidade jurídica ou que todos os editais foram auditados. Apenas editalAudited=true indica análise do PDF por IA; os demais itens foram avaliados por metadados. Não exiba percentuais de similaridade.',
    'Apresente o resultado em Portugues do Brasil de forma executiva, clara e estruturada com Markdown.',
    'Destaque:',
    '1. Os itens pesquisados, quantidades e precos unitarios e totais estimados (Mediana).',
    '2. Requisitos atendidos, divergentes e não informados; distinga análise do PDF de análise da descrição.',
    usedSynonyms.length > 0
      ? `3. Expansao por sinonimos: para ampliar a amostra no PNCP, foram consultados tambem os termos sinonimos: ${usedSynonyms.map((s) => `"${s}"`).join(', ')}.`
      : '',
    hasShortSample
      ? '4. Informe que a amostra é insuficiente. Oriente completar a pesquisa e esclarecer requisitos faltantes; não sugira ampliar o período além da janela implementada de 365 dias.'
      : '4. Limitações da pesquisa e necessidade de revisão humana; quantidade de referências ou CV não comprovam conformidade normativa.',
    '5. Informe que os documentos normativos (Mapa Comparativo, Despacho Conclusivo para o SUAP e Planilha Excel) estao disponiveis para download no card interativo logo abaixo.',
    'No final, inclua exatamente o bloco:',
    '||SUGESTOES||',
    hasShortSample
      ? '- Revisar requisitos não informados\n- Complementar referências\n- Baixar mapa preliminar'
      : '- Baixar o Mapa Comparativo em PDF\n- Copiar o Despacho Conclusivo para o SUAP\n- Exportar a Planilha Excel da pesquisa',
    '',
    `Usuario: ${params.userEmail || 'nao informado'}`,
    history ? `Historico recente:\n${history}` : '',
    `Mensagem do usuario:\n${params.message}`,
    `Dados da Pesquisa de Precos estruturada:\n${JSON.stringify(params.priceResearchData, null, 2)}`,
  ].filter(Boolean).join('\n\n');
}

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

function buildPrompt(params: {
  message: string;
  history: HistoryMessage[];
  analysis: ReturnType<typeof buildGerencialAnalysis>;
  sources: ReturnType<typeof normalizeSectionSources>;
  userEmail: string | null;
}) {
  const history = params.history
    .slice(-8)
    .map((item) => `${item.role === 'user' ? 'Usuario' : 'Assistente'}: ${cleanText(item.content, 1200)}`)
    .join('\n');

  return [
    'Voce e o Assistente Gerencial IA do GovFlow/Sistema Gerencial do IFRN Campus Currais Novos.',
    'Responda em Portugues do Brasil, com Markdown simples, no maximo 5 bullets ou 3 paragrafos curtos.',
    'Use somente o Resumo calculado e as Evidencias principais para falar de numeros, saldos, empenhos, contratos, PFs, liquidacoes ou financeiro.',
    'Nao recalcule totais por conta propria; os numeros ja foram calculados pelo sistema antes de chegar ate voce.',
    'Se a pergunta exigir uma fonte indisponivel ou uma coluna que nao existe, diga claramente a limitacao registrada.',
    'Quando citar valores monetarios, use formato brasileiro e mencione quando o dado vier de amostra limitada.',
    'No final, se fizer sentido, inclua exatamente este bloco com 2 ou 3 proximas perguntas:',
    '||SUGESTOES||',
    '- pergunta sugerida',
    '- pergunta sugerida',
    '',
    `Usuario autenticado: ${params.userEmail || 'nao informado'}`,
    history ? `Historico recente:\n${history}` : '',
    `Pergunta:\n${params.message}`,
    `Intencao detectada:\n${params.analysis.intent}`,
    `Resumo calculado:\n${JSON.stringify(params.analysis.summary, null, 2)}`,
    `Evidencias principais:\n${JSON.stringify(params.analysis.evidence, null, 2)}`,
    `Limitacoes dos dados:\n${JSON.stringify(params.analysis.limitations, null, 2)}`,
    `Fontes consultadas:\n${JSON.stringify(params.sources, null, 2)}`,
    [
      'Instrucoes de resposta:',
      '- responda diretamente a pergunta antes de contextualizar',
      '- para descentralizacoes, trate Campus Currais Novos como o escopo natural dos dados do sistema, nao como coluna literal',
      '- para contratos, diferencie Campus 158366 e Reitoria 158155 quando essa origem aparecer nas evidencias',
      '- cite PTRES, PI, contrato, fornecedor, vigencia ou processo quando esses campos forem relevantes',
    ].join('\n'),
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
    const message = String(body.message ?? '').trim().slice(0, 2500);
    const history = Array.isArray(body.history)
      ? body.history
        .filter((item) => item?.role === 'user' || item?.role === 'assistant')
        .filter((item) => cleanText(item.content))
        .slice(-8)
        .map((item) => ({ role: item.role, content: String(item.content).trim().slice(0, 1500) }))
      : [];

    if (!message) {
      return json({ error: 'Mensagem obrigatoria.' }, 400);
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return json({ error: 'GEMINI_API_KEY nao configurada no ambiente da Edge Function.' }, 503);
    }

    const intent = detectAssistantIntent(message, history);

    // Se for pesquisa de preços, avalia clareza ou executa o agente de pesquisa com validação de editais
    if (intent === 'pesquisa_precos') {
      let demandItems = extractDemandItems(message);

      // Resolução contextual com histórico recente: se a última mensagem do assistente pediu esclarecimento
      if (history && history.length > 0) {
        const lastAssistant = [...history].reverse().find((h) => h.role === 'assistant');
        if (lastAssistant && isPriceResearchClarification(lastAssistant.content)) {
          // Busca a mensagem do usuário que continha a demanda inicial
          const prevUserMsg = [...history].reverse().find((h) => h.role === 'user' && h.content !== message);
          if (prevUserMsg) {
            const prevDemands = extractDemandItems(prevUserMsg.content);
            if (prevDemands.length > 0) {
              demandItems = prevDemands.map((prev) => mergeClarificationWithDemand(prev, message));
            }
          }
        }
      }

      // Avaliação de clareza da especificação (IN SEGES/ME nº 65/2021)
      const unclearDemands = demandItems
        .map((d) => ({ demand: d, clarity: assessDemandClarity(d) }))
        .filter((x) => !x.clarity.isClear);

      if (unclearDemands.length > 0) {
        const suggestions: string[] = [];
        for (const { clarity } of unclearDemands) {
          if (clarity.quickOptions) {
            suggestions.push(...clarity.quickOptions);
          }
        }

        const itemsDetails = unclearDemands.map(({ demand, clarity }) => {
          const missing = clarity.missingAttributes && clarity.missingAttributes.length > 0
            ? `\n\n**Requisitos técnicos a esclarecer:**\n${clarity.missingAttributes.map((a) => `• ${a}`).join('\n')}`
            : '';
          const questions = clarity.suggestedQuestions && clarity.suggestedQuestions.length > 0
            ? `\n\n**Perguntas para especificação:**\n${clarity.suggestedQuestions.map((q) => `• ${q}`).join('\n')}`
            : '';
          return `### 📌 Item: "${demand.description}"\n${clarity.reason || 'A descrição está muito genérica para localização no PNCP.'}${missing}${questions}`;
        }).join('\n\n---\n\n');

        const clarificationResponse = [
          `Identifiquei sua solicitação de pesquisa de preços para **${demandItems.map((d) => d.description).join(', ')}**, conforme as diretrizes da Lei nº 14.133/2021 e da IN SEGES/ME nº 65/2021.`,
          `Para que possamos consultar os editais e atas de registro de preços no PNCP (Portal Nacional de Contratações Públicas) e garantir uma **cesta homogênea e compatível**, a descrição precisa de alguns esclarecimentos essenciais:`,
          itemsDetails,
          `💡 *Você pode responder detalhando a especificação desejada ou selecionar uma das sugestões rápidas abaixo para prosseguirmos com a pesquisa.*`,
        ].join('\n\n');

        return json({
          response: clarificationResponse,
          suggestions: suggestions.slice(0, 4),
          warnings: [
            'A IN SEGES/ME nº 65/2021 veda pesquisas com especificações genéricas ou divergentes da real necessidade administrativa.',
          ],
          sources: [
            { label: 'Validação de Especificação Técnica - IN 65/2021', totalAmostra: 0 },
            { label: 'Catálogo CATMAT / PNCP', totalAmostra: 0 },
          ],
          model: 'especificacao-demanda-in65',
        });
      }

      const priceResearchData = await executeConversationalPriceResearch(
        supabase,
        demandItems,
        apiKey,
        user.email || 'Agente Responsavel',
        { model: Deno.env.get('GEMINI_PRICE_RESEARCH_MODEL') || 'gemini-3.8-flash', embeddingModel: Deno.env.get('PRICE_EMBEDDING_MODEL') || 'gemini-embedding-001' },
      );

      const prompt = buildPriceResearchPrompt({
        message,
        history,
        priceResearchData,
        userEmail: user.email || null,
      });

      const { model, text } = await callGeminiWithFallback(prompt, apiKey);
      const parsed = parseSuggestions(text);

      return json({
        response: parsed.response,
        suggestions: parsed.suggestions.length > 0 ? parsed.suggestions : [
          'Baixar o Mapa Comparativo em PDF',
          'Copiar o Despacho Conclusivo para o SUAP',
          'Exportar a Planilha Excel com a memória de cálculo',
        ],
        warnings: priceResearchData.complianceNotes,
        sources: [
          { label: 'Referências confirmadas por item', totalAmostra: priceResearchData.items.reduce((acc, i) => acc + i.selectedCount, 0) },
          { label: 'Itens com PDF analisado por IA', totalAmostra: priceResearchData.items.reduce((acc, i) => acc + i.candidates.filter(c => c.editalAudited).length, 0) },
        ],
        model,
        priceResearchResult: priceResearchData,
      });
    }

    const ptresTarget = extractPtresTarget(message);

    const queryAtividades = ptresTarget
      ? supabase
          .from('atividades')
          .select('tipo_atividade,dimensao,componente_funcional,atividade,descricao,valor_total,origem_recurso,natureza_despesa,plano_interno,saldo_disponivel', { count: 'exact' })
          .eq('origem_recurso', ptresTarget)
      : supabase
          .from('atividades')
          .select('tipo_atividade,dimensao,componente_funcional,atividade,descricao,valor_total,origem_recurso,natureza_despesa,plano_interno,saldo_disponivel', { count: 'exact' })
          .order('created_at', { ascending: false })
          .limit(250);

    const queryDescentralizacoes = ptresTarget
      ? supabase
          .from('descentralizacoes')
          .select('dimensao,nota_credito,operacao_tipo,origem_recurso,natureza_despesa,plano_interno,data_emissao,descricao,valor', { count: 'exact' })
          .eq('origem_recurso', ptresTarget)
          .order('data_emissao', { ascending: false, nullsFirst: false })
      : supabase
          .from('descentralizacoes')
          .select('dimensao,nota_credito,operacao_tipo,origem_recurso,natureza_despesa,plano_interno,data_emissao,descricao,valor', { count: 'exact' })
          .order('data_emissao', { ascending: false, nullsFirst: false })
          .limit(1500);

    const queryEmpenhos = ptresTarget
      ? supabase
          .from('empenhos')
          .select('numero,descricao,valor,status,tipo,plano_interno,origem_recurso,natureza_despesa,favorecido_nome,valor_liquidado,valor_liquidado_oficial,valor_pago_oficial,saldo_rap_oficial,valor_liquidado_a_pagar,rap_inscrito,rap_a_liquidar,rap_liquidado,rap_pago,data_empenho,processo', { count: 'exact' })
          .eq('origem_recurso', ptresTarget)
          .order('created_at', { ascending: false })
      : supabase
          .from('empenhos')
          .select('numero,descricao,valor,status,tipo,plano_interno,origem_recurso,natureza_despesa,favorecido_nome,valor_liquidado,valor_liquidado_oficial,valor_pago_oficial,saldo_rap_oficial,valor_liquidado_a_pagar,rap_inscrito,rap_a_liquidar,rap_liquidado,rap_pago,data_empenho,processo', { count: 'exact' })
          .order('created_at', { ascending: false })
          .limit(1000);

    const sections = await Promise.all([
      readSection('atividades', queryAtividades),
      readSection('descentralizacoes', queryDescentralizacoes),
      readSection(
        'creditos_disponiveis',
        supabase
          .from('creditos_disponiveis')
          .select('ptres,metrica,valor,updated_at', { count: 'exact' })
          .order('updated_at', { ascending: false })
          .limit(800),
      ),
      readSection('empenhos', queryEmpenhos),
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
          .select('id,numero,fornecedor_nome,unidade_codigo,unidade_origem_codigo,objeto,processo,vigencia_inicio_derivada,vigencia_fim_derivada,valor_global,valor_acumulado,situacao_derivada,campus_scope_reason,updated_at', { count: 'exact' })
          .order('updated_at', { ascending: false })
          .limit(1000),
      ),
      readSection(
        'contratos_api_empenhos',
        supabase
          .from('contratos_api_empenhos')
          .select('contrato_api_id,numero,unidade_gestora,valor_empenhado,valor_a_liquidar,valor_liquidado,valor_pago,rp_inscrito,rp_a_pagar,raw_data', { count: 'exact' })
          .limit(2000),
      ),
      readSection(
        'contratos_api_faturas',
        supabase
          .from('contratos_api_faturas')
          .select('contrato_api_id,situacao,valor_bruto,valor_liquido,data_emissao,data_pagamento', { count: 'exact' })
          .order('data_emissao', { ascending: false, nullsFirst: false })
          .limit(2000),
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

    const analysis = buildGerencialAnalysis(message, sections);
    const sources = normalizeSectionSources(sections);
    const prompt = buildPrompt({
      message,
      history,
      analysis,
      sources,
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
      sources,
      model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado no Assistente Gerencial.';
    console.error('assistente-gerencial', error);
    return json({ error: message }, 500);
  }
});
