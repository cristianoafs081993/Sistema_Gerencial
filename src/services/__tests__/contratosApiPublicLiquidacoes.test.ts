import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  functionsInvokeMock: vi.fn(),
  supabaseFromMock: vi.fn(),
}));

const { fetchMock, functionsInvokeMock, supabaseFromMock } = mocks;

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: supabaseFromMock,
    functions: {
      invoke: functionsInvokeMock,
    },
  },
}));

vi.stubGlobal('fetch', fetchMock);

async function loadService() {
  vi.resetModules();
  const mod = await import('@/services/contratosApi');
  return mod.contratosApiService;
}

function mockFetchMap(map: Record<string, unknown>) {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (!(url in map)) {
      throw new Error(`URL nao mockada: ${url}`);
    }

    return {
      ok: true,
      json: async () => map[url],
    } as Response;
  });
}

function mockSupabaseCache(status: Record<string, unknown> | null, rows: unknown[] = []) {
  supabaseFromMock.mockImplementation((table: string) => {
    if (table === 'contratos_api_empenho_liquidacoes_cache_status') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: status, error: null }),
          }),
        }),
      };
    }

    if (table === 'contratos_api_empenho_liquidacoes_cache') {
      return {
        select: () => ({
          eq: () => ({
            order: async () => ({ data: rows, error: null }),
          }),
        }),
      };
    }

    throw new Error(`Tabela Supabase inesperada: ${table}`);
  });
}

function mockSupabaseCacheStatusError(error: Record<string, unknown>) {
  supabaseFromMock.mockImplementation((table: string) => {
    if (table === 'contratos_api_empenho_liquidacoes_cache_status') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error }),
          }),
        }),
      };
    }

    throw new Error(`Tabela Supabase inesperada: ${table}`);
  });
}

