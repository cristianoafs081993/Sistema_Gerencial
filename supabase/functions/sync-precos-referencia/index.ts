import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const COMPRAS_DADOS_ABERTOS_BASE = 'https://dadosabertos.compras.gov.br';
const BATCH_EMBED_SIZE = 50;

type SyncMode = 'backfill_mensal' | 'daily_delta' | 'generate_embeddings' | 'manual';

type SyncPayload = {
  mode?: SyncMode;
  ano?: number;
  mes?: number;
  dataInicial?: string;
  dataFinal?: string;
  startDay?: number;
  endDay?: number;
  scope?: string;
  batchSize?: number;
  maxPages?: number;
  tamanhoPagina?: number;
  generateEmbeddings?: boolean;
};

type ItemRecord = {
  source_id: string;
  numero_controle_pncp: string;
  numero_item: number;
  codigo_item_catalogo?: string;
  tipo_catalogo: 'material' | 'servico';
  descricao_item: string;
  descricao_detalhada?: string;
  unidade_medida: string;
  quantidade: number;
  valor_unitario: number;
  valor_total?: number;
  marca?: string;
  fornecedor_nome?: string;
  fornecedor_cnpj?: string;
  orgao_nome: string;
  orgao_cnpj: string;
  orgao_esfera: string;
  orgao_uf?: string;
  orgao_municipio?: string;
  uasg_codigo?: string;
  modalidade_nome?: string;
  ano_compra: number;
  numero_compra?: string;
  processo?: string;
  data_publicacao_pncp: string;
  data_resultado?: string;
  link_pncp?: string;
  amostra_valida: boolean;
  exclusion_reason?: string;
  sync_run_id?: string;
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

function cleanText(text: unknown, maxLen = 1500): string {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function formatDatePncp(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseContratacaoKey(pncpKey: string) {
  const match = String(pncpKey || '').match(/^(\d+)-(\d+)-(\d+)\/(\d{4})$/);
  if (match) {
    return {
      cnpj: match[1],
      tipo: match[2],
      seq: parseInt(match[3], 10),
      ano: parseInt(match[4], 10),
    };
  }
  return null;
}

const UASG_NAMES: Record<string, string> = {
  '158155': 'IFRN - Reitoria (Natal)',
  '158366': 'IFRN - Campus Mossoró',
  '158367': 'IFRN - Campus Currais Novos',
  '158368': 'IFRN - Campus Ipanguaçu',
  '158369': 'IFRN - Campus Natal - Central',
  '158370': 'IFRN - Campus Zona Norte (Natal)',
  '158371': 'IFRN - Campus Caicó',
  '158372': 'IFRN - Campus Pau dos Ferros',
  '158373': 'IFRN - Campus Apodi',
  '158374': 'IFRN - Campus Santa Cruz',
  '158375': 'IFRN - Campus João Câmara',
  '158376': 'IFRN - Campus Macau',
  '158377': 'IFRN - Campus São Gonçalo do Amarante',
  '158378': 'IFRN - Campus Nova Cruz',
  '158379': 'IFRN - Campus Parnamirim',
  '158380': 'IFRN - Campus Canguaretama',
  '158381': 'IFRN - Campus Ceará-Mirim',
  '158382': 'IFRN - Campus São Paulo do Potengi',
  '158383': 'IFRN - Campus Lajes',
  '158384': 'IFRN - Campus Parelhas',
  '158514': 'IFRN - Campus Natal - Cidade Alta',
};

// Geração de Embeddings em Lote via Gemini API
async function generateEmbeddingsBatch(
  texts: string[],
  apiKey: string,
): Promise<number[][]> {
  if (!apiKey || texts.length === 0) return [];

  const models = ['gemini-embedding-001', 'gemini-embedding-2', 'embedding-001'];

  for (const model of models) {
    try {
      const requests = texts.map((t) => ({
        model: `models/${model}`,
        content: { parts: [{ text: cleanText(t, 800) }] },
        outputDimensionality: 768,
      }));

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests }),
        },
      );

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.embeddings)) {
          return data.embeddings.map((e: any) => e.values || []);
        }
      } else {
        const errText = await res.text();
        console.warn(`Erro no batchEmbedContents com model ${model}:`, res.status, errText);
      }
    } catch (err) {
      console.warn(`Exceção ao chamar batchEmbedContents com model ${model}:`, err);
    }
  }

  return [];
}

