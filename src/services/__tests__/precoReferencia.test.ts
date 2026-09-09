import { describe, expect, it, vi } from 'vitest';
import { precoReferenciaService } from '../precoReferencia';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe('precoReferenciaService', () => {
  it('calls match_preco_referencia_hibrido with mapped parameters', async () => {
    const mockRows = [
      {
        id: 'item-1',
        numero_controle_pncp: '123456-1-0001/2026',
        numero_item: 1,
        descricao_item: 'Notebook Dell i7 16GB',
        valor_unitario: 5200,
        similarity_score: 0.88,
      },
    ];

    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: mockRows,
      error: null,
    } as any);

    const results = await precoReferenciaService.searchHybrid({
      queryText: 'notebook i7',
      matchThreshold: 0.3,
      matchCount: 10,
    });

    expect(supabase.rpc).toHaveBeenCalledWith('match_preco_referencia_hibrido', {
      query_text: 'notebook i7',
      query_embedding: null,
      match_threshold: 0.3,
      match_count: 10,
      filter_uf: null,
      filter_esfera: null,
      max_lookback_days: 365,
    });

    expect(results).toHaveLength(1);
    expect(results[0].descricao_item).toBe('Notebook Dell i7 16GB');
  });

  it('triggers sync via Edge Function', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { success: true, totalItensIngeridos: 50 },
      error: null,
    } as any);

    const result = await precoReferenciaService.triggerSync({
      mode: 'backfill_mensal',
      ano: 2026,
      mes: 1,
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('sync-precos-referencia', {
      body: { mode: 'backfill_mensal', ano: 2026, mes: 1 },
    });
    expect(result.totalItensIngeridos).toBe(50);
  });
});
