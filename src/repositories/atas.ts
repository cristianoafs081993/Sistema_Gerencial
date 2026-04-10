import { supabase } from '@/lib/supabase';
import type {
  AtaRegistroPreco,
  OrgaoAtaClassificacao,
  AtaSearchFilters,
  AtaSearchSessionSummary,
  EventoUsoAta,
  DocumentoAta,
  ItemAta,
  ItemSessaoBatchAta,
  ModuloBuscaAtas,
  ResultadoBuscaAtaPersistido,
  SessaoBuscaAtaPersistida,
  SessaoBatchAtaResumo,
} from '@/types';

export const atasRepository = {
  async listAtas(): Promise<AtaRegistroPreco[]> {
    const { data, error } = await supabase.from('atas').select('*').order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []) as AtaRegistroPreco[];
  },

  async listItens(): Promise<ItemAta[]> {
    const { data, error } = await supabase.from('itens_ata').select('*').order('numero_item', { ascending: true });

    if (error) throw error;
    return (data || []) as ItemAta[];
  },

  async listOrgaosClassificacao(): Promise<OrgaoAtaClassificacao[]> {
    const { data, error } = await supabase
      .from('orgaos_atas_classificacao')
      .select('*')
      .order('cnpj', { ascending: true });

    if (error) throw error;
    return (data || []) as OrgaoAtaClassificacao[];
  },

  async getAtaById(id: string): Promise<AtaRegistroPreco | null> {
    const { data, error } = await supabase
      .from('atas')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as AtaRegistroPreco | null;
  },

  async listItensByAtaId(ataId: string): Promise<ItemAta[]> {
    const { data, error } = await supabase
      .from('itens_ata')
      .select('*')
      .eq('ata_id', ataId)
      .order('numero_item', { ascending: true });

    if (error) throw error;
    return (data || []) as ItemAta[];
  },

  async listDocumentosByAtaId(ataId: string): Promise<DocumentoAta[]> {
    const { data, error } = await supabase
      .from('documentos_ata')
      .select('*')
      .eq('ata_id', ataId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as DocumentoAta[];
  },

  async createSearchSession(module: ModuloBuscaAtas, query: string, context: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('sessoes_busca_atas')
      .insert({
        modulo: module,
        consulta_original: query,
        contexto: context,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id as string;
  },

  async insertSearchResults(
    sessionId: string,
    results: Array<{
      ata_id: string;
      item_ata_id?: string | null;
      posicao: number;
      justificativa_curta: string;
      metadata: Record<string, unknown>;
    }>
  ) {
    if (results.length === 0) return;

    const { error } = await supabase.from('resultados_busca_atas').insert(
      results.map((result) => ({
        sessao_busca_id: sessionId,
        ...result,
      }))
    );

    if (error) throw error;
  },

  async logUsageEvent(input: {
    modulo: ModuloBuscaAtas;
    tipo_evento: string;
    referencia_tipo?: string | null;
    referencia_id?: string | null;
    payload?: Record<string, unknown>;
  }) {
    const { error } = await supabase.from('eventos_uso_atas').insert({
      modulo: input.modulo,
      tipo_evento: input.tipo_evento,
      referencia_tipo: input.referencia_tipo ?? null,
      referencia_id: input.referencia_id ?? null,
      payload: input.payload ?? {},
    });

    if (error) throw error;
  },

  async listSearchSessions(module: ModuloBuscaAtas, limit = 8): Promise<AtaSearchSessionSummary[]> {
    const { data, error } = await supabase
      .from('sessoes_busca_atas')
      .select(
        `
          id,
          modulo,
          consulta_original,
          contexto,
          created_at,
          resultados_busca_atas (
            id,
            sessao_busca_id,
            ata_id,
            item_ata_id,
            posicao,
            justificativa_curta,
            metadata,
            created_at,
            ata:atas (
              id,
              numero_ata,
              objeto,
              status_vigencia
            )
          )
        `
      )
      .eq('modulo', module)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((session: any) => {
      const results = ((session.resultados_busca_atas || []) as ResultadoBuscaAtaPersistido[]).sort(
        (a, b) => a.posicao - b.posicao
      );

      return {
        id: session.id,
        module: session.modulo,
        query: session.consulta_original,
        createdAt: session.created_at,
        previousQuery: session.contexto?.previousQuery || null,
        resultCount: results.length,
        topResult: results[0] || null,
        filters: session.contexto?.filters || null,
      } satisfies AtaSearchSessionSummary;
    });
  },

  async countSearchSessions(module?: ModuloBuscaAtas): Promise<number> {
    let query = supabase
      .from('sessoes_busca_atas')
      .select('*', { count: 'exact', head: true });

    if (module) {
      query = query.eq('modulo', module);
    }

    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  },

  async getSearchSessionById(sessionId: string): Promise<SessaoBuscaAtaPersistida | null> {
    const { data, error } = await supabase
      .from('sessoes_busca_atas')
      .select(
        `
          id,
          modulo,
          consulta_original,
          contexto,
          created_at,
          resultados_busca_atas (
            id,
            sessao_busca_id,
            ata_id,
            item_ata_id,
            posicao,
            justificativa_curta,
            metadata,
            created_at,
            ata:atas (*),
            item:itens_ata (*)
          )
        `
      )
      .eq('id', sessionId)
      .maybeSingle();

    if (error) throw error;
    return data as SessaoBuscaAtaPersistida | null;
  },

  async createBatchSession(input: {
    module: ModuloBuscaAtas;
    title: string;
    filters: AtaSearchFilters;
    items: string[];
  }) {
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessoes_batch_atas')
      .insert({
        modulo: input.module,
        titulo: input.title,
        filtros: input.filters,
        total_itens: input.items.length,
        total_concluidos: 0,
        item_atual_ordem: input.items.length > 0 ? 1 : null,
      })
      .select('id')
      .single();

    if (sessionError) throw sessionError;

    if (input.items.length > 0) {
      const { error: itemsError } = await supabase.from('itens_sessao_batch_atas').insert(
        input.items.map((item, index) => ({
          sessao_batch_id: sessionData.id,
          ordem: index + 1,
          consulta_item: item,
          status: index === 0 ? 'em_foco' : 'pendente',
        }))
      );

      if (itemsError) throw itemsError;
    }

    return sessionData.id as string;
  },

  async listBatchSessions(module: ModuloBuscaAtas, limit = 6): Promise<SessaoBatchAtaResumo[]> {
    const { data, error } = await supabase
      .from('sessoes_batch_atas')
      .select(
        `
          id,
          titulo,
          status,
          total_itens,
          total_concluidos,
          item_atual_ordem,
          filtros,
          created_at,
          itens_sessao_batch_atas (
            id,
            sessao_batch_id,
            ordem,
            consulta_item,
            status,
            sessao_busca_id,
            resumo,
            created_at,
            updated_at
          )
        `
      )
      .eq('modulo', module)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((session: any) => ({
      id: session.id,
      titulo: session.titulo,
      status: session.status,
      totalItens: session.total_itens,
      totalConcluidos: session.total_concluidos,
      itemAtualOrdem: session.item_atual_ordem,
      createdAt: session.created_at,
      filters: session.filtros || {},
      itens: ((session.itens_sessao_batch_atas || []) as ItemSessaoBatchAta[]).sort((a, b) => a.ordem - b.ordem),
    }));
  },

  async countBatchSessions(module?: ModuloBuscaAtas, status?: SessaoBatchAtaResumo['status']): Promise<number> {
    let query = supabase
      .from('sessoes_batch_atas')
      .select('*', { count: 'exact', head: true });

    if (module) {
      query = query.eq('modulo', module);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  },

  async countUsageEvents(input: { module?: ModuloBuscaAtas; eventType?: string }): Promise<number> {
    let query = supabase
      .from('eventos_uso_atas')
      .select('*', { count: 'exact', head: true });

    if (input.module) {
      query = query.eq('modulo', input.module);
    }

    if (input.eventType) {
      query = query.eq('tipo_evento', input.eventType);
    }

    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  },

  async listUsageEvents(module?: ModuloBuscaAtas, limit = 20): Promise<EventoUsoAta[]> {
    let query = supabase
      .from('eventos_uso_atas')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (module) {
      query = query.eq('modulo', module);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as EventoUsoAta[];
  },

  async updateBatchItem(input: {
    batchSessionId: string;
    order: number;
    status: ItemSessaoBatchAta['status'];
    searchSessionId?: string | null;
    summary?: Record<string, unknown>;
  }) {
    const { error } = await supabase
      .from('itens_sessao_batch_atas')
      .update({
        status: input.status,
        sessao_busca_id: input.searchSessionId ?? null,
        resumo: input.summary ?? {},
        updated_at: new Date().toISOString(),
      })
      .eq('sessao_batch_id', input.batchSessionId)
      .eq('ordem', input.order);

    if (error) throw error;
  },

  async updateBatchSessionProgress(input: {
    batchSessionId: string;
    totalConcluidos: number;
    currentOrder: number | null;
    status: 'em_andamento' | 'concluida' | 'pausada';
  }) {
    const { error } = await supabase
      .from('sessoes_batch_atas')
      .update({
        total_concluidos: input.totalConcluidos,
        item_atual_ordem: input.currentOrder,
        status: input.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.batchSessionId);

    if (error) throw error;
  },
};
