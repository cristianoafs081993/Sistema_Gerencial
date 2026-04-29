import { transparenciaService } from '@/services/transparencia';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

describe('transparenciaService.importOrdensBancarias', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
  });

  it('salva Dia Lancamento como data_emissao da OB importada manualmente', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const validIdsInMock = vi.fn().mockResolvedValue({ data: [{ id: '2025NP000421' }], error: null });
    const empenhosInMock = vi.fn().mockResolvedValue({ data: [], error: null });

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'documentos_habeis') {
        return {
          select: vi.fn(() => ({ in: validIdsInMock })),
        };
      }
      if (table === 'documentos_habeis_itens') {
        return { upsert: upsertMock };
      }
      if (table === 'empenhos') {
        return {
          select: vi.fn(() => ({ in: empenhosInMock })),
        };
      }
      throw new Error(`Tabela inesperada: ${table}`);
    });

    await transparenciaService.importOrdensBancarias([
      {
        dialancamento: '08/01/2026',
        documento: '158366264352026OB000001',
        documentoorigem: '158366264352025NP000421',
        restosapagarpagosprocenproc: '744,61',
        doctipo: 'OB',
        docobservacao: 'PGTO DO(S) INSTR.(S) DE COBRANCA(S)',
      },
    ]);

    expect(upsertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        id: '2026OB000001',
        documento_habil_id: '2025NP000421',
        doc_tipo: 'OB',
        valor: 744.61,
        data_emissao: '2026-01-08',
        observacao: 'PGTO DO(S) INSTR.(S) DE COBRANCA(S)',
      }),
    ], { onConflict: 'id' });
  });
});
