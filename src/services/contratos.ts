import { supabase } from '@/lib/supabase';
import { fetchSupabaseRestRows } from '@/lib/supabaseRest';
import { Contrato } from '@/types';
import type { ContratoEmpenho } from '@/types';

const CONTRATOS_SELECT = 'id,numero,contratada,valor,data_inicio,data_termino,created_at,updated_at';
const CONTRATOS_EMPENHOS_SELECT = 'id,contrato_id,empenho_id,created_at';

type ContratoRow = {
  id: string;
  numero: string;
  contratada: string;
  valor?: number | string | null;
  data_inicio?: string | null;
  data_termino?: string | null;
  created_at: string;
  updated_at: string;
};

type ContratoEmpenhoRow = {
  id: string;
  contrato_id: string;
  empenho_id: string;
  created_at: string;
};

const mapContratoRow = (item: ContratoRow): Contrato => ({
  id: item.id,
  numero: item.numero,
  contratada: item.contratada || '',
  valor: item.valor != null ? Number(item.valor) : undefined,
  data_inicio: item.data_inicio ? new Date(item.data_inicio) : undefined,
  data_termino: item.data_termino ? new Date(item.data_termino) : undefined,
  created_at: new Date(item.created_at),
  updated_at: new Date(item.updated_at),
});

const mapContratoEmpenhoRow = (item: ContratoEmpenhoRow): ContratoEmpenho => ({
  id: item.id,
  contrato_id: item.contrato_id,
  empenho_id: item.empenho_id,
  created_at: new Date(item.created_at),
});

export const contratosService = {
  async getContratos() {
    const { data, error } = await supabase
      .from('contratos')
      .select(CONTRATOS_SELECT)
      .order('numero', { ascending: true });

    if (error) {
      console.warn('contratosService.getContratos: fallback para Supabase REST', error);
      const fallbackData = await fetchSupabaseRestRows<ContratoRow>('contratos', CONTRATOS_SELECT, {
        orderBy: 'numero',
        ascending: true,
      });
      return fallbackData.map(mapContratoRow);
    }

    if (!data || data.length === 0) {
      const fallbackData = await fetchSupabaseRestRows<ContratoRow>('contratos', CONTRATOS_SELECT, {
        orderBy: 'numero',
        ascending: true,
      });
      return fallbackData.map(mapContratoRow);
    }

    return (data as ContratoRow[]).map(mapContratoRow);
  },

  async getContratosEmpenhos(): Promise<ContratoEmpenho[]> {
    const { data, error } = await supabase
      .from('contratos_empenhos')
      .select(CONTRATOS_EMPENHOS_SELECT);

    if (error) {
      console.warn('contratosService.getContratosEmpenhos: fallback para Supabase REST', error);
      const fallbackData = await fetchSupabaseRestRows<ContratoEmpenhoRow>('contratos_empenhos', CONTRATOS_EMPENHOS_SELECT);
      return fallbackData.map(mapContratoEmpenhoRow);
    }

    if (!data || data.length === 0) {
      const fallbackData = await fetchSupabaseRestRows<ContratoEmpenhoRow>('contratos_empenhos', CONTRATOS_EMPENHOS_SELECT);
      return fallbackData.map(mapContratoEmpenhoRow);
    }

    return (data as ContratoEmpenhoRow[]).map(mapContratoEmpenhoRow);
  },

  async upsertBatch(data: Partial<Contrato>[]) {
    const { error } = await supabase
      .from('contratos')
      .upsert(data, { 
        onConflict: 'numero' 
      });

    if (error) {
      console.error('Error in contratosService.upsertBatch:', error);
      throw error;
    }
  },

  async linkEmpenho(contratoId: string, empenhoId: string) {
    const { error } = await supabase
      .from('contratos_empenhos')
      .upsert({ contrato_id: contratoId, empenho_id: empenhoId }, {
        onConflict: 'contrato_id,empenho_id'
      });

    if (error) throw error;
  },

  async unlinkEmpenho(contratoId: string, empenhoId: string) {
    const { error } = await supabase
      .from('contratos_empenhos')
      .delete()
      .match({ contrato_id: contratoId, empenho_id: empenhoId });

    if (error) throw error;
  },

  async deleteByNumeros(numeros: string[]) {
    if (numeros.length === 0) return;
    const { error } = await supabase
      .from('contratos')
      .delete()
      .in('numero', numeros);
    if (error) throw error;
  },

  async upsertLinks(links: { contrato_id: string; empenho_id: string }[]) {
    if (links.length === 0) return;
    const { error } = await supabase
      .from('contratos_empenhos')
      .upsert(links, { onConflict: 'contrato_id,empenho_id' });
    if (error) throw error;
  },

  async getEmpenhos() {
    const { data, error } = await supabase
      .from('empenhos')
      .select('id, numero');
    if (error) throw error;
    return data as { id: string; numero: string }[];
  },
};
