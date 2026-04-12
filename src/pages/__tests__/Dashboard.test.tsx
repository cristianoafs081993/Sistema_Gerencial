import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Dashboard from '@/pages/Dashboard';
import { useData } from '@/contexts/DataContext';

vi.mock('@/contexts/DataContext', () => ({
  useData: vi.fn(),
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
    onClearFilters,
  }: {
    onFilterDimensaoChange: (value: string) => void;
    onClearFilters: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => onFilterDimensaoChange('EN')}>
        filter-en
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
    totalLiquidado,
    totalPago,
    dadosMensais,
    activeBudgetDimension,
    onSelectBudgetDimension,
  }: {
    filteredData: { empenhosCorrente: unknown[]; empenhosRap: unknown[] };
    totalPlanejado: number;
    totalLiquidado: number;
    totalPago: number;
    dadosMensais: Array<{ name: string; pago: number }>;
    activeBudgetDimension: string | null;
    onSelectBudgetDimension: (value?: string | null) => void;
  }) => (
    <div data-testid="current-tab">
      <span data-testid="current-planejado">{totalPlanejado}</span>
      <span data-testid="current-liquidado">{totalLiquidado}</span>
      <span data-testid="current-pago">{totalPago}</span>
      <span data-testid="current-mensal-pago">{dadosMensais.map((item) => item.pago).join(',')}</span>
      <span data-testid="current-empenhos-corrente">{filteredData.empenhosCorrente.length}</span>
      <span data-testid="current-empenhos-rap">{filteredData.empenhosRap.length}</span>
      <span data-testid="active-budget-dimension">{activeBudgetDimension ?? 'none'}</span>
      <button type="button" onClick={() => onSelectBudgetDimension('EN')}>
        select-budget-en
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
        makeDescentralizacao({ id: 'desc-ad', dimensao: 'AD - Administracao', valor: 20 }),
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
  });

  it('aplica filtro de dimensao usando inferencia por plano interno em exercicio e RAP', async () => {
    render(<Dashboard />);

    expect(screen.getByTestId('current-planejado')).toHaveTextContent('300');
    expect(screen.getByTestId('current-empenhos-corrente')).toHaveTextContent('2');
    expect(screen.getByTestId('current-empenhos-rap')).toHaveTextContent('1');

    fireEvent.click(screen.getAllByRole('button', { name: 'filter-en' })[0]);

    await waitFor(() => {
      expect(screen.getByTestId('current-planejado')).toHaveTextContent('200');
    });

    expect(screen.getByTestId('current-empenhos-corrente')).toHaveTextContent('1');
    expect(screen.getByTestId('current-empenhos-rap')).toHaveTextContent('1');

    expect(screen.getByTestId('current-empenhos-rap')).toHaveTextContent('1');
  });

  it('mantem os totais principais ao selecionar uma dimensao no treemap', async () => {
    render(<Dashboard />);

    expect(screen.getByTestId('current-planejado')).toHaveTextContent('300');
    expect(screen.getByTestId('current-empenhos-corrente')).toHaveTextContent('2');
    expect(screen.getByTestId('active-budget-dimension')).toHaveTextContent('none');
    expect(screen.queryByText(/Dimensao ativa:/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'select-budget-en' }));

    await waitFor(() => {
      expect(screen.getByTestId('active-budget-dimension')).toHaveTextContent('EN - Ensino');
    });

    expect(screen.getByTestId('current-planejado')).toHaveTextContent('300');
    expect(screen.getByTestId('current-empenhos-corrente')).toHaveTextContent('2');
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
    expect(screen.getByTestId('current-mensal-pago')).toHaveTextContent('200,250');
  });

  it('separa inscritos e reinscritos e usa RAP pagos como liquidado no ano', async () => {
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
        }),
      ],
      descentralizacoes: [],
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
