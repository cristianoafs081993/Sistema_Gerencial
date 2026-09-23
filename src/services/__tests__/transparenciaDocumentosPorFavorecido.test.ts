import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

import { transparenciaService } from '@/services/transparencia';

describe('transparenciaService.getDocumentosPorFavorecido', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
  });

  function mockDocumentQuery(response: { data: unknown[]; error: unknown; count: number }) {
    const builder: Record<'in' | 'or' | 'order' | 'range', ReturnType<typeof vi.fn>> = {
      in: vi.fn(),
      or: vi.fn(),
      order: vi.fn(),
      range: vi.fn().mockResolvedValue(response),
    };
    builder.in.mockReturnValue(builder);
    builder.or.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);

    const select = vi.fn().mockReturnValue(builder);
    supabaseMock.from.mockReturnValue({ select });
    return { builder, select };
  }

  it('normaliza CPF/CNPJ e filtra documentos NP/RP em ordem de emissão decrescente', async () => {
    const { builder, select } = mockDocumentQuery({
      data: [
        {
          id: '158366264352026NP000085',
          valor_original: '1250.50',
          valor_pago: '1250.50',
          estado: 'REALIZADO',
          processo: '23000.000085/2026-10',
          favorecido_nome: 'FORNECEDOR EXEMPLO',
          favorecido_documento: '07.805.649/0001-29',
          data_emissao: '2026-02-03',
          fonte_sof: '1000',
          empenho_numero: '2026NE000085',
        },
        {
          id: '158366264352025RP000031',
          valor_original: '500',
          valor_pago: '0',
          estado: 'PENDENTE DE REALIZAÇÃO',
          processo: '23000.000031/2025-10',
          favorecido_nome: 'FORNECEDOR EXEMPLO',
          favorecido_documento: '07805649000129',
          data_emissao: '2025-08-17',
        },
      ],
      error: null,
      count: 2,
    });

    const result = await transparenciaService.getDocumentosPorFavorecido('07.805.649/0001-29');

    expect(supabaseMock.from).toHaveBeenCalledWith('documentos_habeis');
    expect(select).toHaveBeenCalledWith(
      'id,valor_original,valor_pago,estado,processo,favorecido_nome,favorecido_documento,data_emissao,fonte_sof,empenho_numero',
      { count: 'exact' },
    );
    expect(builder.in).toHaveBeenCalledWith('favorecido_documento', ['07805649000129', '07.805.649/0001-29']);
    expect(builder.or).toHaveBeenCalledWith('id.ilike.%NP%,id.ilike.%RP%');
    expect(builder.or.mock.calls[0][0]).not.toMatch(/NS|OB/);
    expect(builder.order).toHaveBeenCalledWith('data_emissao', { ascending: false });
    expect(builder.range).toHaveBeenCalledWith(0, 19);
    expect(result).toEqual({
      total: 2,
      data: [
        expect.objectContaining({
          id: '158366264352026NP000085',
          estado: 'REALIZADO',
          favorecido_documento: '07.805.649/0001-29',
          valor_original: 1250.5,
          valor_pago: 1250.5,
          itens: [],
          situacoes: [],
        }),
        expect.objectContaining({
          id: '158366264352025RP000031',
          estado: 'PENDENTE DE REALIZAÇÃO',
          favorecido_documento: '07805649000129',
        }),
      ],
    });
    expect(result.data.map((documento) => documento.id)).toEqual([
      '158366264352026NP000085',
      '158366264352025RP000031',
    ]);
  });

  it('usa a faixa da página solicitada para não truncar a lista de resultados', async () => {
    const { builder } = mockDocumentQuery({ data: [], error: null, count: 45 });

    const result = await transparenciaService.getDocumentosPorFavorecido('07805649000129', { page: 3, perPage: 20 });

    expect(builder.range).toHaveBeenCalledWith(40, 59);
    expect(result.total).toBe(45);
  });

  it('não consulta o banco quando a entrada não tem 11 ou 14 dígitos', async () => {
    await expect(transparenciaService.getDocumentosPorFavorecido('123.456')).resolves.toEqual({ data: [], total: 0 });
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});
