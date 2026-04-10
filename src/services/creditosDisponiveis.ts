import { supabase } from '@/lib/supabase';
import { fetchSupabaseRestRows } from '@/lib/supabaseRest';
import type { CreditoDisponivel } from '@/types';

const CREDITOS_DISPONIVEIS_SELECT = 'id,ptres,metrica,valor,updated_at';

type CreditoDisponivelRow = {
  id: string;
  ptres: string;
  metrica?: string | null;
  valor: number | string;
  updated_at: string;
};

const mapCreditoDisponivelRow = (item: CreditoDisponivelRow): CreditoDisponivel => ({
  id: item.id,
  ptres: item.ptres,
  metrica: item.metrica || undefined,
  valor: Number(item.valor),
  updated_at: item.updated_at,
});

export const creditosDisponiveisService = {
  async getAll(): Promise<CreditoDisponivel[]> {
    const { data, error } = await supabase
      .from('creditos_disponiveis')
      .select(CREDITOS_DISPONIVEIS_SELECT)
      .order('ptres', { ascending: true });

    if (error) {
      console.warn('creditosDisponiveisService.getAll: fallback para Supabase REST', error);
      const fallbackData = await fetchSupabaseRestRows<CreditoDisponivelRow>(
        'creditos_disponiveis',
        CREDITOS_DISPONIVEIS_SELECT,
        { orderBy: 'ptres', ascending: true },
      );
      return fallbackData.map(mapCreditoDisponivelRow);
    }

    if (!data || data.length === 0) {
      const fallbackData = await fetchSupabaseRestRows<CreditoDisponivelRow>(
        'creditos_disponiveis',
        CREDITOS_DISPONIVEIS_SELECT,
        { orderBy: 'ptres', ascending: true },
      );
      return fallbackData.map(mapCreditoDisponivelRow);
    }

    return (data as CreditoDisponivelRow[]).map(mapCreditoDisponivelRow);
  },
};
