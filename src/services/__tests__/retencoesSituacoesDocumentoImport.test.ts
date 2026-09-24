import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }));

import { retencoesService } from '@/services/retencoes';

describe('retencoesService.importSituacoesDocumentosHabeis', () => {
  beforeEach(() => supabaseMock.from.mockReset());

  it('mapeia o CSV de retenções para a estrutura persistida sem reenviar cabeçalhos SIAFI', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    supabaseMock.from.mockReturnValue({ upsert });

    const count = await retencoesService.importSituacoesDocumentosHabeis([
      {
        documentohabil: '158366264352026NP000262',
        dhsituacao: 'DOB035',
        dhvalordocorigem: '1.928,83',
      },
      { documentohabil: '', dhsituacao: 'DOB035', dhvalordocorigem: '100,00' },
    ]);

    expect(count).toBe(1);
    expect(supabaseMock.from).toHaveBeenCalledWith('documentos_habeis_situacoes');
    expect(upsert).toHaveBeenCalledWith([
      {
        documento_habil_id: '2026NP000262',
        situacao_codigo: 'DOB035',
        valor: 1928.83,
        is_retencao: true,
      },
    ], expect.objectContaining({ onConflict: 'documento_habil_id, situacao_codigo, valor' }));
  });

  it('recusa arquivo sem linhas de situação válidas', async () => {
    await expect(retencoesService.importSituacoesDocumentosHabeis([
      { documentohabil: '', dhsituacao: '', dhvalordocorigem: '' },
    ])).rejects.toThrow('não contém situações com documento hábil e valor reconhecidos');
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});
