import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const orderMock = vi.fn();
  const eqThirdMock = vi.fn();
  const eqSecondMock = vi.fn(() => ({ eq: eqThirdMock }));
  const eqFirstMock = vi.fn(() => ({ order: orderMock, eq: eqSecondMock }));
  const selectAfterInsertMock = vi.fn();
  const singleMock = vi.fn();
  const insertMock = vi.fn(() => ({ select: selectAfterInsertMock }));
  const deleteMock = vi.fn(() => ({ eq: eqFirstMock }));
  const selectMock = vi.fn(() => ({ eq: eqFirstMock }));
  const fromMock = vi.fn((table: string) => {
    if (table !== 'user_favorites') {
      throw new Error(`Tabela nao mockada: ${table}`);
    }

    return {
      select: selectMock,
      insert: insertMock,
      delete: deleteMock,
    };
  });

  return {
    orderMock,
    eqFirstMock,
    eqSecondMock,
    eqThirdMock,
    selectAfterInsertMock,
    singleMock,
    insertMock,
    deleteMock,
    selectMock,
    fromMock,
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.fromMock,
  },
}));

import { userFavoritesService } from '@/services/userFavorites';

describe('userFavoritesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.orderMock.mockResolvedValue({ data: [], error: null });
    mocks.eqThirdMock.mockResolvedValue({ error: null });
    mocks.selectAfterInsertMock.mockReturnValue({ single: mocks.singleMock });
    mocks.singleMock.mockResolvedValue({
      data: {
        id: 'fav-1',
        user_id: 'user-1',
        entity_type: 'empenho',
        empenho_id: 'empenho-1',
        contrato_id: null,
        created_at: '2026-04-30T10:00:00Z',
      },
      error: null,
    });
  });

  it('mapeia favoritos de empenhos e contratos vindos do Supabase', async () => {
    mocks.orderMock.mockResolvedValueOnce({
      data: [
        {
          id: 'fav-empenho',
          user_id: 'user-1',
          entity_type: 'empenho',
          empenho_id: 'empenho-1',
          contrato_id: null,
          created_at: '2026-04-30T10:00:00Z',
        },
        {
          id: 'fav-contrato',
          user_id: 'user-1',
          entity_type: 'contrato',
          empenho_id: null,
          contrato_id: 'contrato-1',
          created_at: '2026-04-30T11:00:00Z',
        },
      ],
      error: null,
    });

    const result = await userFavoritesService.getAll('user-1');

    expect(mocks.selectMock).toHaveBeenCalledWith('id,user_id,entity_type,empenho_id,contrato_id,created_at');
    expect(mocks.eqFirstMock).toHaveBeenCalledWith('user_id', 'user-1');
    expect(result).toEqual([
      {
        id: 'fav-empenho',
        userId: 'user-1',
        entityType: 'empenho',
        entityId: 'empenho-1',
        createdAt: new Date('2026-04-30T10:00:00Z'),
      },
      {
        id: 'fav-contrato',
        userId: 'user-1',
        entityType: 'contrato',
        entityId: 'contrato-1',
        createdAt: new Date('2026-04-30T11:00:00Z'),
      },
    ]);
  });

  it('insere favorito de empenho com a coluna de entidade correta', async () => {
    await userFavoritesService.addFavorite('empenho', 'empenho-1', 'user-1');

    expect(mocks.insertMock).toHaveBeenCalledWith({
      user_id: 'user-1',
      entity_type: 'empenho',
      empenho_id: 'empenho-1',
      contrato_id: null,
    });
  });

  it('insere favorito de contrato com a coluna de entidade correta', async () => {
    mocks.singleMock.mockResolvedValueOnce({
      data: {
        id: 'fav-contrato',
        user_id: 'user-1',
        entity_type: 'contrato',
        empenho_id: null,
        contrato_id: 'contrato-1',
        created_at: '2026-04-30T10:00:00Z',
      },
      error: null,
    });

    await userFavoritesService.addFavorite('contrato', 'contrato-1', 'user-1');

    expect(mocks.insertMock).toHaveBeenCalledWith({
      user_id: 'user-1',
      entity_type: 'contrato',
      empenho_id: null,
      contrato_id: 'contrato-1',
    });
  });

  it('remove favorito filtrando usuario, tipo e id da entidade', async () => {
    await userFavoritesService.removeFavorite('contrato', 'contrato-1', 'user-1');

    expect(mocks.deleteMock).toHaveBeenCalled();
    expect(mocks.eqFirstMock).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mocks.eqSecondMock).toHaveBeenCalledWith('entity_type', 'contrato');
    expect(mocks.eqThirdMock).toHaveBeenCalledWith('contrato_id', 'contrato-1');
  });
});
