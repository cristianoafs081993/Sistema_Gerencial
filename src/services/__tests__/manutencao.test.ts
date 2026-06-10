import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { manutencaoService, type BlocoMapa } from '../manutencao';

const mocks = vi.hoisted(() => {
  const singleMock = vi.fn();
  const selectMock = vi.fn();
  const insertMock = vi.fn();
  const upsertMock = vi.fn();
  const deleteMock = vi.fn();
  const eqMock = vi.fn();
  const orderMock = vi.fn();

  const fromMock = vi.fn((table: string) => {
    if (table !== 'manutencao_blocos_mapa') {
      throw new Error(`Table not mocked: ${table}`);
    }
    return {
      select: selectMock,
      insert: insertMock,
      upsert: upsertMock,
      delete: deleteMock,
    };
  });

  return {
    singleMock,
    selectMock,
    insertMock,
    upsertMock,
    deleteMock,
    eqMock,
    orderMock,
    fromMock,
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.fromMock,
  },
}));

describe('manutencaoService - blocos mapa', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.selectMock.mockReturnValue({ order: mocks.orderMock });
    mocks.upsertMock.mockReturnValue({ select: vi.fn().mockReturnValue({ single: mocks.singleMock }) });
    mocks.deleteMock.mockReturnValue({ eq: mocks.eqMock });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('busca todos os blocos do mapa ordenados por nome', async () => {
    const mockData = [
      { id: '1', nome: 'Bloco A', zona: 'academico', badge_x: 100, badge_y: 200, geometria_tipo: 'rect', geometria_data: {} }
    ];
    mocks.orderMock.mockResolvedValueOnce({ data: mockData, error: null });

    const result = await manutencaoService.getBlocosMapa();
    expect(mocks.fromMock).toHaveBeenCalledWith('manutencao_blocos_mapa');
    expect(mocks.orderMock).toHaveBeenCalledWith('nome', { ascending: true });
    expect(result).toEqual(mockData as BlocoMapa[]);
  });

  it('salva ou atualiza um bloco do mapa', async () => {
    const payload: Omit<BlocoMapa, 'created_at' | 'updated_at'> = {
      id: 'bloco-1',
      nome: 'Bloco B',
      zona: 'administrativo',
      badge_x: 150,
      badge_y: 250,
      geometria_tipo: 'polygon',
      geometria_data: { points: '1,2 3,4' }
    };

    mocks.singleMock.mockResolvedValueOnce({ data: payload, error: null });

    const result = await manutencaoService.saveBlocoMapa(payload);
    expect(mocks.upsertMock).toHaveBeenCalledWith(payload);
    expect(result).toEqual(payload as BlocoMapa);
  });

  it('deleta um bloco do mapa pelo ID', async () => {
    mocks.eqMock.mockResolvedValueOnce({ error: null });

    await manutencaoService.deleteBlocoMapa('bloco-1');
    expect(mocks.deleteMock).toHaveBeenCalled();
    expect(mocks.eqMock).toHaveBeenCalledWith('id', 'bloco-1');
  });
});
