import { supabase } from '@/lib/supabase';

export type PrecoReferenciaItem = {
  id: string;
  numero_controle_pncp: string;
  numero_item: number;
  codigo_item_catalogo: string | null;
  tipo_catalogo: 'material' | 'servico';
  descricao_item: string;
  descricao_detalhada: string | null;
  unidade_medida: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number | null;
  marca: string | null;
  fornecedor_nome: string | null;
  fornecedor_cnpj: string | null;
  orgao_nome: string;
  orgao_cnpj: string;
  orgao_esfera: string;
  orgao_uf: string | null;
  uasg_codigo: string | null;
  modalidade_nome: string | null;
  ano_compra: number;
  numero_compra: string | null;
  data_publicacao_pncp: string;
  link_pncp: string | null;
  similarity_score?: number;
};

export type PrecoReferenciaSyncRun = {
  id: string;
  tipo_sync: 'backfill_mensal' | 'daily_delta' | 'manual';
  ano: number;
  mes: number | null;
  data_inicial: string;
  data_final: string;
  status: 'running' | 'completed' | 'partial_success' | 'error';
  escopo: string;
  total_compras_consultadas: number;
  total_itens_ingeridos: number;
  total_embeddings_gerados: number;
  started_at: string;
  finished_at: string | null;
};

export const precoReferenciaService = {
  async searchHybrid(params: {
    queryText: string;
    queryEmbedding?: number[] | null;
    matchThreshold?: number;
    matchCount?: number;
    filterUf?: string;
    filterEsfera?: string;
    maxLookbackDays?: number;
  }): Promise<PrecoReferenciaItem[]> {
    const { data, error } = await supabase.rpc('match_preco_referencia_hibrido', {
      query_text: params.queryText,
      query_embedding: params.queryEmbedding ?? null,
      match_threshold: params.matchThreshold ?? 0.20,
      match_count: params.matchCount ?? 20,
      filter_uf: params.filterUf ?? null,
      filter_esfera: params.filterEsfera ?? null,
      max_lookback_days: params.maxLookbackDays ?? 365,
    });

    if (error) throw error;
    return (data || []) as PrecoReferenciaItem[];
  },

  async getSyncRuns(limit = 10): Promise<PrecoReferenciaSyncRun[]> {
    const { data, error } = await supabase
      .from('preco_referencia_sync_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as PrecoReferenciaSyncRun[];
  },

  async triggerSync(payload: {
    mode?: 'backfill_mensal' | 'daily_delta' | 'generate_embeddings';
    ano?: number;
    mes?: number;
    startDay?: number;
    endDay?: number;
    maxPages?: number;
    tamanhoPagina?: number;
    generateEmbeddings?: boolean;
  }) {
    const { data, error } = await supabase.functions.invoke('sync-precos-referencia', {
      body: payload,
    });

    if (error) throw error;
    return data;
  },
};
