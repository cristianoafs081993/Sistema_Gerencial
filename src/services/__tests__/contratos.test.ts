import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const upsertMock = vi.fn();
  const selectMock = vi.fn();
  const inMock = vi.fn();
  const insertMock = vi.fn();
  const updateMock = vi.fn();
  const eqMock = vi.fn();
  const fromMock = vi.fn((table: string) => {
    if (table !== 'contratos') {
      throw new Error(`Tabela nao mockada: ${table}`);
    }

    return {
      upsert: upsertMock,
      select: selectMock,
      insert: insertMock,
      update: updateMock,
    };
  });

  return {
    upsertMock,
    selectMock,
    inMock,
    insertMock,
    updateMock,
    eqMock,
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

import { contratosService } from '@/services/contratos';

describe('contratosService.upsertBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.selectMock.mockReturnValue({ in: mocks.inMock });
    mocks.updateMock.mockReturnValue({ eq: mocks.eqMock });
    mocks.upsertMock.mockResolvedValue({ error: null });
    mocks.inMock.mockResolvedValue({ data: [], error: null });
    mocks.insertMock.mockResolvedValue({ error: null });
    mocks.eqMock.mockResolvedValue({ error: null });

    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normaliza, ignora campos nao persistidos e deduplica contratos antes do upsert', async () => {
    await contratosService.upsertBatch([
      {
        numero: ' 123/2026 ',
        contratada: ' Empresa Teste ',
        cnpj: '14.426.441/0001-64',
        data_inicio: new Date('2026-03-10T00:00:00Z'),
        data_termino: '2026-12-20',
      },
      {
        numero: '123/2026',
        contratada: '',
        valor: 1575.4,
        data_inicio: '2026-03-15',
        data_termino: '2026-12-31',
      },
      {
        numero: '',
        contratada: 'Ignorar',
      },
    ]);

    expect(mocks.upsertMock).toHaveBeenCalledWith(
      [
        {
          numero: '123/2026',
          contratada: 'Empresa Teste',
          valor: 1575.4,
          data_inicio: '2026-03-10',
          data_termino: '2026-12-31',
        },
      ],
      { onConflict: 'numero' },
    );
    expect(mocks.selectMock).not.toHaveBeenCalled();
  });

  it('faz fallback para insert/update manual quando o upsert falha', async () => {
    mocks.upsertMock.mockResolvedValueOnce({
      error: { code: '42P10', message: 'there is no unique constraint' },
    });
    mocks.inMock.mockResolvedValueOnce({
      data: [{ numero: '001/2026' }],
      error: null,
    });

    await contratosService.upsertBatch([
      { numero: '001/2026', valor: 9800 },
      { numero: '002/2026', contratada: 'Nova Contratada', cnpj: '14.426.441/0001-64', data_inicio: '2026-01-15' },
    ]);

    expect(mocks.selectMock).toHaveBeenCalledWith('numero');
    expect(mocks.inMock).toHaveBeenCalledWith('numero', ['001/2026', '002/2026']);
    expect(mocks.updateMock).toHaveBeenCalledWith({ valor: 9800 });
    expect(mocks.eqMock).toHaveBeenCalledWith('numero', '001/2026');
    expect(mocks.insertMock).toHaveBeenCalledWith([
      {
        numero: '002/2026',
        contratada: 'Nova Contratada',
        data_inicio: '2026-01-15',
      },
    ]);
  });

  it('falha com mensagem clara se precisar inserir sem contratada', async () => {
    mocks.upsertMock.mockResolvedValueOnce({
      error: { code: '42P10', message: 'there is no unique constraint' },
    });
    mocks.inMock.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    await expect(
      contratosService.upsertBatch([{ numero: '003/2026', valor: 500 }]),
    ).rejects.toThrow('Nao foi possivel inserir o contrato 003/2026 sem a coluna "contratada".');

    expect(mocks.insertMock).not.toHaveBeenCalled();
  });
});
