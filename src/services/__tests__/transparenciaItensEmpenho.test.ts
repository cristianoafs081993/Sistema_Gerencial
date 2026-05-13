import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  supabaseFromMock: vi.fn(),
  supabaseFunctionsInvokeMock: vi.fn(),
}));

const { fetchMock, supabaseFromMock, supabaseFunctionsInvokeMock } = mocks;

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: supabaseFromMock,
    functions: {
      invoke: supabaseFunctionsInvokeMock,
    },
  },
}));

vi.stubGlobal('fetch', fetchMock);

describe('transparenciaService.getItensEmpenhoPortal', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    supabaseFromMock.mockReset();
    supabaseFunctionsInvokeMock.mockReset();
    supabaseFromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: null,
            error: { code: 'PGRST205', message: 'Could not find the table' },
          }),
        }),
      }),
    });
  });

  it('busca os subitens do empenho usando UG, gestao e numero normalizado', async () => {
    const { transparenciaService } = await import('@/services/transparencia');

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('pagina=1')) {
        return {
          ok: true,
          json: async () => [
            {
              codigoItemEmpenho: '158366264352026NE000013',
              descricao: 'Recurso para pagamento de auxilio transporte.',
              codigoSubelemento: '01',
              descricaoSubelemento: 'BOLSAS DE ESTUDO NO PAIS',
              valorAtual: '36.700,00',
              sequencial: 1,
            },
          ],
        } as Response;
      }

      return {
        ok: true,
        json: async () => [],
      } as Response;
    });

    const result = await transparenciaService.getItensEmpenhoPortal('2026NE000013');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api-transparencia/api-de-dados/despesas/itens-de-empenho?codigoDocumento=158366264352026NE000013&pagina=1',
      expect.objectContaining({
        headers: expect.objectContaining({
          'chave-api-dados': expect.any(String),
        }),
      }),
    );
    expect(result).toEqual([
      {
        codigoItemEmpenho: '158366264352026NE000013',
        sequencial: 1,
        descricao: 'Recurso para pagamento de auxilio transporte.',
        codigoSubelemento: '01',
        descricaoSubelemento: 'BOLSAS DE ESTUDO NO PAIS',
        valorAtual: 36700,
        historico: [],
      },
    ]);
  });

  it('le subitens do cache Supabase quando o cache esta fresco', async () => {
    const { transparenciaService } = await import('@/services/transparencia');

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === 'portal_transparencia_empenho_itens_cache_status') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  status: 'found',
                  rows_count: 1,
                  expires_at: new Date(Date.now() + 60_000).toISOString(),
                },
                error: null,
              }),
            }),
          }),
        };
      }

      return {
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: [
                {
                  codigo_item_empenho: '158366264352026NE000010',
                  sequencial: 1,
                  descricao: 'FORNECIMENTO DE ENERGIA ELETRICA',
                  codigo_subelemento: '43',
                  descricao_subelemento: 'SERVICOS DE ENERGIA ELETRICA',
                  valor_atual: 49749.21,
                  historico: [],
                },
              ],
              error: null,
            }),
          }),
        }),
      };
    });

    const result = await transparenciaService.getItensEmpenhoPortal('2026NE000010');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(supabaseFunctionsInvokeMock).not.toHaveBeenCalled();
    expect(result).toEqual([
      {
        codigoItemEmpenho: '158366264352026NE000010',
        sequencial: 1,
        descricao: 'FORNECIMENTO DE ENERGIA ELETRICA',
        codigoSubelemento: '43',
        descricaoSubelemento: 'SERVICOS DE ENERGIA ELETRICA',
        valorAtual: 49749.21,
        historico: [],
      },
    ]);
  });

  it('prepara valor atual e historico quando solicitado', async () => {
    const { transparenciaService } = await import('@/services/transparencia');

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/historico') && url.includes('pagina=1')) {
        return {
          ok: true,
          json: async () => [
            {
              data: '24/02/2026',
              operacao: 'INCLUSAO',
              quantidade: '1,00',
              valorUnitario: '14.200,00',
              valorTotal: '14.200,00',
            },
          ],
        } as Response;
      }
      if (url.includes('/historico')) {
        return {
          ok: true,
          json: async () => [],
        } as Response;
      }
      if (url.includes('pagina=1')) {
        return {
          ok: true,
          json: async () => [
            {
              codigoItemEmpenho: '158366264352026NE000013',
              descricao: 'Recurso para pagamento de auxilio transporte.',
              codigoSubelemento: '01',
              descricaoSubelemento: 'BOLSAS DE ESTUDO NO PAIS',
              valorAtual: '36.700,00',
              sequencial: 1,
            },
          ],
        } as Response;
      }

      return {
        ok: true,
        json: async () => [],
      } as Response;
    });

    const result = await transparenciaService.getItensEmpenhoPortal('158366264352026NE000013', {
      includeHistorico: true,
    });

    expect(result[0]).toMatchObject({
      valorAtual: 36700,
      historico: [
        {
          data: '24/02/2026',
          operacao: 'INCLUSAO',
          quantidade: 1,
          valorUnitario: 14200,
          valorTotal: 14200,
        },
      ],
    });
  });

  it('preserva itens ja recebidos quando uma pagina complementar falha', async () => {
    const { transparenciaService } = await import('@/services/transparencia');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('pagina=1')) {
        return {
          ok: true,
          json: async () => [
            {
              codigoItemEmpenho: '158366264352026NE000013',
              descricao: 'Recurso para pagamento de auxilio transporte.',
              codigoSubelemento: '01',
              descricaoSubelemento: 'BOLSAS DE ESTUDO NO PAIS',
              valorAtual: '36.700,00',
              sequencial: 1,
            },
          ],
        } as Response;
      }

      return {
        ok: false,
        status: 500,
        json: async () => ({}),
      } as Response;
    });

    const result = await transparenciaService.getItensEmpenhoPortal('2026NE000013');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      descricao: 'Recurso para pagamento de auxilio transporte.',
      valorAtual: 36700,
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
