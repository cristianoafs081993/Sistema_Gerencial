import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }));

import { transparenciaService } from '@/services/transparencia';

describe('transparenciaService.importDocumentosHabeis', () => {
  beforeEach(() => supabaseMock.from.mockReset());

  it('importa os campos do CSV SIAFI, incluindo valor de métrica sem título e moeda brasileira', async () => {
    const documentUpsert = vi.fn().mockResolvedValue({ error: null });
    const situationsInsert = vi.fn().mockResolvedValue({ error: null });
    const itemsInsert = vi.fn().mockResolvedValue({ error: null });
    const situationDelete = vi.fn(() => ({ in: vi.fn().mockResolvedValue({ error: null }) }));
    const itemDelete = vi.fn(() => ({ in: vi.fn().mockResolvedValue({ error: null }) }));
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'documentos_habeis') return { upsert: documentUpsert };
      if (table === 'documentos_habeis_situacoes') return { delete: situationDelete, insert: situationsInsert };
      if (table === 'documentos_habeis_itens') return { delete: itemDelete, insert: itemsInsert };
      if (!table) return {};
      throw new Error(`Tabela inesperada: ${table}`);
    });

    const count = await transparenciaService.importDocumentosHabeis([{
      documentohabil: '158366264352026NP000262',
      dhprocesso: '23035.002730/2026-91',
      dhestado: 'REALIZADO',
      dhcredor: '12345678000199',
      empty_6: 'EMPRESA EXEMPLO',
      dhsituacao: 'DOB035',
      dhdataemissaodocorigem: '14/09/2026',
      dhvalordocorigem: '18.669,00',
      metrica: 'Retenção',
      empty_14: 'R$ 1.928,83',
    }]);

    expect(count).toBe(1);
    expect(documentUpsert).toHaveBeenCalledWith([
      expect.objectContaining({
        id: '2026NP000262',
        valor_original: 18669,
        favorecido_nome: 'EMPRESA EXEMPLO',
      }),
    ], { onConflict: 'id' });
    expect(situationsInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        documento_habil_id: '2026NP000262',
        situacao_codigo: 'DOB035',
        valor: 1928.83,
        is_retencao: true,
      }),
    ]);
  });
});
