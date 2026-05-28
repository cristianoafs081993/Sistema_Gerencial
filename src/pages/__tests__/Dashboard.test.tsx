import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import Dashboard, { buildContractExpenseAggregation, buildContractProjectionBullets } from '@/pages/Dashboard';
import { useData } from '@/contexts/DataContext';

vi.mock('@/contexts/DataContext', () => ({
  useData: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('@/components/HeaderParts', () => ({
  HeaderActions: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/dashboard/DashboardFiltersSheet', () => ({
  DashboardFiltersSheet: ({
    onFilterDimensaoChange,
    onDateStartChange,
    onDateEndChange,
    onClearFilters,
  }: {
    onFilterDimensaoChange: (value: string) => void;
    onDateStartChange: (value: string) => void;
    onDateEndChange: (value: string) => void;
    onClearFilters: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => onFilterDimensaoChange('EN')}>
        filter-en
      </button>
      <button type="button" onClick={() => onDateStartChange('2025-01-01')}>
        filter-start-2025
      </button>
      <button type="button" onClick={() => onDateEndChange('2025-12-31')}>
        filter-end-2025
      </button>
      <button type="button" onClick={onClearFilters}>
        clear-filters
      </button>
    </div>
  ),
}));

vi.mock('@/components/dashboard/DashboardCurrentTab', () => ({
  DashboardCurrentTab: ({
    filteredData,
    totalPlanejado,
    totalDescentralizado,
    totalLiquidado,
    totalPago,
    dadosMensais,
    activeBudgetDimension,
    onSelectBudgetDimension,
  }: {
    filteredData: { empenhosCorrente: unknown[]; empenhosRap: unknown[] };
    totalPlanejado: number;
    totalDescentralizado: number;
    totalLiquidado: number;
    totalPago: number;
    dadosMensais: Array<{ name: string; planejado: number; empenhado: number; liquidado: number }>;
    activeBudgetDimension: string | null;
    onSelectBudgetDimension: (value?: string | null) => void;
  }) => (
    <div data-testid="current-tab">
      <span data-testid="current-planejado">{totalPlanejado}</span>
      <span data-testid="current-descentralizado">{totalDescentralizado}</span>
      <span data-testid="current-liquidado">{totalLiquidado}</span>
      <span data-testid="current-pago">{totalPago}</span>
      <span data-testid="current-mensal-labels">{dadosMensais.map((item) => item.name).join(',')}</span>
      <span data-testid="current-mensal-planejado">{dadosMensais.map((item) => item.planejado).join(',')}</span>
      <span data-testid="current-mensal-empenhado">{dadosMensais.map((item) => item.empenhado).join(',')}</span>
      <span data-testid="current-mensal-liquidado">{dadosMensais.map((item) => item.liquidado).join(',')}</span>
      <span data-testid="current-empenhos-corrente">{filteredData.empenhosCorrente.length}</span>
      <span data-testid="current-empenhos-rap">{filteredData.empenhosRap.length}</span>
      <span data-testid="active-budget-dimension">{activeBudgetDimension ?? 'none'}</span>
      <button type="button" onClick={() => onSelectBudgetDimension('EN')}>
        select-budget-en
      </button>
    </div>
  ),
}));

vi.mock('@/components/dashboard/DashboardContractExecutionTab', () => ({
  DashboardContractExecutionTab: ({
    contractExpenseData,
    contractExpenseOptions,
    contractExpenseSeries,
    contractProjectionBullets,
    selectedContractExpenseIds,
    onToggleContractExpense,
  }: {
    contractExpenseData: Array<Record<string, string | number>>;
    contractExpenseOptions: Array<{ id: string; total: number }>;
    contractExpenseSeries: Array<{ contratoId: string; label: string; dataKey: string }>;
    contractProjectionBullets: Array<{
      id: string;
      empenhado: number;
      liquidado: number;
      projetado: number;
      saldoEmpenhos: number;
      mesesConsiderados: number;
      liquidacoes: Array<{ id: string; valor: number }>;
      empenhos: Array<{ id: string; saldo: number }>;
    }>;
    selectedContractExpenseIds: string[];
    onToggleContractExpense: (contratoId: string) => void;
  }) => (
    <div data-testid="contract-execution-tab">
      <span data-testid="contract-expense-selected">{selectedContractExpenseIds.join(',')}</span>
      <span data-testid="contract-expense-options">{contractExpenseOptions.map((item) => `${item.id}:${item.total}`).join(',')}</span>
      <span data-testid="contract-expense-series">{contractExpenseSeries.map((item) => `${item.contratoId}:${item.label}`).join(',')}</span>
      <span data-testid="contract-expense-data">{JSON.stringify(contractExpenseData)}</span>
      <span data-testid="contract-projection-bullets">
        {contractProjectionBullets
          .map(
            (item) =>
              `${item.id}:${item.empenhado}:${item.liquidado}:${item.projetado}:${item.saldoEmpenhos}:${item.mesesConsiderados}:${item.liquidacoes.length}:${item.empenhos.length}`,
          )
          .join(',')}
      </span>
      <button type="button" onClick={() => onToggleContractExpense(contractExpenseOptions[0]?.id ?? '')}>
        toggle-first-contract
      </button>
    </div>
  ),
}));

vi.mock('@/components/dashboard/DashboardRapTab', () => ({
  DashboardRapTab: ({
    filteredRapCount,
    rapTotalInscrito,
    rapTotalReinscrito,
    rapTotalLiquidadoNoAno,
    rapTotalSaldoAtual,
    dadosRapPorOrigem,
  }: {
    filteredRapCount: number;
    rapTotalInscrito: number;
    rapTotalReinscrito: number;
    rapTotalLiquidadoNoAno: number;
    rapTotalSaldoAtual: number;
    dadosRapPorOrigem: Array<{ origem: string; baseVigente: number; liquidadoNoAno: number; saldoAtual: number }>;
  }) => (
    <div data-testid="rap-tab">
      <span data-testid="rap-count">{filteredRapCount}</span>
      <span data-testid="rap-total-inscrito">{rapTotalInscrito}</span>
      <span data-testid="rap-total-reinscrito">{rapTotalReinscrito}</span>
      <span data-testid="rap-total-liquidado-no-ano">{rapTotalLiquidadoNoAno}</span>
      <span data-testid="rap-total-saldo-atual">{rapTotalSaldoAtual}</span>
      <span data-testid="rap-origem-base">{dadosRapPorOrigem[0]?.baseVigente ?? 0}</span>
      <span data-testid="rap-origem-liquidado">{dadosRapPorOrigem[0]?.liquidadoNoAno ?? 0}</span>
      <span data-testid="rap-origem-saldo">{dadosRapPorOrigem[0]?.saldoAtual ?? 0}</span>
    </div>
  ),
}));

const mockedUseData = vi.mocked(useData);
const mockedUseQuery = vi.mocked(useQuery);
let liquidacoesQueryData: unknown[] = [];
let contratosApiEmpenhosQueryData: unknown[] = [];
let contratosApiLiquidacoesQueryData: unknown[] = [];
let contratosApiAtivosQueryData: unknown[] = [];
let contratosApiFaturasQueryData: unknown[] = [];

const makeAtividade = (overrides: Partial<ReturnType<typeof baseAtividade>> = {}) => ({
  ...baseAtividade(),
  ...overrides,
});

const makeEmpenho = (overrides: Partial<ReturnType<typeof baseEmpenho>> = {}) => ({
  ...baseEmpenho(),
  ...overrides,
});

const makeDescentralizacao = (overrides: Partial<ReturnType<typeof baseDescentralizacao>> = {}) => ({
  ...baseDescentralizacao(),
  ...overrides,
});

function baseAtividade() {
  return {
    id: 'atividade-1',
    dimensao: 'EN - Ensino',
    componenteFuncional: 'Ensino Base',
    tipoAtividade: 'sistemico' as const,
    atividade: 'Atividade teste',
    descricao: 'Descricao teste',
    valorTotal: 100,
    origemRecurso: 'Tesouro',
    naturezaDespesa: '339039 - Outros Servicos',
    planoInterno: 'PI-EN',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

function baseEmpenho() {
  return {
    id: 'empenho-1',
    numero: '2026NE0001',
    descricao: 'Empenho teste',
    valor: 50,
    dimensao: 'EN - Ensino',
    componenteFuncional: 'Ensino Base',
    origemRecurso: 'Tesouro',
    naturezaDespesa: '339039 - Outros Servicos',
    planoInterno: 'PIEN',
    favorecidoNome: 'Fornecedor Teste',
    favorecidoDocumento: '00000000000100',
    tipo: 'exercicio' as const,
    dataEmpenho: new Date('2026-02-10'),
    status: 'pendente' as const,
    createdAt: new Date('2026-02-10'),
    updatedAt: new Date('2026-02-10'),
  };
}

function baseDescentralizacao() {
  return {
    id: 'desc-1',
    dimensao: 'EN - Ensino',
    origemRecurso: 'Tesouro',
    valor: 40,
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
  };
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    liquidacoesQueryData = [];
    contratosApiEmpenhosQueryData = [];
    contratosApiLiquidacoesQueryData = [];
    contratosApiAtivosQueryData = [];
    contratosApiFaturasQueryData = [];
    mockedUseQuery.mockImplementation((options) => {
      const queryKey = Array.isArray(options.queryKey) ? options.queryKey[0] : '';
      if (queryKey === 'dashboard-liquidacoes-por-empenho') {
        return { data: liquidacoesQueryData } as ReturnType<typeof useQuery>;
      }
      if (queryKey === 'dashboard-contratos-api-empenhos') {
        return { data: contratosApiEmpenhosQueryData } as ReturnType<typeof useQuery>;
      }
      if (queryKey === 'dashboard-contratos-api-liquidacoes') {
        return { data: contratosApiLiquidacoesQueryData } as ReturnType<typeof useQuery>;
      }
      if (queryKey === 'dashboard-contratos-api-ativos') {
        return { data: contratosApiAtivosQueryData } as ReturnType<typeof useQuery>;
      }
      if (queryKey === 'dashboard-contratos-api-faturas') {
        return { data: contratosApiFaturasQueryData } as ReturnType<typeof useQuery>;
      }
      return { data: [] } as ReturnType<typeof useQuery>;
    });
    mockedUseData.mockReturnValue({
      atividades: [
        makeAtividade({ id: 'atividade-en', dimensao: 'EN - Ensino', tipoAtividade: 'sistemico', valorTotal: 200 }),
        makeAtividade({ id: 'atividade-ad', dimensao: 'AD - Administracao', tipoAtividade: 'campus', valorTotal: 100, componenteFuncional: 'Gestao', planoInterno: 'PI-AD' }),
      ],
      empenhos: [
        makeEmpenho({
          id: 'empenho-en',
          dimensao: '',
          planoInterno: 'PI-EN',
          descricao: 'Empenho vinculado ao ensino',
          valor: 50,
          tipo: 'exercicio',
        }),
        makeEmpenho({
          id: 'empenho-ad',
          numero: '2026NE0002',
          dimensao: 'AD - Administracao',
          componenteFuncional: 'Gestao',
          planoInterno: 'PI-AD',
          valor: 30,
          tipo: 'exercicio',
        }),
        makeEmpenho({
          id: 'rap-en',
          numero: '2025NE0001',
          dimensao: '',
          planoInterno: 'RAP-EN',
          descricao: 'RAP do ensino',
          valor: 80,
          tipo: 'rap',
          rapInscrito: 80,
          rapALiquidar: 20,
          rapLiquidado: 60,
          rapPago: 10,
        }),
      ],
      descentralizacoes: [
        makeDescentralizacao({ id: 'desc-en', dimensao: 'EN - Ensino', valor: 70 }),
        makeDescentralizacao({ id: 'desc-ad', dimensao: 'AD - Administracao', origemRecurso: 'ADM', valor: 20 }),
      ],
      contaDescentralizacoes: [
        {
          id: 'conta-tesouro',
          ptres: 'Tesouro',
          metrica: 'Saldo - Moeda Origem (Conta Contabil)',
          valor: 100,
          updatedAt: '2026-04-15T10:00:00.000Z',
        },
        {
          id: 'conta-adm',
          ptres: 'ADM',
          metrica: 'Saldo - Moeda Origem (Conta Contabil)',
          valor: 40,
          updatedAt: '2026-04-15T10:00:00.000Z',
        },
      ],
      contratos: [],
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
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('exibe o grafico de contratos em uma aba dedicada', () => {
    render(<Dashboard />);

    expect(screen.getAllByRole('button', { name: 'Orçamento' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'RAP' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Contratos' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'filter-en' })).toHaveLength(2);
    expect(screen.getByTestId('contract-execution-tab')).toBeInTheDocument();
    expect(within(screen.getByTestId('current-tab')).queryByTestId('contract-expense-period')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('contract-execution-tab')).queryByTestId('contract-expense-period')).not.toBeInTheDocument();
    expect(
      mockedUseQuery.mock.calls.find(([options]) => options.queryKey[0] === 'dashboard-contratos-api-ativos')?.[0].enabled,
    ).toBe(false);
  });

  it('agrega faturas de contratos por mes, status e valor liquido com fallback para bruto', () => {
    const aggregation = buildContractExpenseAggregation(
      [
        {
          id: 'c1',
          numero: '001/2026',
          fornecedor_nome: 'Fornecedor A',
          objeto: 'Servico A',
        },
        {
          id: 'c2',
          numero: '002/2026',
          fornecedor_nome: 'Fornecedor B',
          objeto: 'Servico B',
        },
        {
          id: 'c3',
          numero: '003/2026',
          fornecedor_nome: 'Fornecedor Sem Fatura',
          objeto: 'Servico C',
        },
      ] as never,
      [
        {
          id: 'f1',
          contrato_api_id: 'c1',
          situacao: 'Pago',
          valor_liquido: 100,
          valor_bruto: 120,
          data_emissao: '2026-01-05',
          raw_data: { contratante: '158366' },
        },
        {
          id: 'f2',
          contrato_api_id: 'c1',
          situacao: 'Pendente',
          valor_liquido: null,
          valor_bruto: 50,
          data_emissao: '2026-01-20',
          raw_data: { contratante: '158366' },
        },
        {
          id: 'f3',
          contrato_api_id: 'c2',
          situacao: 'Siafi Apropriado',
          valor_liquido: 70,
          valor_bruto: 80,
          data_emissao: '2026-02-10',
          raw_data: { contratante: '158366' },
        },
        {
          id: 'f4-fora-campus',
          contrato_api_id: 'c2',
          situacao: 'Pago',
          valor_liquido: 900,
          valor_bruto: 900,
          data_emissao: '2026-02-12',
          raw_data: { contratante: '158155' },
        },
      ] as never,
      {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-02-28'),
      },
    );

    expect(aggregation.options.map((item) => `${item.id}:${item.total}`)).toEqual(['c1:150', 'c2:70', 'c3:0']);
    expect(aggregation.data).toHaveLength(2);
    expect(aggregation.data[0]).toMatchObject({
      name: 'jan/26',
      contract_c1: 150,
      total: 150,
    });
    expect(aggregation.data[1]).toMatchObject({
      name: 'fev/26',
      contract_c2: 70,
      total: 70,
    });
  });

  it('monta bullet chart de projecao anual por contrato frente ao empenhado', () => {
    const bullets = buildContractProjectionBullets(
      [
        {
          id: 'c1',
          numero: '001/2026',
          fornecedor_nome: 'Fornecedor A',
          objeto: 'Servico A',
        },
        {
          id: 'c2',
          numero: '002/2026',
          fornecedor_nome: 'Fornecedor B',
          objeto: 'Servico B',
        },
      ] as never,
      [
        {
          id: 'f1',
          contrato_api_id: 'c1',
          situacao: 'Pago',
          valor_liquido: 100,
          valor_bruto: 120,
          data_emissao: '2026-01-05',
          raw_data: { contratante: '158366' },
        },
        {
          id: 'f2',
          contrato_api_id: 'c1',
          situacao: 'Siafi Apropriado',
          valor_liquido: 50,
          valor_bruto: 60,
          data_emissao: '2026-02-10',
          raw_data: { contratante: '158366' },
        },
        {
          id: 'f3-pendente',
          contrato_api_id: 'c1',
          situacao: 'Em analise',
          valor_liquido: 900,
          valor_bruto: 900,
          data_emissao: '2026-02-20',
          raw_data: { contratante: '158366' },
        },
        {
          id: 'f4-fora-campus',
          contrato_api_id: 'c2',
          situacao: 'Pago',
          valor_liquido: 500,
          valor_bruto: 500,
          data_emissao: '2026-02-20',
          raw_data: { contratante: '158155' },
        },
      ] as never,
      [
        {
          id: 'e1',
          contrato_api_id: 'c1',
          numero: '2026NE000001',
          data_emissao: '2026-01-02',
          valor_empenhado: 1000,
          valor_a_liquidar: 830,
          valor_liquidado: 150,
          valor_pago: 100,
        },
        {
          id: 'e2',
          contrato_api_id: 'c2',
          numero: '2026NE000002',
          data_emissao: '2026-01-02',
          valor_empenhado: 500,
          valor_a_liquidar: null,
          valor_liquidado: 0,
          valor_pago: 0,
        },
      ] as never,
      ['c1', 'c2'],
      {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        today: new Date('2026-03-15'),
      },
    );

    expect(bullets).toHaveLength(2);
    expect(bullets[0]).toMatchObject({
      id: 'c1',
      empenhado: 1000,
      liquidado: 150,
      projetado: 600,
      saldoEmpenhos: 830,
      mesesConsiderados: 3,
      percentualLiquidado: expect.closeTo(18.07, 1),
      percentualProjetado: expect.closeTo(72.29, 1),
      coberturaMes: 'Julho/27',
      necessidadeEmpenho: 0,
    });
    expect(bullets[0].liquidacoes).toEqual([
      expect.objectContaining({
        id: 'f2',
        numeroInstrumento: 'Sem instrumento',
        situacao: 'Siafi Apropriado',
        valor: 50,
      }),
      expect.objectContaining({
        id: 'f1',
        numeroInstrumento: 'Sem instrumento',
        situacao: 'Pago',
        valor: 100,
      }),
    ]);
    expect(bullets[0].empenhos).toEqual([
      expect.objectContaining({
        id: 'e1',
        numero: '2026NE000001',
        valorEmpenhado: 1000,
        valorLiquidado: 150,
        valorPago: 100,
        saldo: 830,
        saldoFonte: 'api',
      }),
    ]);
    expect(bullets[1]).toMatchObject({
      id: 'c2',
      empenhado: 500,
      liquidado: 0,
      projetado: 0,
      saldoEmpenhos: 500,
      mesesConsiderados: 3,
    });
    expect(bullets[1].liquidacoes).toHaveLength(0);
    expect(bullets[1].empenhos[0]).toMatchObject({
      id: 'e2',
      saldo: 500,
      saldoFonte: 'calculado',
    });
  });

  it('aplica corretamente a quantidade personalizada de meses de projecao', () => {
    const bullets = buildContractProjectionBullets(
      [
        {
          id: 'c1',
          numero: '00123/2026',
          fornecedor_nome: 'Fornecedor A',
          objeto: 'Servico A',
        },
      ] as never,
      [
        {
          id: 'f1',
          contrato_api_id: 'c1',
          situacao: 'Pago',
          valor_liquido: 100,
          valor_bruto: 100,
          data_emissao: '2026-01-10',
          raw_data: { contratante: '158366' },
        },
      ] as never,
      [] as never,
      ['c1'],
      {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        today: new Date('2026-03-15'),
        projectionTargetMonths: 15,
      },
    );

    expect(bullets).toHaveLength(1);
    expect(bullets[0].projetado).toBeCloseTo(500, 1);
  });

  it('seleciona automaticamente o contrato com maior gasto mensal', async () => {
    const currentYear = new Date().getFullYear();
    contratosApiAtivosQueryData = [1, 2, 3, 4, 5, 6].map((index) => ({
      id: `c${index}`,
      numero: `00${index}/${currentYear}`,
      fornecedor_nome: `Fornecedor ${index}`,
      objeto: `Servico ${index}`,
    }));
    contratosApiFaturasQueryData = [1, 2, 3, 4, 5, 6].map((index) => ({
      id: `f${index}`,
      contrato_api_id: `c${index}`,
      situacao: index % 2 === 0 ? 'Pago' : 'Em análise',
      valor_liquido: index * 10,
      valor_bruto: index * 10,
      data_emissao: `${currentYear}-03-10`,
      raw_data: { contratante: '158366' },
    }));
    contratosApiEmpenhosQueryData = [1, 2, 3, 4, 5, 6].map((index) => ({
      id: `e${index}`,
      contrato_api_id: `c${index}`,
      data_emissao: `${currentYear}-01-10`,
      valor_empenhado: index * 100,
    }));

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('contract-expense-selected')).toHaveTextContent('c6');
    });

    expect(screen.getByTestId('contract-expense-options')).toHaveTextContent('c6:60,c5:50,c4:40,c3:30,c2:20,c1:10');
    expect(screen.getByTestId('contract-expense-series')).toHaveTextContent(`c6:Fornecedor 6 - 006/${currentYear}`);
    expect(screen.getByTestId('contract-expense-data')).toHaveTextContent('contract_c6');
    expect(screen.getByTestId('contract-expense-data')).not.toHaveTextContent('contract_c1');
    expect(screen.getByTestId('contract-projection-bullets')).toHaveTextContent('c6:600:60');
  });

  it('permite filtrar manualmente contratos', async () => {
    const currentYear = new Date().getFullYear();
    contratosApiAtivosQueryData = [1, 2, 3, 4, 5, 6].map((index) => ({
      id: `c${index}`,
      numero: `00${index}/${currentYear}`,
      fornecedor_nome: `Fornecedor ${index}`,
      objeto: `Servico ${index}`,
    }));
    contratosApiFaturasQueryData = [1, 2, 3, 4, 5, 6].map((index) => ({
      id: `f${index}`,
      contrato_api_id: `c${index}`,
      situacao: 'Pago',
      valor_liquido: index * 10,
      valor_bruto: index * 10,
      data_emissao: `${currentYear}-03-10`,
      raw_data: { contratante: '158366' },
    }));

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('contract-expense-selected')).toHaveTextContent('c6');
    });

    fireEvent.click(screen.getByRole('button', { name: 'toggle-first-contract' }));

    await waitFor(() => {
      expect(screen.getByTestId('contract-expense-selected')).toHaveTextContent('');
    });
    expect(screen.getByTestId('contract-expense-series')).not.toHaveTextContent('c6:');
  });

  it('inicia o gasto por contrato limitado ao ano atual e usa o periodo do filtro global', async () => {
    const currentYear = new Date().getFullYear();

    render(<Dashboard />);

    expect(
      mockedUseQuery.mock.calls.some(([options]) => {
        const queryKey = options.queryKey as unknown[];
        return queryKey[0] === 'dashboard-contratos-api-faturas'
          && queryKey[2] === `${currentYear}-01-01`
          && queryKey[3] === `${currentYear}-12-31`;
      }),
    ).toBe(true);

    fireEvent.click(screen.getAllByRole('button', { name: 'filter-start-2025' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'filter-end-2025' })[0]);

    await waitFor(() => {
      expect(
        mockedUseQuery.mock.calls.some(([options]) => {
          const queryKey = options.queryKey as unknown[];
          return queryKey[0] === 'dashboard-contratos-api-faturas'
            && queryKey[2] === '2025-01-01'
            && queryKey[3] === '2025-12-31';
        }),
      ).toBe(true);
    });
  });

  it('aplica filtro de dimensao usando inferencia por plano interno em exercicio e RAP', async () => {
    render(<Dashboard />);

    expect(screen.getByTestId('current-planejado')).toHaveTextContent('300');
    expect(screen.getByTestId('current-descentralizado')).toHaveTextContent('140');
    expect(screen.getByTestId('current-empenhos-corrente')).toHaveTextContent('2');
    expect(screen.getByTestId('current-empenhos-rap')).toHaveTextContent('1');

    fireEvent.click(screen.getAllByRole('button', { name: 'filter-en' })[0]);

    await waitFor(() => {
      expect(screen.getByTestId('current-planejado')).toHaveTextContent('200');
    });

    expect(screen.getByTestId('current-descentralizado')).toHaveTextContent('100');
    expect(screen.getByTestId('current-empenhos-corrente')).toHaveTextContent('1');
    expect(screen.getByTestId('current-empenhos-rap')).toHaveTextContent('1');
  });

  it('mantem os totais principais ao selecionar uma dimensao no treemap', async () => {
    render(<Dashboard />);

    expect(screen.getByTestId('current-planejado')).toHaveTextContent('300');
    expect(screen.getByTestId('current-descentralizado')).toHaveTextContent('140');
    expect(screen.getByTestId('current-empenhos-corrente')).toHaveTextContent('2');
    expect(screen.getByTestId('active-budget-dimension')).toHaveTextContent('none');
    expect(screen.queryByText(/Dimensao ativa:/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'select-budget-en' }));

    await waitFor(() => {
      expect(screen.getByTestId('active-budget-dimension')).toHaveTextContent('EN - Ensino');
    });

    expect(screen.getByTestId('current-planejado')).toHaveTextContent('300');
    expect(screen.getByTestId('current-empenhos-corrente')).toHaveTextContent('2');
    expect(screen.getByTestId('current-descentralizado')).toHaveTextContent('140');
    expect(screen.queryByText(/Dimensao ativa:/)).not.toBeInTheDocument();
  });

  it('soma liquidado e pago pelas colunas oficiais do SIAFI preservando zero oficial', () => {
    mockedUseData.mockReturnValue({
      atividades: [],
      empenhos: [
        makeEmpenho({
          id: 'exercicio-a',
          numero: '2026NE0001',
          tipo: 'exercicio',
          valor: 1000,
          valorLiquidado: 9999,
          valorPago: 9999,
          valorLiquidadoOficial: 300,
          valorPagoOficial: 200,
          dataEmpenho: new Date('2026-01-10'),
        }),
        makeEmpenho({
          id: 'exercicio-b-zero-oficial',
          numero: '2026NE0002',
          tipo: 'exercicio',
          valor: 500,
          valorLiquidado: 8888,
          valorPago: 8888,
          valorLiquidadoOficial: 0,
          valorPagoOficial: 0,
          dataEmpenho: new Date('2026-02-10'),
        }),
        makeEmpenho({
          id: 'exercicio-c-fallback-legado',
          numero: '2026NE0003',
          tipo: 'exercicio',
          valor: 700,
          valorLiquidado: 70,
          valorPago: 50,
          dataEmpenho: new Date('2026-02-20'),
        }),
        makeEmpenho({
          id: 'exercicio-cancelado',
          numero: '2026NE0004',
          tipo: 'exercicio',
          status: 'cancelado',
          valor: 100,
          valorLiquidadoOficial: 100,
          valorPagoOficial: 100,
          dataEmpenho: new Date('2026-02-25'),
        }),
        makeEmpenho({
          id: 'rap-fora-da-aba-corrente',
          numero: '2025NE0001',
          tipo: 'rap',
          valor: 300,
          valorLiquidadoOficial: 300,
          valorPagoOficial: 300,
          rapPago: 300,
          dataEmpenho: new Date('2025-01-01'),
        }),
      ],
      descentralizacoes: [],
      contaDescentralizacoes: [],
      contratos: [],
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

    render(<Dashboard />);

    expect(screen.getByTestId('current-liquidado')).toHaveTextContent('370');
    expect(screen.getByTestId('current-pago')).toHaveTextContent('250');
    expect(screen.getByTestId('current-mensal-liquidado')).toHaveTextContent('0,0,0,0,0');
  });

  it('monta a evolucao mensal com empenhado pelo historico de operacoes e liquidado pelas NPs', () => {
    liquidacoesQueryData = [
      {
        documentoHabil: '2026NP000001',
        empenhoNumero: '158366264352026NE000001',
        empenhoNumeroNormalizado: '2026NE000001',
        dataEmissao: '2026-02-05',
        valor: 25,
      },
      {
        documentoHabil: '2026NP000002',
        empenhoNumero: '158366264352026NE000001',
        empenhoNumeroNormalizado: '2026NE000001',
        dataEmissao: '2026-04-15',
        valor: 15,
      },
    ];

    mockedUseData.mockReturnValue({
      atividades: [
        makeAtividade({
          id: 'planejamento-janeiro',
          valorTotal: 1000,
          createdAt: new Date('2026-01-05'),
          updatedAt: new Date('2026-01-05'),
        }),
        makeAtividade({
          id: 'planejamento-marco',
          valorTotal: 200,
          createdAt: new Date('2026-03-01'),
          updatedAt: new Date('2026-03-01'),
        }),
      ],
      empenhos: [
        makeEmpenho({
          id: 'empenho-com-historico',
          numero: '2026NE000001',
          tipo: 'exercicio',
          valor: 130,
          valorPagoOficial: 40,
          valorLiquidadoOficial: 40,
          ultimaAtualizacaoSiafi: new Date('2026-04-15'),
          dataEmpenho: new Date('2026-01-10'),
          historicoOperacoes: [
            {
              data: '2026-01-10',
              operacao: 'INCLUSAO',
              quantidade: 1,
              valorUnitario: 100,
              valorTotal: 100,
            },
            {
              data: '2026-02-03',
              operacao: 'REFORCO',
              quantidade: 1,
              valorUnitario: 50,
              valorTotal: 50,
            },
            {
              data: '2026-03-20',
              operacao: 'ANULACAO',
              quantidade: 1,
              valorUnitario: 20,
              valorTotal: 20,
            },
          ],
        }),
      ],
      descentralizacoes: [],
      contaDescentralizacoes: [],
      contratos: [],
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

    render(<Dashboard />);

    expect(screen.getByTestId('current-mensal-planejado')).toHaveTextContent('1200,1200,1200,1200,1200');
    expect(screen.getByTestId('current-mensal-empenhado')).toHaveTextContent('100,150,130,130,130');
    expect(screen.getByTestId('current-mensal-liquidado')).toHaveTextContent('0,25,25,40,40');
  });

  it('usa liquidacoes da API de contratos quando nao ha NP vinculada e fecha no total oficial', () => {
    contratosApiLiquidacoesQueryData = [
      {
        empenho_numero: '158366264352026NE000001',
        data_liquidacao: '2026-03-05',
        data_emissao: '2026-03-01',
        valor_liquido: 30,
        valor_bruto: 30,
      },
      {
        empenho_numero: '2026NE000001',
        data_liquidacao: null,
        data_emissao: '2026-04-15',
        valor_liquido: 20,
        valor_bruto: 20,
      },
    ];

    mockedUseData.mockReturnValue({
      atividades: [],
      empenhos: [
        makeEmpenho({
          id: 'empenho-com-liquidacao-api',
          numero: '2026NE000001',
          tipo: 'exercicio',
          valor: 100,
          valorLiquidadoOficial: 100,
          dataEmpenho: new Date('2026-02-10'),
        }),
      ],
      descentralizacoes: [],
      contaDescentralizacoes: [],
      contratos: [],
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

    render(<Dashboard />);

    expect(screen.getByTestId('current-liquidado')).toHaveTextContent('100');
    expect(screen.getByTestId('current-mensal-liquidado')).toHaveTextContent('0,60,100,100');
  });

  it('ignora historico de operacoes quando ele nao fecha com o total empenhado do funil', () => {
    mockedUseData.mockReturnValue({
      atividades: [],
      empenhos: [
        makeEmpenho({
          id: 'empenho-historico-incompleto',
          numero: '2026NE000001',
          tipo: 'exercicio',
          valor: 130,
          dataEmpenho: new Date('2026-02-10'),
          historicoOperacoes: [
            {
              data: '2026-01-10',
              operacao: 'INCLUSAO',
              quantidade: 1,
              valorUnitario: 100,
              valorTotal: 100,
            },
          ],
        }),
      ],
      descentralizacoes: [],
      contaDescentralizacoes: [],
      contratos: [],
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

    render(<Dashboard />);

    expect(screen.getByTestId('current-planejado')).toHaveTextContent('0');
    expect(screen.getByTestId('current-mensal-empenhado')).toHaveTextContent('130,130,130,130');
  });

  it('usa data de emissao da API de contratos quando o cadastro local esta em mes errado', () => {
    contratosApiEmpenhosQueryData = [
      {
        numero: '158366264352026NE000001',
        data_emissao: '2026-04-10',
        unidade_gestora: '158366',
      },
    ];

    mockedUseData.mockReturnValue({
      atividades: [
        makeAtividade({
          id: 'planejamento',
          valorTotal: 1000,
          createdAt: new Date('2026-01-05'),
          updatedAt: new Date('2026-01-05'),
        }),
      ],
      empenhos: [
        makeEmpenho({
          id: 'empenho-data-local-errada',
          numero: '2026NE000001',
          tipo: 'exercicio',
          valor: 130,
          valorLiquidadoOficial: 0,
          dataEmpenho: new Date('2026-02-10'),
        }),
      ],
      descentralizacoes: [],
      contaDescentralizacoes: [],
      contratos: [],
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

    render(<Dashboard />);

    expect(screen.getByTestId('current-mensal-planejado')).toHaveTextContent('1000,1000,1000,1000,1000');
    expect(screen.getByTestId('current-mensal-empenhado')).toHaveTextContent('0,0,0,130,130');
  });

  it('separa inscritos e reinscritos e soma RAP pagos com liquidado a pagar no ano', async () => {
    mockedUseData.mockReturnValue({
      atividades: [],
      empenhos: [
        makeEmpenho({
          id: 'rap-inscrito',
          numero: '2025NE0009',
          tipo: 'rap',
          origemRecurso: 'Tesouro',
          rapInscrito: 120,
          rapALiquidar: 30,
          saldoRapOficial: 20,
          rapPago: 100,
          valorLiquidadoAPagar: 15,
        }),
        makeEmpenho({
          id: 'rap-reinscrito',
          numero: '2024NE0010',
          tipo: 'rap',
          origemRecurso: 'Tesouro',
          rapInscrito: 150,
          rapALiquidar: 90,
          saldoRapOficial: 60,
          rapPago: 30,
          valorLiquidadoAPagar: 10,
        }),
      ],
      descentralizacoes: [],
      contaDescentralizacoes: [],
      contratos: [],
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

    render(<Dashboard />);

    expect(screen.getByTestId('rap-total-inscrito')).toHaveTextContent('120');
    expect(screen.getByTestId('rap-total-reinscrito')).toHaveTextContent('90');
    expect(screen.getByTestId('rap-total-liquidado-no-ano')).toHaveTextContent('130');
    expect(screen.getByTestId('rap-total-saldo-atual')).toHaveTextContent('80');

    expect(screen.getByTestId('rap-origem-base')).toHaveTextContent('210');
    expect(screen.getByTestId('rap-origem-liquidado')).toHaveTextContent('130');
    expect(screen.getByTestId('rap-origem-saldo')).toHaveTextContent('80');
  });
});
