import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const mocks = vi.hoisted(() => ({
  getBySuapId: vi.fn(),
  getAll: vi.fn(),
  getContratos: vi.fn(),
  getContratosEmpenhos: vi.fn(),
  getContratosApi: vi.fn(),
  getEmpenhosApi: vi.fn(),
}));

vi.mock('@/services/suapProcessos', () => ({
  suapProcessosService: { getBySuapId: mocks.getBySuapId },
}));
vi.mock('@/services/empenhos', () => ({ empenhosService: { getAll: mocks.getAll } }));
vi.mock('@/services/contratos', () => ({
  contratosService: {
    getContratos: mocks.getContratos,
    getContratosEmpenhos: mocks.getContratosEmpenhos,
  },
}));
vi.mock('@/services/contratosApi', () => ({
  contratosApiService: {
    getContratosApi: mocks.getContratosApi,
    getEmpenhosApi: mocks.getEmpenhosApi,
    getLiquidacoesPublicasPorEmpenho: vi.fn(),
  },
}));

import { suapProcessFinanceService } from '@/services/suapProcessFinance';

describe('suapProcessFinanceService com sessao da extensao', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getBySuapId.mockResolvedValue({
      id: 'process-1',
      suapId: '987',
      status: 'success',
      url: 'https://suap.ifrn.edu.br/processo_eletronico/processo/987/',
      beneficiario: 'Fornecedor Alfa',
      cpfCnpj: '12345678000190',
    });
    mocks.getAll.mockResolvedValue([]);
    mocks.getContratos.mockResolvedValue([]);
    mocks.getContratosEmpenhos.mockResolvedValue([]);
    mocks.getContratosApi.mockResolvedValue([]);
    mocks.getEmpenhosApi.mockResolvedValue([]);
  });

  it('propaga o cliente efemero por toda a cadeia financeira', async () => {
    const client = { from: vi.fn(), functions: { invoke: vi.fn() } } as unknown as SupabaseClient;

    await expect(suapProcessFinanceService.getSummaryBySuapId('987', client)).resolves.toMatchObject({ status: 'empty' });

    expect(mocks.getBySuapId).toHaveBeenCalledWith('987', client);
    expect(mocks.getAll).toHaveBeenCalledWith(undefined, client);
    expect(mocks.getContratos).toHaveBeenCalledWith(undefined, client);
    expect(mocks.getContratosEmpenhos).toHaveBeenCalledWith(undefined, client);
    expect(mocks.getContratosApi).toHaveBeenCalledWith(false, undefined, client);
    expect(mocks.getEmpenhosApi).toHaveBeenCalledWith([], undefined, client);
  });
});
