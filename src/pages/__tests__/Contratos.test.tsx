import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import Contratos from '@/pages/Contratos';
import { useData } from '@/contexts/DataContext';
import { contratosApiService } from '@/services/contratosApi';

vi.mock('@/contexts/DataContext', () => ({
  useData: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isSuperAdmin: false }),
}));

vi.mock('@/components/HeaderParts', () => ({
  HeaderActions: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/modals/ContratosSyncDialog', () => ({
  ContratosSyncDialog: () => null,
}));

vi.mock('@/services/contratosApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/contratosApi')>();
  return {
    ...actual,
    contratosApiService: {
      getContratosApi: vi.fn(),
      getEmpenhosApi: vi.fn(),
      getHistoricosApi: vi.fn(),
      getLastSyncRun: vi.fn(),
      getContratoApiDetails: vi.fn(),
    },
  };
});

const mockedUseData = vi.mocked(useData);
const mockedContratosApiService = vi.mocked(contratosApiService);

describe('Contratos', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedUseData.mockReturnValue({
      atividades: [],
      empenhos: [],
      descentralizacoes: [],
      contratos: [
        {
          id: 'contrato-local-1',
          numero: '62/2018',
          contratada: 'Fornecedor Teste',
          valor: 201994.8,
          data_inicio: new Date('2023-01-01'),
          data_termino: new Date('2023-12-31'),
          created_at: new Date('2023-01-01'),
          updated_at: new Date('2023-01-01'),
        },
      ],
      contratosEmpenhos: [],
      creditosDisponiveis: [],
      isLoading: false,
      addAtividade: vi.fn(),
      updateAtividade: vi.fn(),
      deleteAtividade: vi.fn(),
      addEmpenho: vi.fn(),
      updateEmpenho: vi.fn(),
      deleteEmpenho: vi.fn(),
      addDescentralizacao: vi.fn(),
      updateDescentralizacao: vi.fn(),
      deleteDescentralizacao: vi.fn(),
      getResumoOrcamentario: vi.fn(),
      getTotalPlanejado: vi.fn(),
      getTotalEmpenhado: vi.fn(),
      getTotalDescentralizado: vi.fn(),
      getADescentralizar: vi.fn(),
      getSaldoTotal: vi.fn(),
      refreshData: vi.fn(),
    });

    mockedContratosApiService.getContratosApi.mockResolvedValue([
      {
        id: 'contrato-api-1',
        api_contrato_id: 22024,
        numero: '00062/2018',
        fornecedor_nome: 'Fornecedor Teste',
        unidade_codigo: '158366',
        unidade_nome: 'INST.FED. DO RN/CAMPUS CURRAIS NOVOS',
        unidade_origem_codigo: '158155',
        unidade_origem_nome: 'INST.FED.DE EDUC.,CIENC.E TEC.DO RN',
        objeto: 'Objeto',
        processo: '23000.000000/2023-00',
        vigencia_inicio: '2023-01-01',
        vigencia_fim: '2023-12-31',
        valor_global: 201994.8,
        valor_acumulado: 201994.8,
        situacao: true,
        updated_at: '2026-04-14T00:00:00Z',
      },
    ]);
    mockedContratosApiService.getEmpenhosApi.mockResolvedValue([]);
    mockedContratosApiService.getHistoricosApi.mockResolvedValue([]);
    mockedContratosApiService.getLastSyncRun.mockResolvedValue(null);
    mockedContratosApiService.getContratoApiDetails.mockResolvedValue({
      historico: [
        {
          id: 'historico-1',
          contrato_api_id: 'contrato-api-1',
          api_historico_id: 314882,
          numero: '00158/2021',
          tipo: 'Contrato',
          qualificacao_termo: [],
          observacao: 'Assinatura inicial',
          ug: '158366',
          codigo_unidade_origem: '158155',
          nome_unidade_origem: 'INST.FED.DE EDUC.,CIENC.E TEC.DO RN',
          data_assinatura: '2021-12-10',
          data_publicacao: '2021-12-11',
          vigencia_inicio: '2021-12-10',
          vigencia_fim: '2022-12-10',
          valor_inicial: 108000,
          valor_global: 108000,
          num_parcelas: 12,
          valor_parcela: 9000,
          novo_valor_global: 0,
          novo_num_parcelas: null,
          novo_valor_parcela: 0,
          data_inicio_novo_valor: null,
          retroativo: 'Nao',
          retroativo_valor: 0,
          situacao_contrato: 'Ativo',
        },
      ],
      empenhos: [],
      itens: [
        {
          id: 'item-1',
          contrato_api_id: 'contrato-api-1',
          api_item_id: 325154,
          catmatseritem_id: 'PRESTAÇÃO DE SERVIÇOS DE APOIO ADMINISTRATIVO',
          descricao_complementar: null,
          quantidade: 1,
          valor_unitario: 16832.9,
          valor_total: 201994.8,
          numero_item_compra: '00008',
        },
      ],
      faturas: [
        {
          id: 'fatura-1',
          contrato_api_id: 'contrato-api-1',
          api_fatura_id: 188319,
          numero_instrumento_cobranca: '48161',
          situacao: 'Pago',
          valor_bruto: 12368.06,
          valor_liquido: 12368.06,
          data_emissao: '2023-05-08',
          data_pagamento: null,
        },
      ],
      faturaItens: [
        {
          id: 'fatura-item-1',
          contrato_api_id: 'contrato-api-1',
          contrato_api_fatura_id: 'fatura-1',
          contrato_api_item_id: 'item-1',
          api_item_id: 325154,
          quantidade_faturado: 1,
          valor_unitario_faturado: 12368.06,
          valor_total_faturado: 12368.06,
        },
      ],
      faturaEmpenhos: [],
    });
  });

  it('exibe detalhes da API quando o contrato local casa por numero normalizado', async () => {
    render(<Contratos />);

    const detailsButton = await screen.findByRole('button', { name: /Detalhes/i });
    fireEvent.click(detailsButton);

    await waitFor(() => {
      expect(mockedContratosApiService.getContratoApiDetails).toHaveBeenCalledWith('contrato-api-1');
    });

    expect(await screen.findByText('Contrato 00062/2018')).toBeInTheDocument();
    expect(screen.getAllByText('PRESTAÇÃO DE SERVIÇOS DE APOIO ADMINISTRATIVO').length).toBeGreaterThan(0);
  });
});
