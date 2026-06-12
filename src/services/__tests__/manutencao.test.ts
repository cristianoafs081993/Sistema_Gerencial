import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  manutencaoService,
  type BlocoMapa,
  validateOcorrenciaFoto,
} from '../manutencao';

const mocks = vi.hoisted(() => {
  const singleMock = vi.fn();
  const selectMock = vi.fn();
  const insertMock = vi.fn();
  const upsertMock = vi.fn();
  const deleteMock = vi.fn();
  const eqMock = vi.fn();
  const orderMock = vi.fn();
  const occurrenceSelectMock = vi.fn();
  const occurrenceOrderMock = vi.fn();
  const occurrenceInsertMock = vi.fn();
  const occurrenceSingleMock = vi.fn();
  const storageFromMock = vi.fn();
  const uploadMock = vi.fn();
  const createSignedUrlMock = vi.fn();

  const fromMock = vi.fn((table: string) => {
    if (table === 'manutencao_blocos_mapa') {
      return {
        select: selectMock,
        insert: insertMock,
        upsert: upsertMock,
        delete: deleteMock,
      };
    }

    if (table === 'manutencao_ocorrencias') {
      return {
        select: occurrenceSelectMock,
        insert: occurrenceInsertMock,
      };
    }

    throw new Error(`Table not mocked: ${table}`);
  });

  return {
    singleMock,
    selectMock,
    insertMock,
    upsertMock,
    deleteMock,
    eqMock,
    orderMock,
    occurrenceSelectMock,
    occurrenceOrderMock,
    occurrenceInsertMock,
    occurrenceSingleMock,
    storageFromMock,
    uploadMock,
    createSignedUrlMock,
    fromMock,
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.fromMock,
    storage: {
      from: mocks.storageFromMock,
    },
  },
}));

describe('manutencaoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.selectMock.mockReturnValue({ order: mocks.orderMock });
    mocks.upsertMock.mockReturnValue({ select: vi.fn().mockReturnValue({ single: mocks.singleMock }) });
    mocks.deleteMock.mockReturnValue({ eq: mocks.eqMock });
    mocks.occurrenceSelectMock.mockReturnValue({ order: mocks.occurrenceOrderMock });
    mocks.occurrenceInsertMock.mockReturnValue({
      select: vi.fn().mockReturnValue({ single: mocks.occurrenceSingleMock }),
    });
    mocks.storageFromMock.mockReturnValue({
      upload: mocks.uploadMock,
      createSignedUrl: mocks.createSignedUrlMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('busca todos os blocos do mapa ordenados por nome', async () => {
    const mockData = [
      { id: '1', nome: 'Bloco A', badge_x: 100, badge_y: 200, geometria_tipo: 'rect', geometria_data: {} }
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

  it('envia a foto privada antes de criar a ocorrência', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('123e4567-e89b-42d3-a456-426614174000');
    const foto = new File(['foto'], 'problema.jpg', { type: 'image/jpeg' });
    const payload = {
      ambiente_id: '223e4567-e89b-42d3-a456-426614174000',
      respondente_tipo: 'anonimo',
      avaliacao: 2,
      problemas: ['sujeira'],
      observacao: 'Piso molhado',
    };
    const created = {
      id: '123e4567-e89b-42d3-a456-426614174000',
      ...payload,
      foto_path: `${payload.ambiente_id}/123e4567-e89b-42d3-a456-426614174000.jpg`,
      status: 'pendente',
    };

    mocks.uploadMock.mockResolvedValueOnce({ data: { path: created.foto_path }, error: null });
    mocks.occurrenceSingleMock.mockResolvedValueOnce({ data: created, error: null });

    await expect(manutencaoService.createOcorrencia(payload, foto)).resolves.toEqual(created);
    expect(mocks.storageFromMock).toHaveBeenCalledWith('manutencao-ocorrencias');
    expect(mocks.uploadMock).toHaveBeenCalledWith(
      created.foto_path,
      foto,
      expect.objectContaining({ contentType: 'image/jpeg', upsert: false }),
    );
    expect(mocks.occurrenceInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: created.id,
        ambiente_id: payload.ambiente_id,
        foto_path: created.foto_path,
        status: 'pendente',
      }),
    );
  });

  it('rejeita formatos de foto não suportados', () => {
    expect(validateOcorrenciaFoto({ type: 'image/gif', size: 1024 })).toContain('JPEG');
  });
});
