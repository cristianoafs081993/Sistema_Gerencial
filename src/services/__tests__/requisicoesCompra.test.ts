import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMocks,
}));

import { requisicoesCompraService } from '@/services/requisicoesCompra';

describe('requisicoesCompraService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('envia empenhos multiplos e empenhoId dos itens ao RPC de salvamento', async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: 'req-1', error: null });

    await requisicoesCompraService.saveRequisicao(
      {
        title: 'Requisicao de Compra REQ-2026-0001',
        number: 'REQ-2026-0001',
        empenhoId: 'emp-1',
        empenhoNumero: '2026NE000011',
        empenhos: [
          { empenhoId: 'emp-1', empenhoNumero: '2026NE000011', sortOrder: 0 },
          { empenhoId: 'emp-2', empenhoNumero: '2026NE000012', sortOrder: 1 },
        ],
        status: 'review',
      },
      [
        {
          description: 'Item da primeira NE',
          quantity: 1,
          unit: 'UN',
          unitPrice: 10,
          empenhoId: 'emp-1',
          empenhoNumero: '2026NE000011',
          sortOrder: 0,
        },
        {
          description: 'Item da segunda NE',
          quantity: 2,
          unit: 'UN',
          unitPrice: 20,
          empenhoId: 'emp-2',
          empenhoNumero: '2026NE000012',
          sortOrder: 1,
        },
      ],
    );

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('save_requisicao_compra', {
      p_id: null,
      p_requisicao: expect.objectContaining({
        empenhoId: 'emp-1',
        empenhoNumero: '2026NE000011',
        empenhos: [
          { empenhoId: 'emp-1', empenhoNumero: '2026NE000011', sortOrder: 0 },
          { empenhoId: 'emp-2', empenhoNumero: '2026NE000012', sortOrder: 1 },
        ],
      }),
      p_items: [
        expect.objectContaining({ empenhoId: 'emp-1', empenhoNumero: '2026NE000011' }),
        expect.objectContaining({ empenhoId: 'emp-2', empenhoNumero: '2026NE000012' }),
      ],
    });
  });

  it('mapeia requisicao_compra_empenhos na listagem de requisicoes', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'req-1',
          title: 'Compra',
          number: 'REQ-2026-0001',
          process_number: null,
          contrato_id: null,
          contrato_numero: null,
          empenho_id: 'emp-1',
          empenho_numero: '2026NE000011',
          requisicao_compra_empenhos: [
            {
              id: 'link-2',
              requisicao_compra_id: 'req-1',
              empenho_id: 'emp-2',
              empenho_numero: '2026NE000012',
              sort_order: 1,
            },
            {
              id: 'link-1',
              requisicao_compra_id: 'req-1',
              empenho_id: 'emp-1',
              empenho_numero: '2026NE000011',
              sort_order: 0,
            },
          ],
          notes: null,
          status: 'draft',
          created_by: 'user-1',
          created_by_email: 'user@ifrn.edu.br',
          created_at: '2026-07-01T12:00:00Z',
          updated_at: '2026-07-02T12:00:00Z',
        },
      ],
      error: null,
    });
    const select = vi.fn(() => ({ order }));
    supabaseMocks.from.mockReturnValue({ select });

    const rows = await requisicoesCompraService.listRecentRequisicoes();

    expect(supabaseMocks.from).toHaveBeenCalledWith('requisicoes_compra');
    expect(rows[0].empenhos).toEqual([
      { id: 'link-1', requisicaoCompraId: 'req-1', empenhoId: 'emp-1', empenhoNumero: '2026NE000011', sortOrder: 0 },
      { id: 'link-2', requisicaoCompraId: 'req-1', empenhoId: 'emp-2', empenhoNumero: '2026NE000012', sortOrder: 1 },
    ]);
  });
});
