import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  eqMock: vi.fn(),
  orderMock: vi.fn(),
  restMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.fromMock },
}));

vi.mock('@/lib/supabaseRest', () => ({
  fetchSupabaseRestRows: mocks.restMock,
}));

import { atividadesService, filterAtividadeRowsForRead } from '@/services/atividades';

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'atividade-1',
  campus_uasg: '158366',
  dimensao: 'AD - Administração',
  componente_funcional: 'Gestão',
  processo: '',
  tipo_atividade: 'campus',
  atividade: 'Atividade de teste',
  descricao: 'Descrição',
  valor_total: 100,
  saldo_disponivel: 100,
  origem_recurso: 'Tesouro',
  natureza_despesa: '339039',
  plano_interno: 'PI-TESTE',
  sync_source: 'suap_plan_8',
  suap_unit_code: '19',
  sync_active: true,
  created_at: '2026-09-10T00:00:00.000Z',
  updated_at: '2026-09-10T00:00:00.000Z',
  ...overrides,
});

describe('isolamento do planejamento SUAP na leitura', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fromMock.mockReturnValue({ select: mocks.selectMock });
    mocks.selectMock.mockReturnValue({ eq: mocks.eqMock });
    mocks.eqMock.mockReturnValue({ order: mocks.orderMock });
    mocks.orderMock.mockResolvedValue({ data: [], error: null });
  });

  it('mantém apenas a unidade SUAP selecionada quando várias compartilham o UASG de Currais Novos', () => {
    const visible = filterAtividadeRowsForRead([
      row({ id: 'currais', suap_unit_code: '19' }),
      row({ id: 'polo', suap_unit_code: '36' }),
      row({ id: 'jucurutu', suap_unit_code: '25' }),
      row({ id: 'parelhas', suap_unit_code: '29' }),
    ], '19');

    expect(visible.map((item) => item.id)).toEqual(['currais']);
  });

  it('permite consultar outra unidade sem misturá-la com Currais Novos', () => {
    const visible = filterAtividadeRowsForRead([
      row({ id: 'currais', suap_unit_code: '19' }),
      row({ id: 'jucurutu', suap_unit_code: '25' }),
    ], '25');

    expect(visible.map((item) => item.id)).toEqual(['jucurutu']);
  });

  it('remove linhas arquivadas e preserva atividades manuais do mesmo UASG', () => {
    const visible = filterAtividadeRowsForRead([
      row({ id: 'arquivada', sync_active: false }),
      row({ id: 'manual', sync_source: null, suap_unit_code: '36' }),
      row({ id: 'plano-currais', suap_unit_code: '19' }),
    ], '19');

    expect(visible.map((item) => item.id)).toEqual(['manual', 'plano-currais']);
  });

  it('trata registros antigos do Plano 8 sem unidade como Currais Novos', () => {
    const visible = filterAtividadeRowsForRead([
      row({ id: 'legado', suap_unit_code: null }),
      row({ id: 'outra-unidade', suap_unit_code: '36' }),
    ], '19');

    expect(visible.map((item) => item.id)).toEqual(['legado']);
  });

  it('aplica o filtro também no retorno principal do serviço', async () => {
    mocks.orderMock.mockResolvedValue({
      data: [
        row({ id: 'ativo-currais', suap_unit_code: '19' }),
        row({ id: 'outra-unidade', suap_unit_code: '36' }),
        row({ id: 'arquivada', sync_active: false }),
      ],
      error: null,
    });

    const result = await atividadesService.getAll('158366', '19');

    expect(result.map((item) => item.id)).toEqual(['ativo-currais']);
  });

  it('aplica o mesmo filtro quando o cliente Supabase cai para REST', async () => {
    mocks.orderMock.mockResolvedValue({ data: null, error: new Error('cliente indisponível') });
    mocks.restMock.mockResolvedValue([
      row({ id: 'ativo-currais', suap_unit_code: '19' }),
      row({ id: 'outra-unidade', suap_unit_code: '36' }),
      row({ id: 'arquivada', sync_active: false }),
    ]);

    const result = await atividadesService.getAll('158366', '19');

    expect(result.map((item) => item.id)).toEqual(['ativo-currais']);
    expect(mocks.restMock).toHaveBeenCalledWith(
      'atividades',
      expect.stringContaining('suap_unit_code'),
      expect.objectContaining({ filters: { campus_uasg: '158366' } }),
    );
  });
});
