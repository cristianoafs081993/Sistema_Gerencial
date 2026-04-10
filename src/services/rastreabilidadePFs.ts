import { supabase } from '@/lib/supabase';
import { fetchSupabaseRestRows } from '@/lib/supabaseRest';
import type { RastreabilidadePF } from '@/types/pfs';

const RASTREABILIDADE_PFS_SELECT = [
  'ppf_campus',
  'data_solicitacao',
  'tipo',
  'mes_referencia',
  'fonte_recurso',
  'valor',
  'finalidade',
  'pfa_reitoria',
  'data_aprovacao',
  'pf_liberacao',
  'data_liberacao',
  'status',
].join(',');

type RastreabilidadePFRow = {
  ppf_campus: string;
  data_solicitacao?: string | null;
  tipo?: string | null;
  mes_referencia?: string | null;
  fonte_recurso?: string | null;
  valor?: number | string | null;
  finalidade?: string | null;
  pfa_reitoria?: string | null;
  data_aprovacao?: string | null;
  pf_liberacao?: string | null;
  data_liberacao?: string | null;
  status?: string | null;
};

const mapRastreabilidadePFRow = (item: RastreabilidadePFRow): RastreabilidadePF => ({
  ppf_campus: item.ppf_campus || '',
  data_solicitacao: item.data_solicitacao || null,
  tipo: item.tipo || null,
  mes_referencia: item.mes_referencia || null,
  fonte_recurso: item.fonte_recurso || null,
  valor: item.valor != null ? Number(item.valor) : null,
  finalidade: item.finalidade || null,
  pfa_reitoria: item.pfa_reitoria || null,
  data_aprovacao: item.data_aprovacao || null,
  pf_liberacao: item.pf_liberacao || null,
  data_liberacao: item.data_liberacao || null,
  status: item.status || null,
});

export const rastreabilidadePFsService = {
  async getAll(): Promise<RastreabilidadePF[]> {
    const { data, error } = await supabase
      .from('vw_rastreabilidade_pf')
      .select(RASTREABILIDADE_PFS_SELECT)
      .order('data_solicitacao', { ascending: false });

    if (error) {
      console.warn('rastreabilidadePFsService.getAll: fallback para Supabase REST', error);
      const fallbackData = await fetchSupabaseRestRows<RastreabilidadePFRow>(
        'vw_rastreabilidade_pf',
        RASTREABILIDADE_PFS_SELECT,
        { orderBy: 'data_solicitacao' },
      );
      return fallbackData.map(mapRastreabilidadePFRow);
    }

    if (!data || data.length === 0) {
      const fallbackData = await fetchSupabaseRestRows<RastreabilidadePFRow>(
        'vw_rastreabilidade_pf',
        RASTREABILIDADE_PFS_SELECT,
        { orderBy: 'data_solicitacao' },
      );
      return fallbackData.map(mapRastreabilidadePFRow);
    }

    return (data as RastreabilidadePFRow[]).map(mapRastreabilidadePFRow);
  },
};