describe('contratosApiService.getLiquidacoesPublicasPorEmpenho', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    functionsInvokeMock.mockReset();
    functionsInvokeMock.mockResolvedValue({ data: null, error: null });
    supabaseFromMock.mockReset();
    supabaseFromMock.mockImplementation(() => {
      throw new Error('Supabase nao deve ser usado na descoberta publica de liquidacoes com UG explicita.');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retorna liquidacoes do cache fresco sem varrer a API publica', async () => {
    const contratosApiService = await loadService();

    mockSupabaseCache(
      {
        empenho_lookup_key: '2026NE000010',
        empenho_numero: '2026NE000010',
        status: 'found',
        rows_count: 1,
        fetched_at: '2026-04-24T10:00:00.000Z',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        error_message: null,
      },
      [
        {
          id: 'cache-1',
          empenho_lookup_key: '2026NE000010',
          empenho_numero: '2026NE000010',
          empenho_numero_api: '2026NE000010',
          unidade_contrato: '158155',
          contrato_api_id: 15510,
          contrato_numero: '00010/2026',
          contrato_objeto: 'Contrato cacheado',
          fatura_id: 1551001,
          numero_instrumento_cobranca: 'NF-10',
          situacao: 'Pago',
          valor_bruto: 2000,
          valor_liquido: 2000,
          data_emissao: '2026-04-10',
          data_vencimento: '2026-04-30',
          data_pagamento: null,
          data_liquidacao: null,
          processo: '23035.000010/2026-01',
          valor_empenho: 2000,
          subelemento: null,
          fetched_at: '2026-04-24T10:00:00.000Z',
        },
      ],
    );

    const result = await contratosApiService.getLiquidacoesPublicasPorEmpenho('2026NE000010');

    expect(result).toEqual([
      expect.objectContaining({
        contrato_api_id: 15510,
        contrato_numero: '00010/2026',
        numero_instrumento_cobranca: 'NF-10',
        empenho_numero: '2026NE000010',
      }),
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(functionsInvokeMock).not.toHaveBeenCalled();
  });

  it('aciona refresh pela Edge Function e retorna linhas quando nao ha cache', async () => {
    const contratosApiService = await loadService();

    mockSupabaseCache(null);
    functionsInvokeMock.mockResolvedValueOnce({
      data: {
        results: [
          {
            status: 'found',
            rowsCount: 1,
            rows: [
              {
                empenho_lookup_key: '2026NE000027',
                empenho_numero: '2026NE000027',
                empenho_numero_api: '2026NE000027',
                unidade_contrato: '158366',
                contrato_api_id: 126528,
                contrato_numero: '00158/2021',
                contrato_objeto: 'SERVICOS DE OUTSOURCING DE IMPRESSAO.',
                fatura_id: 1876697,
                numero_instrumento_cobranca: 'Z57375',
                situacao: 'Siafi Apropriado',
                valor_bruto: 2271,
                valor_liquido: 2271,
                data_emissao: '2026-04-13',
                data_vencimento: '2026-05-06',
                data_pagamento: null,
                data_liquidacao: '2026-04-24',
                processo: '23421.002243/2020-89',
                valor_empenho: 2271,
                subelemento: '16',
                fetched_at: '2026-05-02T10:00:00.000Z',
              },
            ],
          },
        ],
      },
      error: null,
    });

    const result = await contratosApiService.getLiquidacoesPublicasPorEmpenho('2026NE000027');

    expect(result).toEqual([
      expect.objectContaining({
        contrato_api_id: 126528,
        contrato_numero: '00158/2021',
        numero_instrumento_cobranca: 'Z57375',
        empenho_numero: '2026NE000027',
      }),
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(functionsInvokeMock).toHaveBeenCalledWith('refresh-comprasnet-liquidacoes-cache', {
      body: {
        empenhoNumero: '2026NE000027',
        returnRows: true,
        source: 'frontend-cache-miss',
      },
    });
  });

  it('nao aciona refresh no frontend quando as tabelas de cache ainda nao existem', async () => {
    const contratosApiService = await loadService();

    mockSupabaseCacheStatusError({
      status: 404,
      code: 'PGRST205',
      message: "Could not find the table 'public.contratos_api_empenho_liquidacoes_cache_status'",
    });

    const result = await contratosApiService.getLiquidacoesPublicasPorEmpenho('2026NE000001');

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(functionsInvokeMock).not.toHaveBeenCalled();
  });

  it('usa a Edge Function como fallback quando o status publico indica linhas mas a tabela de linhas nao fica visivel por RLS', async () => {
    const contratosApiService = await loadService();

    mockSupabaseCache(
      {
        empenho_lookup_key: '2026NE000010',
        empenho_numero: '2026NE000010',
        status: 'found',
        rows_count: 1,
        fetched_at: '2026-04-28T11:50:00.000Z',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        error_message: null,
      },
      [],
    );
    functionsInvokeMock.mockResolvedValueOnce({
      data: {
        results: [
          {
            status: 'found',
            rowsCount: 1,
            rows: [
              {
                id: 'cache-rls-1',
                empenho_lookup_key: '2026NE000010',
                empenho_numero: '2026NE000010',
                empenho_numero_api: '2026NE000010',
                unidade_contrato: '158155',
                contrato_api_id: 15510,
                contrato_numero: '00010/2026',
                contrato_objeto: 'Contrato por fallback',
                fatura_id: 1551001,
                numero_instrumento_cobranca: 'NF-10',
                situacao: 'Pago',
                valor_bruto: 2000,
                valor_liquido: 2000,
                data_emissao: '2026-04-10',
                data_vencimento: '2026-04-30',
                data_pagamento: null,
                data_liquidacao: null,
                processo: '23035.000010/2026-01',
                valor_empenho: 2000,
                subelemento: null,
                fetched_at: '2026-04-28T11:50:00.000Z',
              },
            ],
          },
        ],
      },
      error: null,
    });

    const result = await contratosApiService.getLiquidacoesPublicasPorEmpenho('2026NE000010');

    expect(result).toEqual([
      expect.objectContaining({
        contrato_api_id: 15510,
        numero_instrumento_cobranca: 'NF-10',
        empenho_numero: '2026NE000010',
      }),
    ]);
    expect(functionsInvokeMock).toHaveBeenCalledWith('refresh-comprasnet-liquidacoes-cache', {
      body: {
        empenhoNumero: '2026NE000010',
        readCacheOnly: true,
        returnRows: true,
        source: 'frontend-cache-read-fallback',
      },
    });
  });

  it('descobre liquidacoes publicas por empenho com match de numero curto e completo', async () => {
    const contratosApiService = await loadService();

    mockFetchMap({
      '/api-contratos/api/contrato/ug/158366': [
        { id: 10, numero: '00001/2025', objeto: 'Contrato A' },
      ],
      '/api-contratos/api/contrato/inativo/ug/158366': [
        { id: 11, numero: '00002/2024', objeto: 'Contrato B' },
      ],
      '/api-contratos/api/contrato/ug/158155': [],
      '/api-contratos/api/contrato/inativo/ug/158155': [],
      '/api-contratos/api/contrato/10/empenhos': [
        { id: 101, numero: '158366264352025NE000342' },
      ],
      '/api-contratos/api/contrato/11/empenhos': [
        { id: 202, numero: '2024NE000111' },
      ],
      '/api-contratos/api/contrato/10/faturas': [
        {
          id: 188319,
          numero: '48161',
          emissao: '2025-05-08',
          vencimento: '2025-06-26',
          valor: '12.368,06',
          valorliquido: '12.000,00',
          situacao: 'Pago',
          processo: '23035.001299/2025-51',
          data_liquidacao: '2025-05-10',
          dados_empenho: [
            {
              id_empenho: 8009682,
              numero_empenho: '2025NE000342',
              valor_empenho: '12.368,06',
              subelemento: '01',
            },
          ],
        },
        {
          id: 188320,
          numero: 'IGNORAR',
          emissao: '2025-05-09',
          vencimento: '2025-06-27',
          valor: '1.000,00',
          valorliquido: '1.000,00',
          situacao: 'Pendente',
          processo: 'nao-vinculado',
          dados_empenho: null,
        },
      ],
    });

    const result = await contratosApiService.getLiquidacoesPublicasPorEmpenho('2025NE000342', '158366');

    expect(result).toEqual([
      expect.objectContaining({
        contrato_api_id: 10,
        contrato_numero: '00001/2025',
        numero_instrumento_cobranca: '48161',
        situacao: 'Pago',
        valor_bruto: 12368.06,
        valor_liquido: 12000,
        data_emissao: '2025-05-08',
        data_vencimento: '2025-06-26',
        data_liquidacao: '2025-05-10',
        processo: '23035.001299/2025-51',
        empenho_numero: '2025NE000342',
        valor_empenho: 12368.06,
        subelemento: '01',
      }),
    ]);

    expect(fetchMock).toHaveBeenCalledWith('/api-contratos/api/contrato/ug/158366');
    expect(fetchMock).toHaveBeenCalledWith('/api-contratos/api/contrato/inativo/ug/158366');
    expect(fetchMock).toHaveBeenCalledWith('/api-contratos/api/contrato/10/empenhos');
    expect(fetchMock).toHaveBeenCalledWith('/api-contratos/api/contrato/10/faturas');
    expect(fetchMock).not.toHaveBeenCalledWith('/api-contratos/api/contrato/11/faturas');
  });

  it('mantem data_liquidacao nula quando o payload publico nao traz o campo', async () => {
    const contratosApiService = await loadService();

    mockFetchMap({
      '/api-contratos/api/contrato/ug/158366': [
        { id: 22, numero: '00062/2018', objeto: 'Contrato sem data de liquidacao' },
      ],
      '/api-contratos/api/contrato/inativo/ug/158366': [],
      '/api-contratos/api/contrato/ug/158155': [],
      '/api-contratos/api/contrato/inativo/ug/158155': [],
      '/api-contratos/api/contrato/22/empenhos': [
        { id: 222, numero: '2021NE000062' },
      ],
      '/api-contratos/api/contrato/22/faturas': [
        {
          id: 188319,
          numero: '48161',
          emissao: '2023-05-08',
          vencimento: '2023-06-26',
          valor: '12.368,06',
          valorliquido: '12.368,06',
          situacao: 'Pago',
          processo: '23035.001299/2021-51',
          dados_empenho: [
            {
              id_empenho: 8009682,
              numero_empenho: '2021NE000062',
              valor_empenho: '12.368,06',
              subelemento: '01',
            },
          ],
        },
      ],
    });

    const [result] = await contratosApiService.getLiquidacoesPublicasPorEmpenho('2021NE000062', '158366');

    expect(result.data_liquidacao).toBeNull();
    expect(result.numero_instrumento_cobranca).toBe('48161');
  });

  it('reaproveita cache em memoria na segunda consulta do mesmo empenho', async () => {
    const contratosApiService = await loadService();

    mockFetchMap({
      '/api-contratos/api/contrato/ug/158366': [
        { id: 33, numero: '00033/2025', objeto: 'Contrato cacheado' },
      ],
      '/api-contratos/api/contrato/inativo/ug/158366': [],
      '/api-contratos/api/contrato/ug/158155': [],
      '/api-contratos/api/contrato/inativo/ug/158155': [],
      '/api-contratos/api/contrato/33/empenhos': [
        { id: 333, numero: '2025NE000500' },
      ],
      '/api-contratos/api/contrato/33/faturas': [
        {
          id: 3331,
          numero: 'FAT-500',
          emissao: '2025-04-01',
          vencimento: '2025-04-20',
          valor: '500,00',
          valorliquido: '500,00',
          situacao: 'Pago',
          processo: '23035.000500/2025-01',
          dados_empenho: [
            {
              numero_empenho: '2025NE000500',
              valor_empenho: '500,00',
            },
          ],
        },
      ],
    });

    const firstResult = await contratosApiService.getLiquidacoesPublicasPorEmpenho('2025NE000500', '158366');
    const secondResult = await contratosApiService.getLiquidacoesPublicasPorEmpenho('2025NE000500', '158366');

    expect(firstResult).toEqual(secondResult);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('tambem procura contratos publicos gerenciados pela UG da reitoria', async () => {
    const contratosApiService = await loadService();

    mockFetchMap({
      '/api-contratos/api/contrato/ug/158366': [],
      '/api-contratos/api/contrato/inativo/ug/158366': [],
      '/api-contratos/api/contrato/ug/158155': [
        { id: 15510, numero: '00010/2026', objeto: 'Contrato gerenciado pela reitoria' },
      ],
      '/api-contratos/api/contrato/inativo/ug/158155': [],
      '/api-contratos/api/contrato/15510/empenhos': [
        { id: 155101, numero: '2026NE000010' },
      ],
      '/api-contratos/api/contrato/15510/faturas': [
        {
          id: 1551001,
          numero: 'NF-10',
          emissao: '2026-04-10',
          vencimento: '2026-04-30',
          valor: '2.000,00',
          valorliquido: '2.000,00',
          situacao: 'Pago',
          processo: '23035.000010/2026-01',
          contratante: '158366 - IFRN/CAMPUS C.NOVOS',
          dados_empenho: [
            {
              numero_empenho: '2026NE000010',
              valor_empenho: '2.000,00',
            },
          ],
        },
        {
          id: 1551002,
          numero: 'NF-OUTRO-CAMPUS',
          emissao: '2026-04-11',
          vencimento: '2026-04-30',
          valor: '3.000,00',
          valorliquido: '3.000,00',
          situacao: 'Pago',
          processo: '23035.000011/2026-01',
          contratante: '158999 - IFRN/OUTRO CAMPUS',
          dados_empenho: [
            {
              numero_empenho: '2026NE000010',
              valor_empenho: '3.000,00',
            },
          ],
        },
      ],
    });

    const result = await contratosApiService.getLiquidacoesPublicasPorEmpenho('2026NE000010', '158155');

    expect(result).toEqual([
      expect.objectContaining({
        contrato_api_id: 15510,
        contrato_numero: '00010/2026',
        numero_instrumento_cobranca: 'NF-10',
        empenho_numero: '2026NE000010',
      }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.numero_instrumento_cobranca).not.toBe('NF-OUTRO-CAMPUS');
    expect(fetchMock).toHaveBeenCalledWith('/api-contratos/api/contrato/ug/158155');
    expect(fetchMock).toHaveBeenCalledWith('/api-contratos/api/contrato/15510/faturas');
  });
});
