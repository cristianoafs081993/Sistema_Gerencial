import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const singleMock = vi.fn();
  const selectAfterInsertMock = vi.fn();
  const insertMock = vi.fn();
  const orderMock = vi.fn();
  const selectMock = vi.fn();
  const fromMock = vi.fn((table: string) => {
    if (table !== 'descentralizacoes') {
      throw new Error(`Tabela nao mockada: ${table}`);
    }

    return {
      insert: insertMock,
      select: selectMock,
    };
  });

  return {
    singleMock,
    selectAfterInsertMock,
    insertMock,
    orderMock,
    selectMock,
    fromMock,
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.fromMock,
  },
}));

vi.mock('@/lib/supabaseRest', () => ({
  fetchSupabaseRestRows: vi.fn(),
}));

import { descentralizacoesService } from '@/services/descentralizacoes';

describe('descentralizacoesService.processDevolucao', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.insertMock.mockReturnValue({ select: mocks.selectAfterInsertMock });
    mocks.selectAfterInsertMock.mockReturnValue({ single: mocks.singleMock });
    mocks.selectMock.mockReturnValue({ order: mocks.orderMock });

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('insere uma devolucao como novo lancamento negativo', async () => {
    mocks.singleMock.mockResolvedValueOnce({
      data: {
        id: 'dev-1',
        dimensao: 'EN - Ensino',
        dimensao_id: null,
        nota_credito: null,
        operacao_tipo: 'DEVOLUCAO',
        origem_recurso: '231796',
        origem_recurso_id: null,
        natureza_despesa: '339000',
        natureza_despesa_id: null,
        plano_interno: 'L20RLP19ENN',
        plano_interno_id: null,
        data_emissao: '2026-01-22',
        descricao: 'DEVOLUCAO',
        valor: -1000,
        created_at: '2026-04-14T10:00:00.000Z',
        updated_at: '2026-04-14T10:00:00.000Z',
      },
      error: null,
    });

    const result = await descentralizacoesService.processDevolucao({
      dataEmissao: '2026-01-22',
      descricao: 'DEVOLUCAO',
      ptres: '231796',
      naturezaDespesa: '339000',
      planoInterno: 'l20rlp19enn',
      valor: 1000,
      dimensao: 'EN - Ensino',
    });

    expect(mocks.insertMock).toHaveBeenCalledWith({
      dimensao: 'EN - Ensino',
      origem_recurso: '231796',
      natureza_despesa: '339000',
      plano_interno: 'L20RLP19ENN',
      data_emissao: '2026-01-22',
      descricao: 'DEVOLUCAO',
      valor: -1000,
      operacao_tipo: 'DEVOLUCAO',
    });
    expect(result).toMatchObject({
      id: 'dev-1',
      origemRecurso: '231796',
      planoInterno: 'L20RLP19ENN',
      valor: -1000,
      operacaoTipo: 'DEVOLUCAO',
    });
  });

  it('retorna null quando a insercao falha', async () => {
    mocks.singleMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'falha ao inserir' },
    });

    const result = await descentralizacoesService.processDevolucao({
      ptres: '231796',
      valor: 1000,
      dimensao: 'EN - Ensino',
    });

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});
