import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useData } from '@/contexts/DataContext';
import Contratos from '@/pages/Contratos';
import { contratosApiService } from '@/services/contratosApi';
import type { Empenho } from '@/types';

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

const makeEmpenho = (overrides: Partial<Empenho>): Empenho => ({
  id: 'empenho-local-rap',
  numero: '2023NE000777',
  descricao: 'Empenho RAP',
  valor: 1000,
  dimensao: 'Administracao',
  componenteFuncional: 'Contratos',
  origemRecurso: 'Tesouro',
  naturezaDespesa: '339039',
  planoInterno: 'PI',
  valorLiquidado: 0,
  valorPago: 0,
  tipo: 'rap',
  rapInscrito: 100,
  rapALiquidar: 100,
  rapPago: 60,
  saldoRapOficial: 40,
  dataEmpenho: new Date('2023-01-10'),
  status: 'pendente',
  createdAt: new Date('2023-01-10'),
  updatedAt: new Date('2023-01-10'),
  ...overrides,
});

describe('Contratos regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedUseData.mockReturnValue({
      atividades: [],
      empenhos: [makeEmpenho({})],
      descentralizacoes: [],
      contratos: [
        {
          id: 'contrato-local-1',
          numero: '62/2018',
          contratada: 'Fornecedor Teste',
          cnpj: '00.000.000/0001-00',
          valor: 201994.8,
          data_inicio: new Date('2023-01-01'),
          data_termino: new Date('2023-12-31'),
          created_at: new Date('2023-01-01'),
          updated_at: new Date('2023-01-01'),
        },
        {
          id: 'contrato-local-2',
          numero: '123/2024',
          contratada: 'Fornecedor sem API',
          cnpj: '11.222.333/0001-44',
          valor: 5000,
          data_inicio: new Date('2024-01-01'),
          data_termino: new Date('2026-12-31'),
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
        },
        {
          id: 'contrato-ignorado',
          numero: '00089/2016',
          contratada: 'Caern legado',
          valor: 7000,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
        },
      ],
      contratosEmpenhos: [
        {
          id: 'link-local-1',
          contrato_id: 'contrato-local-2',
          empenho_id: 'empenho-local-rap',
          created_at: new Date('2024-01-01'),
        },
      ],
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
        valor_acumulado: 250000,
        situacao: true,
        updated_at: '2026-04-14T00:00:00Z',
      },
    ]);
    mockedContratosApiService.getEmpenhosApi.mockResolvedValue([
      {
        id: 'api-empenho-1',
        contrato_api_id: 'contrato-api-1',
        api_empenho_id: 12819022,
        numero: '2024NE000319',
        unidade_gestora: '158366',
        gestao: '26435',
        data_emissao: '2024-12-19',
        credor: 'Fornecedor Teste',
        fonte_recurso: '1000000000',
        plano_interno: 'PI123',
        natureza_despesa: '339039',
        valor_empenhado: 11732.4,
        valor_a_liquidar: 9033.11,
        valor_liquidado: 1000,
        valor_pago: 2699.29,
        rp_inscrito: 9033.11,
        rp_a_pagar: 8500,
      },
    ]);
    mockedContratosApiService.getHistoricosApi.mockResolvedValue([
      {
        id: 'historico-lista-1',
        contrato_api_id: 'contrato-api-1',
        api_historico_id: 314882,
        numero: '00153/2024',
        tipo: 'Contrato',
        qualificacao_termo: [],
        observacao: 'Assinatura inicial',
        ug: '158366',
        codigo_unidade_origem: '158155',
        nome_unidade_origem: 'INST.FED.DE EDUC.,CIENC.E TEC.DO RN',
        data_assinatura: '2024-08-26',
        data_publicacao: '2024-08-27',
        vigencia_inicio: '2024-09-02',
        vigencia_fim: '2026-09-02',
        valor_inicial: 1528056,
        valor_global: 1528056,
        num_parcelas: 24,
        valor_parcela: 63669,
        novo_valor_global: 0,
        novo_num_parcelas: null,
        novo_valor_parcela: 0,
        data_inicio_novo_valor: null,
        retroativo: 'Nao',
        retroativo_valor: 0,
        situacao_contrato: 'Ativo',
      },
    ]);
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
          catmatseritem_id: 'PRESTACAO DE SERVICOS DE APOIO ADMINISTRATIVO',
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
        {
          id: 'fatura-sem-item',
          contrato_api_id: 'contrato-api-1',
          api_fatura_id: 188320,
          numero_instrumento_cobranca: '48162',
          situacao: 'Em analise',
          valor_bruto: 500,
          valor_liquido: 500,
          data_emissao: '2023-06-08',
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

  it('mantem lista local, busca, ordenacao, legado ignorado e detalhe somente com match API', async () => {
    render(<Contratos />);

    expect(await screen.findByText('62/2018')).toBeInTheDocument();
    expect(screen.getByText('123/2024')).toBeInTheDocument();
    expect(screen.queryByText('00089/2016')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Detalhes/i })).toHaveLength(1);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '11.222.333' } });
    expect(screen.getByText('Fornecedor sem API')).toBeInTheDocument();
    expect(screen.queryByText('Fornecedor Teste')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Contrato'));
    await waitFor(() => {
      const numbers = screen.getAllByText(/^(62\/2018|123\/2024)$/).map((item) => item.textContent);
      expect(numbers).toEqual(['123/2024', '62/2018']);
    });
  });

  it('usa empenhado original da API e fallback local sem trocar saldo RAP', async () => {
    render(<Contratos />);

    expect(await screen.findByText('R$ 1.528.056,00')).toBeInTheDocument();
    expect(screen.queryByText('R$ 250.000,00')).not.toBeInTheDocument();
    expect(await screen.findByText('R$ 12.732,40')).toBeInTheDocument();
    expect(screen.getByText('0.8%')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 40,00').length).toBeGreaterThan(0);
    expect(screen.getByText('Origem Reitoria')).toBeInTheDocument();
  });

  it('abre drawer com historico, itens e faturas mantendo grupo sem item', async () => {
    render(<Contratos />);

    fireEvent.click(await screen.findByRole('button', { name: /Detalhes/i }));

    await waitFor(() => {
      expect(mockedContratosApiService.getContratoApiDetails).toHaveBeenCalledWith('contrato-api-1');
    });

    expect(await screen.findByText('Contrato 00062/2018')).toBeInTheDocument();
    expect(screen.getByText('Histórico do contrato')).toBeInTheDocument();
    expect(screen.getByText(/Assinatura - 00158\/2021/i)).toBeInTheDocument();
    expect(screen.getAllByText('PRESTACAO DE SERVICOS DE APOIO ADMINISTRATIVO').length).toBeGreaterThan(0);
    expect(screen.getByText('Sem item vinculado')).toBeInTheDocument();
    expect(screen.getByText('48162')).toBeInTheDocument();
  });
});