// Processa itens pendentes de embedding no banco local
async function processPendingEmbeddings(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  limit = 200,
): Promise<number> {
  if (!apiKey) return 0;

  const { data: pendingRows } = await supabase
    .from('preco_referencia_itens')
    .select('id, descricao_item, descricao_detalhada, marca')
    .is('embedding', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!pendingRows || pendingRows.length === 0) return 0;

  let totalUpdated = 0;

  for (let i = 0; i < pendingRows.length; i += BATCH_EMBED_SIZE) {
    const chunk = pendingRows.slice(i, i + BATCH_EMBED_SIZE);
    const texts = chunk.map(
      (r) => `${r.descricao_item} ${r.descricao_detalhada ? `— ${r.descricao_detalhada}` : ''} ${r.marca ? `Marca: ${r.marca}` : ''}`,
    );

    const embeddings = await generateEmbeddingsBatch(texts, apiKey);

    for (let j = 0; j < chunk.length; j++) {
      const emb = embeddings[j];
      if (Array.isArray(emb) && emb.length > 0) {
        const { error } = await supabase
          .from('preco_referencia_itens')
          .update({ embedding: emb })
          .eq('id', chunk[j].id);

        if (!error) totalUpdated++;
      }
    }

    // Delay breve para respeito à taxa de requisições
    await new Promise((r) => setTimeout(r, 200));
  }

  return totalUpdated;
}

