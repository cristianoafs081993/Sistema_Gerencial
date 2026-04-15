import { supabase } from '@/lib/supabase';
import { fetchSupabaseRestRows } from '@/lib/supabaseRest';
import type { ContaDescentralizacaoSaldo } from '@/types';

const CONTA_DESCENTRALIZACOES_SELECT = 'id,ptres,metrica,valor,updated_at';

type ContaDescentralizacaoSaldoRow = {
  id: string;
  ptres: string;
  metrica?: string | null;
  valor: number | string;
  updated_at: string;
};

export type ContaDescentralizacaoSaldoInput = {
  ptres: string;
  metrica?: string;
  valor: number;
};

const mapContaDescentralizacaoSaldoRow = (
  item: ContaDescentralizacaoSaldoRow,
): ContaDescentralizacaoSaldo => ({
  id: item.id,
  ptres: item.ptres,
  metrica: item.metrica || undefined,
  valor: Number(item.valor),
  updatedAt: item.updated_at,
});

export const descentralizacoesContaSaldosService = {
  async getAll(): Promise<ContaDescentralizacaoSaldo[]> {
    const { data, error } = await supabase
      .from('descentralizacoes_conta_saldos')
      .select(CONTA_DESCENTRALIZACOES_SELECT)
      .order('ptres', { ascending: true });

    if (error) {
      console.warn('descentralizacoesContaSaldosService.getAll: fallback para Supabase REST', error);
      const fallbackData = await fetchSupabaseRestRows<ContaDescentralizacaoSaldoRow>(
        'descentralizacoes_conta_saldos',
        CONTA_DESCENTRALIZACOES_SELECT,
        { orderBy: 'ptres', ascending: true },
      );
      return fallbackData.map(mapContaDescentralizacaoSaldoRow);
    }

    if (!data || data.length === 0) {
      const fallbackData = await fetchSupabaseRestRows<ContaDescentralizacaoSaldoRow>(
        'descentralizacoes_conta_saldos',
        CONTA_DESCENTRALIZACOES_SELECT,
        { orderBy: 'ptres', ascending: true },
      );
      return fallbackData.map(mapContaDescentralizacaoSaldoRow);
    }

    return (data as ContaDescentralizacaoSaldoRow[]).map(mapContaDescentralizacaoSaldoRow);
  },

  async upsertBatch(rows: ContaDescentralizacaoSaldoInput[]): Promise<void> {
    if (rows.length === 0) return;

    const payload = rows.map((row) => ({
      ptres: row.ptres.trim(),
      metrica: row.metrica?.trim() || '',
      valor: row.valor,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('descentralizacoes_conta_saldos')
      .upsert(payload, { onConflict: 'ptres' });

    if (error) throw error;
  },
};
