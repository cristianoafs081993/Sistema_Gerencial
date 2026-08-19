import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AtasRegistroPrecos from '@/pages/AtasRegistroPrecos';
import { atasRegistroPrecosService } from '@/services/atasRegistroPrecos';
import { supabase } from '@/lib/supabase';

vi.mock('@/components/HeaderParts', () => ({
  HeaderActions: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HeaderSubtitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/services/atasRegistroPrecos', () => ({
  atasRegistroPrecosService: {
    list: vi.fn(),
    listItems: vi.fn(),
    listUnidades: vi.fn(),
    getLastSyncRun: vi.fn(),
    sync: vi.fn(),
    syncInternalUasgs: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const mockedService = vi.mocked(atasRegistroPrecosService);
const mockedToast = vi.mocked(toast);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <MemoryRouter initialEntries={['/atas-registro-precos']}>
      <QueryClientProvider client={queryClient}>
        <AtasRegistroPrecos />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const ata = {
  id: 'ata-1',
  ataKey: '158366-0001/2026',
  numeroAta: '0001/2026',
  numeroCompra: '90001',
  anoCompra: 2026,
  modalidadeCodigo: '5',
  modalidadeNome: 'Pregao',
  unidadeGerenciadoraCodigo: '158366',
  unidadeGerenciadoraNome: 'CAMPUS CURRAIS NOVOS',
  objeto: 'Aquisicao de materiais de consumo',
  dataAssinatura: '2026-01-10T00:00:00.000Z',
  dataVigenciaInicial: '2026-01-10T00:00:00.000Z',
  dataVigenciaFinal: '2027-01-10T00:00:00.000Z',
  rawData: {
    valorTotal: 1500,
    statusAta: 'Ata de Registro de Preços',
    numeroControlePncpAta: '10877412000168-1-000001/2026-000001',
    linkAtaPNCP: 'https://pncp.gov.br/app/atas/10877412000168/2026/1/1',
  },
  updatedAt: '2026-05-05T12:00:00.000Z',
  totalItens: 1,
  unidadesParticipantes: ['158366', '158155'],
  totalUnidadesParticipantes: 2,
  unidadesAderentes: ['158375'],
  totalAdesoes: 1,
  itemCorrespondente: null,
};

describe('AtasRegistroPrecos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'contratos_api_itens') {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [] }),
          }),
        } as any;
      }
      return {
        select: () => Promise.resolve({ data: [] }),
      } as any;
    });
    mockedService.list.mockResolvedValue({ rows: [ata], count: 1 });
    mockedService.listItems.mockResolvedValue([{
      id: 'item-1',
      itemKey: 'item-1',
      ataKey: '158366-0001/2026',
      numeroItem: '1',
      codigoItem: '123',
      tipoItem: 'Material',
      descricaoItem: 'Material de consumo',
      fornecedorNome: 'Fornecedor SA',
      fornecedorNi: '00000000000100',
      quantidadeHomologada: 10,
      valorUnitario: 100,
      valorTotal: 1000,
    }]);
    mockedService.listUnidades.mockResolvedValue([{
      id: 'u-1',
      unidadeItemKey: '158366-0001/2026-1-123-00000000000100-158366',
      itemKey: 'item-1',
      ataKey: '158366-0001/2026',
      unidadeCodigo: '158366',
      unidadeNome: 'CAMPUS CURRAIS NOVOS',
      quantidadeAutorizada: 4,
      quantidadeUtilizada: 0,
      saldoQuantidade: 4,
      tipoUnidade: 'GERENCIADORA',
      quantidadeRegistrada: 4,
      saldoRemanejamento: 4,
      numeroItem: '1',
      rawData: {},
    }, {
      id: 'u-2',
      unidadeItemKey: '158366-0001/2026-1-123-00000000000100-158155',
      itemKey: 'item-1',
      ataKey: '158366-0001/2026',
      unidadeCodigo: '158155',
      unidadeNome: 'REITORIA',
      quantidadeAutorizada: 6,
      quantidadeUtilizada: 0,
      saldoQuantidade: 6,
      tipoUnidade: 'PARTICIPANTE',
      quantidadeRegistrada: 6,
      saldoRemanejamento: 6,
      numeroItem: '1',
      rawData: {},
    }]);
    mockedService.getLastSyncRun.mockResolvedValue({
      id: 'run-1',
      startedAt: '2026-05-05T10:00:00.000Z',
      finishedAt: '2026-05-05T10:05:00.000Z',
      status: 'success',
      unidadeCodigos: ['158366'],
      dataInicial: '2025-05-06',
      dataFinal: '2026-05-05',
      totalFetched: 1,
      totalUpserted: 1,
      errorMessage: null,
      details: {},
    });
    mockedService.sync.mockResolvedValue({
      runId: 'run-2',
      status: 'success',
      fetched: 1,
      upserted: 1,
    });
    mockedService.syncInternalUasgs.mockResolvedValue({
      runId: 'run-3',
      status: 'success',
      fetched: 1,
      upserted: 1,
    });
  });

  it('lista atas e abre modal de detalhes', async () => {
    renderPage();

    expect(await screen.findByText('Aquisicao de materiais de consumo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Detalhar/i }));

    expect(await screen.findByText('Material de consumo')).toBeInTheDocument();
    expect(screen.getByText('Fornecedor SA')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 1.500,00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Participantes e Adesões (Lei 14.133/2021)')).toBeInTheDocument();
  });

  it('expande o item ao clicar na linha para exibir detalhes de empenhos vinculados', async () => {
    renderPage();

    expect(await screen.findByText('Aquisicao de materiais de consumo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Detalhar/i }));

    expect(await screen.findByText('Material de consumo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /1 Material de consumo/i }));

    expect(await screen.findByText(/Nenhum empenho vinculado/i)).toBeInTheDocument();
  });

  it('nao associa empenhos de fornecedores ou contratos divergentes da ata', async () => {
    renderPage();

    expect(await screen.findByText('Aquisicao de materiais de consumo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Detalhar/i }));

    expect(await screen.findByText('Material de consumo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /1 Material de consumo/i }));

    expect(await screen.findByText(/Nenhum empenho vinculado/i)).toBeInTheDocument();
    expect(screen.queryByText('LG. ADMINISTRADORA DE SERVICOS LTDA')).not.toBeInTheDocument();
  });

  it('formata valores com casas decimais corretamente sem multiplicar por 10x', async () => {
    mockedService.list.mockResolvedValueOnce({
      rows: [{
        ...ata,
        id: 'ata-gas',
        ataKey: '158366-00002/2026',
        numeroAta: '00002/2026',
        objeto: 'Aquisicao de recarga de gas GLP',
        rawData: {
          valorTotal: 31354.2,
          linkAtaPNCP: 'https://pncp.gov.br',
        },
      }],
      count: 1,
    });
    mockedService.listItems.mockResolvedValue([
      {
        id: 'item-1',
        itemKey: 'item-1',
        ataKey: '158366-00002/2026',
        numeroItem: '00001',
        codigoItem: '461517',
        tipoItem: 'Material',
        descricaoItem: 'Botijao de gas P-13',
        fornecedorNome: 'Zona Oeste Comercio',
        fornecedorNi: '55806684000105',
        quantidadeHomologada: 40,
        valorUnitario: 124.8,
        valorTotal: 4992,
      },
      {
        id: 'item-2',
        itemKey: 'item-2',
        ataKey: '158366-00002/2026',
        numeroItem: '00002',
        codigoItem: '461515',
        tipoItem: 'Material',
        descricaoItem: 'Botijao de gas P-45',
        fornecedorNome: 'Zona Oeste Comercio',
        fornecedorNi: '55806684000105',
        quantidadeHomologada: 60,
        valorUnitario: 439.37,
        valorTotal: 26362.2,
      },
    ]);

    renderPage();

    expect(await screen.findByText('Aquisicao de recarga de gas GLP')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Detalhar/i }));

    // Garante que o modal abriu
    expect(await screen.findByText('Ata 00002/2026')).toBeInTheDocument();

    // Valor Homologado no card deve ser exatamente R$ 31.354,20 e NUNCA R$ 313.542,00
    expect(screen.getAllByText('R$ 31.354,20').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('R$ 313.542,00')).not.toBeInTheDocument();

    // Valores dos itens na tabela (aparecem em Valor Total e Saldo Disponível)
    expect(screen.getAllByText('R$ 4.992,00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('R$ 26.362,20').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('R$ 263.622,00')).not.toBeInTheDocument();
  });

  it('exibe estado claro de carregamento enquanto busca itens ou apura empenhos', async () => {
    // Mock com promise pendente para items
    let resolveItems!: (val: any) => void;
    const itemsPromise = new Promise((resolve) => {
      resolveItems = resolve;
    });
    mockedService.listItems.mockReturnValueOnce(itemsPromise as any);

    renderPage();

    expect(await screen.findByText('Aquisicao de materiais de consumo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Detalhar/i }));

    // Garante que o indicador de carregamento de itens aparece claramente na tela
    expect(await screen.findByText('Carregando itens da ata...')).toBeInTheDocument();

    // Resolve os itens
    resolveItems([]);
    expect(await screen.findByText('Itens detalhados não disponíveis no Dados Abertos')).toBeInTheDocument();
  });

  it('exibe o quadro de distribuicao de cotas por campus/UASG ao expandir o item', async () => {
    renderPage();

    expect(await screen.findByText('Aquisicao de materiais de consumo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Detalhar/i }));

    expect(await screen.findByText('Ata 0001/2026')).toBeInTheDocument();
    expect(await screen.findByText('Material de consumo')).toBeInTheDocument();

    // Clica na linha do item para expandir
    fireEvent.click(screen.getByRole('button', { name: /1 Material de consumo/i }));

    // Garante que o quadro de cotas por campus apareceu com as cotas de cada UASG
    expect(await screen.findByText('Distribuição de Cotas por Campus (UASG)')).toBeInTheDocument();
    expect(screen.getByText('2 unidade(s) cotista(s)')).toBeInTheDocument();
    expect(screen.getAllByText(/Currais Novos/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Reitoria/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('4 un (R$ 400,00)')).toBeInTheDocument();
    expect(screen.getByText('6 un (R$ 600,00)')).toBeInTheDocument();
  });

  it('nao replica empenhos globais de contrato em todos os itens de ata multi-itens', async () => {
    mockedService.listItems.mockResolvedValueOnce([
      {
        id: 'item-1',
        itemKey: 'item-1',
        ataKey: ata.ataKey,
        numeroItem: '00001',
        codigoItem: '111',
        tipoItem: 'Serviço',
        descricaoItem: 'Energia eletrica Currais Novos',
        fornecedorNome: 'MERCATTO COMERCIALIZADORA DE ENERGIA LTDA',
        fornecedorNi: '37028928000194',
        quantidadeHomologada: 62,
        valorUnitario: 379.69,
        valorTotal: 23540.78,
      },
      {
        id: 'item-2',
        itemKey: 'item-2',
        ataKey: ata.ataKey,
        numeroItem: '00002',
        codigoItem: '222',
        tipoItem: 'Serviço',
        descricaoItem: 'Energia eletrica Currais Novos 2026',
        fornecedorNome: 'MERCATTO COMERCIALIZADORA DE ENERGIA LTDA',
        fornecedorNi: '37028928000194',
        quantidadeHomologada: 183,
        valorUnitario: 338.43,
        valorTotal: 61932.69,
      },
    ]);

    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'contratos_api') {
        return {
          select: () => Promise.resolve({
            data: [
              {
                id: 'c-merc',
                api_contrato_id: 101,
                numero: '00285/2025',
                fornecedor_nome: 'MERCATTO COMERCIALIZADORA DE ENERGIA LTDA',
                processo: '23421.001241/2025-87',
                valor_global: 100000,
                raw_data: {
                  licitacao_numero: '0001/2026',
                  informacao_complementar: 'Pregao 0001/2026',
                  fornecedor: { cnpj_cpf_idgener: '37.028.928/0001-94' },
                },
              },
            ],
          }),
        } as any;
      }
      if (table === 'contratos_api_itens') {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [
                { contrato_api_id: 'c-merc', numero_item_compra: '00001' },
                { contrato_api_id: 'c-merc', numero_item_compra: '00002' },
              ],
            }),
          }),
        } as any;
      }
      if (table === 'contratos_api_empenhos') {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [
                {
                  contrato_api_id: 'c-merc',
                  numero: '2025NE000111',
                  valor_empenhado: '10425.08',
                  unidade_gestora: '158366',
                  raw_data: {
                    informacao_complementar: '15815505002852025 - UASG MINUTA: 158366',
                  },
                },
              ],
            }),
          }),
        } as any;
      }
      return {
        select: () => Promise.resolve({ data: [] }),
      } as any;
    });

    renderPage();

    expect(await screen.findByText('Aquisicao de materiais de consumo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Detalhar/i }));

    expect(await screen.findByText('Ata 0001/2026')).toBeInTheDocument();
    expect(await screen.findByText('Energia eletrica Currais Novos')).toBeInTheDocument();

    // Como o empenho do contrato nao tem subitens e o contrato tem 2 itens,
    // ele nao deve ser duplicado como "empenhado" em nenhum dos dois itens especificos
    expect(screen.queryByText('1 empenho(s)')).not.toBeInTheDocument();
    expect(screen.queryByText('2 empenho(s)')).not.toBeInTheDocument();
  });

  it('mostra contagem clara de participantes com hover disponivel', async () => {
    renderPage();

    expect(await screen.findByText('2 participantes')).toBeInTheDocument();
    expect(screen.getByLabelText('Ver 2 participantes')).toBeInTheDocument();
    expect(screen.queryByText('2 unid.')).not.toBeInTheDocument();
  });

  it('destaca item que corresponde a busca na lista', async () => {
    mockedService.list.mockResolvedValueOnce({
      rows: [{
        ...ata,
        itemCorrespondente: {
          id: 'item-match',
          itemKey: 'item-match',
          ataKey: ata.ataKey,
          numeroItem: '2',
          codigoItem: '456',
          tipoItem: 'Material',
          descricaoItem: 'Café torrado',
          fornecedorNome: 'Fornecedor Café SA',
          fornecedorNi: '00000000000199',
          quantidadeHomologada: 20,
          valorUnitario: 32,
          valorTotal: 640,
        },
      }],
      count: 1,
    });

    renderPage();

    expect(await screen.findByText('Encontrado em item')).toBeInTheDocument();
    expect(screen.getByText('Item 2: Café torrado')).toBeInTheDocument();
    expect(screen.getByText('Fornecedor Café SA')).toBeInTheDocument();
  });

  it('indica quando itens ainda nao foram carregados para pesquisa', async () => {
    mockedService.list.mockResolvedValueOnce({
      rows: [{ ...ata, totalItens: 0 }],
      count: 1,
    });

    renderPage();

    expect(await screen.findByText('Itens não carregados')).toBeInTheDocument();
  });

  it('atualiza detalhes de uma ata especifica sob demanda', async () => {
    mockedService.listItems.mockResolvedValueOnce([]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Detalhar/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Atualizar detalhes/i }));

    await waitFor(() => {
      expect(mockedService.sync).toHaveBeenCalledWith(expect.objectContaining({
        unidadeCodigos: ['158366'],
        dataInicial: '2026-01-10',
        dataFinal: '2026-01-10',
        numeroAta: '0001/2026',
        includeDetalhes: true,
        source: 'frontend-detail',
      }));
    });
  });

  it('sincroniza a UASG digitada no periodo informado', async () => {
    renderPage();

    fireEvent.change(await screen.findByLabelText('UASG'), { target: { value: '158375' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar ARP/i }));

    await waitFor(() => {
      expect(mockedService.sync).toHaveBeenCalledWith(expect.objectContaining({
        unidadeCodigos: ['158375'],
        includeDetalhes: false,
        source: 'frontend-search',
      }));
    });
  });

  it('usa o cache IFRN com participantes quando o vinculo selecionado e participante', async () => {
    renderPage();

    await screen.findByText('Aquisicao de materiais de consumo');
    fireEvent.click(screen.getAllByRole('combobox')[0]);
    fireEvent.click(await screen.findByRole('option', { name: /Participante/i }));
    fireEvent.click(screen.getByRole('button', { name: /Buscar ARP/i }));

    await waitFor(() => {
      expect(mockedService.syncInternalUasgs).toHaveBeenCalledWith(expect.objectContaining({
        includeParticipantes: true,
        source: 'frontend-participante-cache',
      }));
    });
    expect(mockedService.sync).not.toHaveBeenCalled();
  });

  it('usa o cache IFRN com a UASG alvo quando o vinculo selecionado e aderente', async () => {
    renderPage();

    await screen.findByText('Aquisicao de materiais de consumo');
    fireEvent.click(screen.getAllByRole('combobox')[0]);
    fireEvent.click(await screen.findByRole('option', { name: /Aderente/i }));
    fireEvent.click(screen.getByRole('button', { name: /Buscar ARP/i }));

    await waitFor(() => {
      expect(mockedService.syncInternalUasgs).toHaveBeenCalledWith(expect.objectContaining({
        includeAdesoes: true,
        adesaoUnidadeCodigos: ['158366'],
        source: 'frontend-aderente-cache',
      }));
    });
    expect(mockedService.sync).not.toHaveBeenCalled();
  });

  it('trata indisponibilidade do Compras.gov.br como aviso operacional', async () => {
    mockedService.sync.mockResolvedValueOnce({
      runId: 'run-error',
      status: 'error',
      fetched: 0,
      upserted: 0,
      errors: [{
        scope: '158366:atas',
        message: 'API 400: Could not open JPA EntityManager for transaction',
      }],
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Buscar ARP/i }));

    await waitFor(() => {
      expect(mockedToast.warning).toHaveBeenCalledWith(
        'Compras.gov.br não concluiu a consulta agora (1 escopo(s) com falha). A lista permanece com dados já materializados.',
      );
    });
    await waitFor(() => {
      expect(mockedService.list.mock.calls.length).toBeGreaterThan(1);
    });
    expect(mockedToast.error).not.toHaveBeenCalled();
  });

  it('normaliza erro legado da API de ARP sem expor a URL tecnica', async () => {
    mockedService.sync.mockRejectedValueOnce(new Error(
      'Falha ao sincronizar ARP (158366:atas): API 400 em https://dadosabertos.compras.gov.br/modulo-arp/1_consultarARP: Could not open JPA EntityManager for transaction',
    ));

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Buscar ARP/i }));

    await waitFor(() => {
      expect(mockedToast.warning).toHaveBeenCalledWith(
        'Compras.gov.br não concluiu a consulta agora. A lista permanece com dados já materializados.',
      );
    });
    expect(mockedToast.error).not.toHaveBeenCalled();
  });

  it('normaliza falha de rede ao chamar a edge function', async () => {
    mockedService.sync.mockRejectedValueOnce(new Error('Failed to fetch'));

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Buscar ARP/i }));

    await waitFor(() => {
      expect(mockedToast.warning).toHaveBeenCalledWith(
        'Não foi possível conectar ao Supabase agora. Verifique a conexão e tente novamente.',
      );
    });
    expect(mockedToast.error).not.toHaveBeenCalled();
  });

  it('normaliza timeout da edge function como aviso de conexao', async () => {
    mockedService.sync.mockRejectedValueOnce(new Error('FunctionsHttpError: 504 Gateway Timeout'));

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Buscar ARP/i }));

    await waitFor(() => {
      expect(mockedToast.warning).toHaveBeenCalledWith(
        'Não foi possível conectar ao Supabase agora. Verifique a conexão e tente novamente.',
      );
    });
    expect(mockedToast.error).not.toHaveBeenCalled();
  });

  it('sincroniza o catalogo interno de UASGs IFRN', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Sincronizar UASGs IFRN/i }));

    await waitFor(() => {
      expect(mockedService.syncInternalUasgs).toHaveBeenCalledWith(expect.objectContaining({
        source: 'frontend-ifrn-cache',
      }));
    });
  });

  it('continua o lote IFRN quando uma UASG falha na sincronizacao', async () => {
    mockedService.syncInternalUasgs.mockResolvedValueOnce({
      runId: '',
      status: 'partial_success',
      fetched: 1,
      upserted: 1,
      errors: [{
        scope: '158368:invoke',
        message: 'FunctionsHttpError: 504 Gateway Timeout',
      }],
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Sincronizar UASGs IFRN/i }));

    await waitFor(() => {
      expect(mockedToast.warning).toHaveBeenCalledWith(
        'Sincronização parcial: 1 registro(s) materializado(s).',
      );
    });
  });
});