// Consulta de itens no Compras.gov.br Dados Abertos (PNCP 14.133)
async function fetchComprasGovItensPncp(params: {
  dataInicial: string;
  dataFinal: string;
  pagina: number;
  tamanhoPagina: number;
  temResultado?: boolean;
}): Promise<{ items: any[]; totalPaginas: number; totalRegistros: number }> {
  const search = new URLSearchParams({
    dataInclusaoPncpInicial: params.dataInicial,
    dataInclusaoPncpFinal: params.dataFinal,
    pagina: String(params.pagina),
    tamanhoPagina: String(Math.max(10, Math.min(500, params.tamanhoPagina))),
  });

  if (params.temResultado !== false) {
    search.set('temResultado', 'true');
  }

  const url = `${COMPRAS_DADOS_ABERTOS_BASE}/modulo-contratacoes/2_consultarItensContratacoes_PNCP_14133?${search.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
      },
    });

    if (res.ok) {
      const data = await res.json();
      const items = Array.isArray(data?.resultado) ? data.resultado : [];
      const totalPaginas = Number(data?.totalPaginas || params.pagina);
      const totalRegistros = Number(data?.totalRegistros || items.length);
      return { items, totalPaginas, totalRegistros };
    } else {
      const errText = await res.text().catch(() => '');
      console.warn(`Compras.gov HTTP ${res.status} em ${url}: ${errText.slice(0, 300)}`);
    }
  } catch (err) {
    console.warn(`Erro ao consultar Compras.gov Dados Abertos:`, err);
  }

  return { items: [], totalPaginas: params.pagina, totalRegistros: 0 };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const apiKey = getGeminiApiKey();

  // Status e Métricas Gerais (GET)
  if (req.method === 'GET') {
    const [totalItensRes, pendingRes, runsRes] = await Promise.all([
      supabase.from('preco_referencia_itens').select('id', { count: 'exact', head: true }),
      supabase.from('preco_referencia_itens').select('id', { count: 'exact', head: true }).is('embedding', null),
      supabase.from('preco_referencia_sync_runs').select('*').order('started_at', { ascending: false }).limit(10),
    ]);

    return json({
      status: 'online',
      totalItens: totalItensRes.count || 0,
      itensSemEmbedding: pendingRes.count || 0,
      recentRuns: runsRes.data || [],
    });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as SyncPayload;
    const mode = body.mode || 'daily_delta';
    const generateEmbeddings = body.generateEmbeddings !== false;
    const scope = body.scope || 'federal_rn_nordeste';

    // MODO 1: Gerar embeddings para itens pendentes
    if (mode === 'generate_embeddings') {
      const updated = await processPendingEmbeddings(supabase, apiKey, body.batchSize || 300);
      return json({
        message: 'Lote de embeddings processado.',
        totalEmbeddingsGerados: updated,
      });
    }

    // Determina intervalo de datas conforme o modo
    let startDate: Date;
    let endDate: Date;
    let anoSync = body.ano || new Date().getUTCFullYear();
    let mesSync = body.mes || (new Date().getUTCMonth() + 1);

    if (mode === 'backfill_mensal') {
      const year = body.ano || 2026;
      const month = body.mes || 1;
      anoSync = year;
      mesSync = month;

      const startDay = body.startDay || 1;
      const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const endDay = body.endDay ? Math.min(body.endDay, lastDayOfMonth) : lastDayOfMonth;

      startDate = new Date(Date.UTC(year, month - 1, startDay));
      endDate = new Date(Date.UTC(year, month - 1, endDay));
    } else {
      // daily_delta: busca a partir do último sincronizado ou últimas 48h
      const { data: lastItem } = await supabase
        .from('preco_referencia_itens')
        .select('data_publicacao_pncp')
        .order('data_publicacao_pncp', { ascending: false })
        .limit(1)
        .single();

      const now = new Date();
      endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

      if (lastItem?.data_publicacao_pncp) {
        startDate = new Date(lastItem.data_publicacao_pncp);
        startDate.setUTCDate(startDate.getUTCDate() - 1); // 1 dia de margem para sobreposição
      } else {
        startDate = new Date(endDate);
        startDate.setUTCDate(startDate.getUTCDate() - 2); // 48h de janela de segurança
      }
    }

    const dataInicialIso = formatIsoDate(startDate);
    const dataFinalIso = formatIsoDate(endDate);

    // Registra início do sync run
    const { data: syncRun, error: runErr } = await supabase
      .from('preco_referencia_sync_runs')
      .insert({
        tipo_sync: mode === 'backfill_mensal' ? 'backfill_mensal' : 'daily_delta',
        ano: anoSync,
        mes: mode === 'backfill_mensal' ? mesSync : null,
        data_inicial: dataInicialIso,
        data_final: dataFinalIso,
        status: 'running',
        escopo: scope,
        cursor_data: { page: 1, dataInicialIso, dataFinalIso },
      })
      .select()
      .single();

    if (runErr) {
      return json({ error: `Erro ao iniciar run de sincronizacao: ${runErr.message}` }, 500);
    }

    const maxPages = body.maxPages || (mode === 'backfill_mensal' ? 10 : 5);
    const pageSize = body.tamanhoPagina || 100;
    let currentPage = 1;
    let totalConsultados = 0;
    let totalItemsIngested = 0;

    const nordesteUfs = new Set(['RN', 'PB', 'CE', 'PE', 'AL', 'SE', 'BA', 'PI', 'MA']);

    while (currentPage <= maxPages) {
      const { items: rawItems, totalPaginas, totalRegistros } = await fetchComprasGovItensPncp({
        dataInicial: dataInicialIso,
        dataFinal: dataFinalIso,
        pagina: currentPage,
        tamanhoPagina: pageSize,
        temResultado: true,
      });

      if (!rawItems || rawItems.length === 0) break;
      totalConsultados += rawItems.length;

      const recordsToUpsert: ItemRecord[] = [];

      for (const it of rawItems) {
        const price = Number(it.valorUnitarioResultado || it.valorUnitarioEstimado || 0);
        if (price <= 0) continue;

        const pncpKey = String(it.numeroControlePNCPCompra || it.idContratacaoPNCP || '');
        const keyInfo = parseContratacaoKey(pncpKey);

        const cnpj = keyInfo?.cnpj || String(it.orgaoEntidadeCnpj || '').replace(/\D/g, '');
        const ano = keyInfo?.ano || Number(it.idCompra?.slice(-4) || anoSync);
        const seq = keyInfo?.seq || 1;
        const itemNum = Number(it.numeroItemPncp || it.numeroItemCompra || 1);
        const uasg = it.unidadeOrgaoCodigoUnidade ? String(it.unidadeOrgaoCodigoUnidade) : undefined;
        const uf = String(it.unidadeOrgaoUfSigla || '').toUpperCase();

        // Filtro de Escopo: Federal OU Nordeste/RN
        if (scope === 'federal_rn_nordeste' && uf) {
          const isNordeste = nordesteUfs.has(uf);
          const isFederalUasg = uasg && (uasg.startsWith('15') || uasg.startsWith('79') || UASG_NAMES[uasg]);
          if (!isNordeste && !isFederalUasg) {
            if (!UASG_NAMES[uasg || '']) continue;
          }
        }

        const rawDesc = String(it.descricaoResumida || it.descricaodetalhada || '').trim();
        const rawDetailed = String(it.descricaodetalhada || '').trim();

        const orgaoNome = (uasg && UASG_NAMES[uasg])
          ? UASG_NAMES[uasg]
          : (uasg ? `Órgão UASG ${uasg}` : `Órgão CNPJ ${cnpj}`);

        const record: ItemRecord = {
          source_id: `pncp:${cnpj}-${ano}-${seq}-${itemNum}`,
          numero_controle_pncp: pncpKey || `${cnpj}-${ano}-${seq}`,
          numero_item: itemNum,
          codigo_item_catalogo: it.codItemCatalogo ? String(it.codItemCatalogo) : undefined,
          tipo_catalogo: it.materialOuServico === 'S' || /servi[çc]o/i.test(it.materialOuServicoNome || '') ? 'servico' : 'material',
          descricao_item: cleanText(rawDesc, 350),
          descricao_detalhada: rawDetailed && rawDetailed !== rawDesc ? cleanText(rawDetailed, 600) : undefined,
          unidade_medida: String(it.unidadeMedida || 'UN').trim().toUpperCase().slice(0, 20),
          quantidade: Number(it.quantidadeResultado || it.quantidade || 1),
          valor_unitario: price,
          valor_total: Number(it.valorTotalResultado || it.valorTotal || (price * Number(it.quantidade || 1))),
          marca: it.marca ? String(it.marca).trim().slice(0, 80) : undefined,
          fornecedor_nome: it.nomeFornecedor ? cleanText(it.nomeFornecedor, 120) : undefined,
          fornecedor_cnpj: it.codFornecedor ? String(it.codFornecedor).replace(/\D/g, '') : undefined,
          orgao_nome: orgaoNome,
          orgao_cnpj: cnpj,
          orgao_esfera: 'Federal',
          orgao_uf: uf || undefined,
          uasg_codigo: uasg,
          modalidade_nome: it.itemCategoriaNome || 'Pregão / Dispensa',
          ano_compra: ano,
          numero_compra: it.idCompra ? String(it.idCompra) : undefined,
          processo: undefined,
          data_publicacao_pncp: it.dataInclusaoPncp ? new Date(it.dataInclusaoPncp).toISOString() : new Date().toISOString(),
          data_resultado: it.dataResultado ? String(it.dataResultado).slice(0, 19) : undefined,
          link_pncp: `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`,
          amostra_valida: true,
          sync_run_id: syncRun.id,
        };

        recordsToUpsert.push(record);
      }

      if (recordsToUpsert.length > 0) {
        const { error: upsertErr } = await supabase
          .from('preco_referencia_itens')
          .upsert(recordsToUpsert, {
            onConflict: 'numero_controle_pncp,numero_item',
            ignoreDuplicates: false,
          });

        if (!upsertErr) {
          totalItemsIngested += recordsToUpsert.length;
        } else {
          console.warn('Erro no upsert de itens:', upsertErr.message);
        }
      }

      if (currentPage >= totalPaginas) break;
      currentPage++;

      // Atualiza progresso do run
      await supabase
        .from('preco_referencia_sync_runs')
        .update({
          total_compras_consultadas: totalConsultados,
          total_itens_ingeridos: totalItemsIngested,
          cursor_data: { page: currentPage, totalPaginas, totalRegistros },
        })
        .eq('id', syncRun.id);
    }

    // Se solicitado, processa os embeddings para os registros adicionados
    let totalEmbeddings = 0;
    if (generateEmbeddings && apiKey) {
      totalEmbeddings = await processPendingEmbeddings(supabase, apiKey, 150);
    }

    // Finaliza o run com sucesso
    await supabase
      .from('preco_referencia_sync_runs')
      .update({
        status: 'completed',
        total_compras_consultadas: totalConsultados,
        total_itens_ingeridos: totalItemsIngested,
        total_embeddings_gerados: totalEmbeddings,
        finished_at: new Date().toISOString(),
      })
      .eq('id', syncRun.id);

    return json({
      success: true,
      mode,
      periodo: { dataInicial: dataInicialIso, dataFinal: dataFinalIso },
      totalConsultados,
      totalItensIngeridos: totalItemsIngested,
      totalEmbeddingsGerados: totalEmbeddings,
      syncRunId: syncRun.id,
    });
  } catch (err) {
    console.error('Erro na sincronizacao de precos:', err);
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
});
