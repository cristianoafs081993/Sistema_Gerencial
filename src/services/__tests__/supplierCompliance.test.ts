import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const maybeSingleMock = vi.fn();
  const insertMock = vi.fn();
  const updateMock = vi.fn();
  const orderMock = vi.fn();

  // Objeto de encadeamento genérico que retorna a si mesmo nos métodos encadeados
  const queryChain: any = {
    select: vi.fn(() => queryChain),
    eq: vi.fn(() => queryChain),
    order: orderMock,
    maybeSingle: maybeSingleMock,
    insert: insertMock,
    update: updateMock,
  };

  const fromMock = vi.fn((table: string) => {
    if (table === 'suppliers') {
      return {
        update: updateMock,
      };
    }
    return queryChain;
  });

  return {
    maybeSingleMock,
    insertMock,
    updateMock,
    orderMock,
    fromMock,
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.fromMock,
  },
}));

import { supplierComplianceService } from '@/services/supplierCompliance';

describe('supplierComplianceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Configurações padrão dos mocks do Supabase
    mocks.maybeSingleMock.mockResolvedValue({ data: null, error: null });
    mocks.insertMock.mockResolvedValue({ data: null, error: null });
    mocks.orderMock.mockResolvedValue({ data: [], error: null });
    
    mocks.updateMock.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    // Mock global fetch para evitar requisições de rede reais durante os testes
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('brasilapi.com.br')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            razao_social: 'EMPRESA TESTE LTDA',
            municipio: 'NATAL',
            uf: 'RN',
            descricao_situacao_cadastral: 'ATIVA'
          })
        });
      }
      if (url.includes('api-transparencia/api-de-dados/pessoa-juridica')) {
        // Se for o CNPJ irregular (que contém '10000000000579' ou '579'), retorna flags de sanção
        const isIrregular = url.includes('10000000000579') || url.includes('579');
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            cnpj: '10000000000579',
            razaoSocial: 'EMPRESA TESTE LTDA',
            sancionadoCEIS: isIrregular,
            sancionadoCNEP: isIrregular,
            sancionadoCEPIM: false,
            sancionadoCEAF: false
          })
        });
      }
      if (
        url.includes('api-transparencia/api-de-dados/ceis') || 
        url.includes('api-transparencia/api-de-dados/cnep') ||
        url.includes('api-transparencia/api-de-dados/ceaf')
      ) {
        // Mock fallback de PF (CPF)
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([])
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({})
      });
    });
    vi.stubGlobal('fetch', mockFetch);
  });

  describe('checkCompliance', () => {
    it('deve marcar fornecedor como REGULAR se CNPJ for regular', async () => {
      // Usamos um CNPJ matematicamente válido que termina em 1 (regular): 10000000000811
      const result = await supplierComplianceService.checkCompliance('supplier-1', '10000000000811');
      
      expect(result.status).toBe('REGULAR');
      expect(result.sancionadoCEIS).toBe(false);
      expect(result.sancionadoCNEP).toBe(false);
      expect(result.sancionadoCEPIM).toBe(false);
      
      // Deve ter tentado atualizar o fornecedor com dados reais da Receita Federal
      expect(mocks.fromMock).toHaveBeenCalledWith('suppliers');
      expect(mocks.updateMock).toHaveBeenCalledWith(expect.objectContaining({
        name: 'EMPRESA TESTE LTDA',
        city: 'NATAL',
        uf: 'RN'
      }));
    });

    it('deve marcar fornecedor como IRREGULAR e anexar sanções se CNPJ terminar em 9', async () => {
      // Usamos um CNPJ matematicamente válido que termina em 9 (irregular): 10000000000579
      const result = await supplierComplianceService.checkCompliance('supplier-2', '10000000000579');
      
      expect(result.status).toBe('IRREGULAR');
      expect(result.sancionadoCEIS).toBe(true);
      expect(result.sancionadoCNEP).toBe(true);
      
      // Deve ter tentado salvar certidões na tabela supplier_certificates
      expect(mocks.fromMock).toHaveBeenCalledWith('supplier_certificates');
      expect(mocks.insertMock).toHaveBeenCalled();
      
      // Deve atualizar o status do fornecedor para IRREGULAR
      expect(mocks.fromMock).toHaveBeenCalledWith('suppliers');
      expect(mocks.updateMock).toHaveBeenCalledWith(expect.objectContaining({
        status_regularidade: 'IRREGULAR'
      }));
    });

    it('deve lançar erro se o CNPJ/CPF for nulo ou vazio', async () => {
      await expect(
        supplierComplianceService.checkCompliance('supplier-3', '')
      ).rejects.toThrow('Fornecedor não possui CNPJ/CPF cadastrado.');
    });

    it('deve lançar erro se o CNPJ for matematicamente inválido', async () => {
      await expect(
        supplierComplianceService.checkCompliance('supplier-4', '12345678000101')
      ).rejects.toThrow('CNPJ inválido (dígitos verificadores incorretos).');
    });

    it('deve lançar erro se o CPF for matematicamente inválido', async () => {
      await expect(
        supplierComplianceService.checkCompliance('supplier-5', '12345678901')
      ).rejects.toThrow('CPF inválido (dígitos verificadores incorretos).');
    });
  });
});
