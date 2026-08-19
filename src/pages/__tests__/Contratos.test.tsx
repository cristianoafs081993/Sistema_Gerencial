import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import Contratos from '@/pages/Contratos';
import { useData } from '@/contexts/DataContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { contratosApiService } from '@/services/contratosApi';
import { useUserFavorites } from '@/services/userFavorites';

const authState = vi.hoisted(() => ({ isSuperAdmin: false }));

vi.mock('@/contexts/DataContext', () => ({
  useData: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isSuperAdmin: authState.isSuperAdmin }),
}));

vi.mock('@/services/userFavorites', () => ({
  useUserFavorites: vi.fn(),
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
      getFaturasApi: vi.fn(),
    },
  };
});

const mockedUseData = vi.mocked(useData);
const mockedContratosApiService = vi.mocked(contratosApiService);
const mockedUseUserFavorites = vi.mocked(useUserFavorites);

const renderContratos = () =>
  render(
    <TooltipProvider>
      <Contratos />
    </TooltipProvider>,
  );

describe('Contratos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.isSuperAdmin = false;

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
        {
          id: 'contrato-local-2',
          numero: '15/2026',
          contratada: 'Fornecedor Comum',
          valor: 50000,
          data_inicio: new Date('2026-01-01'),
          data_termino: new Date('2026-12-31'),
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-01'),
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
        situacao_derivada: true,
        vigencia_inicio_derivada: '2023-01-01',
        vigencia_fim_derivada: '2026-12-31',
        updated_at: '2026-04-14T00:00:00Z',
      },
      {
        id: 'contrato-api-2',
        api_contrato_id: 22025,
        numero: '00015/2026',
        fornecedor_nome: 'Fornecedor Comum',
        unidade_codigo: '158366',
        unidade_nome: 'INST.FED. DO RN/CAMPUS CURRAIS NOVOS',
        unidade_origem_codigo: '158366',
        unidade_origem_nome: 'INST.FED. DO RN/CAMPUS CURRAIS NOVOS',
        objeto: 'Objeto',
        processo: '23000.000001/2026-00',
        vigencia_inicio: '2026-01-01',
        vigencia_fim: '2026-12-31',
        valor_global: 50000,
        valor_acumulado: 50000,
        situacao: true,
        situacao_derivada: true,
        vigencia_inicio_derivada: '2026-01-01',
        vigencia_fim_derivada: '2026-12-31',
        updated_at: '2026-04-14T00:00:00Z',
      },
    ]);
    mockedContratosApiService.getEmpenhosApi.mockResolvedValue([]);
    mockedContratosApiService.getHistoricosApi.mockResolvedValue([]);
    mockedContratosApiService.getFaturasApi.mockResolvedValue([]);
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

    mockedUseUserFavorites.mockReturnValue({
      favorites: [],
      favoriteIdsByType: {
        empenho: new Set(),
        contrato: new Set(['contrato-local-1']),
      },
      isLoading: false,
      isPending: false,
      isFavorite: (entityType, entityId) => entityType === 'contrato' && entityId === 'contrato-local-1',
      toggleFavorite: vi.fn(),
    });
  });

  it('exibe detalhes da API quando o contrato local casa por numero normalizado', async () => {
    renderContratos();

    const row = (await screen.findByText('62/2018')).closest('tr');
    expect(row).not.toBeNull();
    const detailsButton = within(row as HTMLElement).getByRole('button', { name: /Detalhes/i });
    fireEvent.click(detailsButton);

    await waitFor(() => {
      expect(mockedContratosApiService.getContratoApiDetails).toHaveBeenCalledWith('contrato-api-1');
    });

    expect(await screen.findByText('Contrato 00062/2018')).toBeInTheDocument();

    const itensSection = screen.getByRole('button', { name: /Itens/i });
    fireEvent.click(itensSection);

    expect(screen.getAllByText('PRESTAÇÃO DE SERVIÇOS DE APOIO ADMINISTRATIVO').length).toBeGreaterThan(0);
  });

  it('ordena inicialmente por inicio de vigencia mais recente (decrescente)', async () => {
    renderContratos();

    await screen.findByText('15/2026');
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    // rows[0] is table header; rows[1] is 15/2026 (vigencia 2026); rows[2] is 62/2018 (vigencia 2023)
    const dataRows = rows.slice(1);
    expect(within(dataRows[0]).getByText('15/2026')).toBeInTheDocument();
    expect(within(dataRows[1]).getByText('62/2018')).toBeInTheDocument();
  });

  it('alterna ordenacao ao clicar no cabecalho de Vigencia', async () => {
    renderContratos();

    await screen.findByText('15/2026');
    const vigenciaHeader = screen.getByRole('columnheader', { name: /Vigência/i });

    // Initial state: desc (15/2026 first, 62/2018 second)
    let rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('15/2026')).toBeInTheDocument();
    expect(within(rows[1]).getByText('62/2018')).toBeInTheDocument();

    // Click 1: toggle to asc (62/2018 first, 15/2026 second)
    fireEvent.click(vigenciaHeader);
    rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('62/2018')).toBeInTheDocument();
    expect(within(rows[1]).getByText('15/2026')).toBeInTheDocument();

    // Click 2: toggle back to desc (15/2026 first, 62/2018 second)
    fireEvent.click(vigenciaHeader);
    rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('15/2026')).toBeInTheDocument();
    expect(within(rows[1]).getByText('62/2018')).toBeInTheDocument();
  });

  it('filtra contratos favoritos sem remover o acesso aos detalhes da API', async () => {
    renderContratos();

    expect(await screen.findByText('62/2018')).toBeInTheDocument();
    expect(screen.getByText('15/2026')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Favoritos$/i }));

    expect(screen.getByText('62/2018')).toBeInTheDocument();
    expect(screen.queryByText('15/2026')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Detalhes/i })).toBeInTheDocument();
  });

  it('exibe status da ultima sincronizacao para superadmin', async () => {
    authState.isSuperAdmin = true;
    mockedContratosApiService.getLastSyncRun.mockResolvedValue({
      id: 'sync-run-1',
      unidade_codigo: '158366',
      started_at: '2026-05-02T06:00:00Z',
      finished_at: '2026-05-02T06:03:00Z',
      status: 'success',
      contratos_ativos: 6,
      contratos_inativos: 4,
      contratos_upserted: 10,
      empenhos_upserted: 2,
      faturas_upserted: 1,
      error_message: null,
      details: null,
    });

    renderContratos();

    expect(await screen.findByText(/Ultima sincronizacao:/i)).toHaveTextContent('sucesso');
  });
});

