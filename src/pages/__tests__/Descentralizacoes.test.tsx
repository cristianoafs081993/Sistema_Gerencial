import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Descentralizacoes from '@/pages/Descentralizacoes';
import { useData } from '@/contexts/DataContext';

const testState = vi.hoisted(() => ({
  isSuperAdmin: false,
  importHandlers: new Map<string, (data: Record<string, string>[]) => void | Promise<void>>(),
}));

vi.mock('@/contexts/DataContext', () => ({
  useData: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isSuperAdmin: testState.isSuperAdmin,
  }),
}));

vi.mock('@/services/descentralizacoesContaSaldos', () => ({
  descentralizacoesContaSaldosService: {
    getAll: vi.fn(),
    upsertBatch: vi.fn(),
  },
}));

vi.mock('@/services/descentralizacoes', () => ({
  descentralizacoesService: {
    importFromCsv: vi.fn(),
    processDevolucao: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
  },
}));

vi.mock('@/components/HeaderParts', () => ({
  HeaderActions: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/design-system/FilterPanel', () => ({
  FilterPanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/JsonImportDialog', () => ({
  JsonImportDialog: ({
    title,
    onImport,
  }: {
    title: string;
    onImport: (data: Record<string, string>[]) => void | Promise<void>;
  }) => {
    testState.importHandlers.set(title, onImport);
    return null;
  },
}));

vi.mock('@/components/StatCard', () => ({
  StatCard: ({ title, value }: { title: string; value: string | number }) => (
    <section data-testid={`stat-card-${String(title).toLowerCase().replace(/\s+/g, '-')}`}>
      <h2>{title}</h2>
      <span>{value}</span>
    </section>
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: ReactNode;
  }) => (
    <select value={value} onChange={(event) => onValueChange(event.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

const mockedUseData = vi.mocked(useData);

const makeDescentralizacao = (overrides: Partial<ReturnType<typeof baseDescentralizacao>> = {}) => ({
  ...baseDescentralizacao(),
  ...overrides,
});

function baseDescentralizacao() {
  return {
    id: 'desc-1',
    dimensao: 'EN - Ensino',
    origemRecurso: '231796',
    naturezaDespesa: '339039',
    planoInterno: 'L20RLP19ENN',
    dataEmissao: new Date('2026-04-01'),
    descricao: 'Processo teste',
    valor: 100,
    createdAt: new Date('2026-04-01'),
    updatedAt: new Date('2026-04-01'),
  };
}

describe('Descentralizacoes', () => {
  beforeEach(() => {
    testState.isSuperAdmin = false;
    testState.importHandlers.clear();

    mockedUseData.mockReturnValue({
      atividades: [],
      empenhos: [],
      descentralizacoes: [
        makeDescentralizacao({
          id: 'desc-en-explicita',
          dimensao: 'EN - Ensino',
          origemRecurso: '231796',
          valor: 100,
        }),
        makeDescentralizacao({
          id: 'desc-en-inferida',
          dimensao: '',
          origemRecurso: '231796',
          planoInterno: 'L20RLP19ENN',
          descricao: 'Descentralizacao inferida pelo PI',
          valor: 25,
        }),
        makeDescentralizacao({
          id: 'desc-en-outra-origem',
          dimensao: 'EN - Ensino',
          origemRecurso: '231802',
          valor: -10,
        }),
        makeDescentralizacao({
          id: 'desc-ad',
          dimensao: 'AD - Administracao',
          origemRecurso: '231796',
          planoInterno: 'L20RLP01ADN',
          valor: 50,
        }),
        makeDescentralizacao({
          id: 'desc-ae',
          dimensao: 'AE - Atividades Estudantis',
          origemRecurso: '261941',
          planoInterno: 'L21IVP23AEN',
          valor: 75,
        }),
      ],
      contaDescentralizacoes: [
        {
          id: 'conta-231796',
          ptres: '231796',
          metrica: 'Saldo - Moeda Origem (Conta Contabil)',
          valor: 175,
          updatedAt: '2026-04-15T10:00:00.000Z',
        },
        {
          id: 'conta-231802',
          ptres: '231802',
          metrica: 'Saldo - Moeda Origem (Conta Contabil)',
          valor: 50,
          updatedAt: '2026-04-15T10:00:00.000Z',
        },
        {
          id: 'conta-261941',
          ptres: '261941',
          metrica: 'Saldo - Moeda Origem (Conta Contabil)',
          valor: 75,
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
  });

  it('mostra a soma liquida inicial no card e no total da tabela', () => {
    render(<Descentralizacoes />);

    expect(screen.getByTestId('stat-card-total-descentralizado')).toHaveTextContent('R$ 300,00');
    expect(screen.getByText('Total: R$ 300,00')).toBeInTheDocument();
  });

  it('recalcula a soma ao filtrar por dimensao, inclusive quando a dimensao vem do plano interno', async () => {
    render(<Descentralizacoes />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'EN' } });

    await waitFor(() => {
      expect(screen.getByTestId('stat-card-total-descentralizado')).toHaveTextContent('R$ 175,00');
    });

    expect(screen.getByText('Total: R$ 175,00')).toBeInTheDocument();
    expect(screen.getByText(/3 descentraliza/i)).toBeInTheDocument();
  });

  it('recalcula a soma ao filtrar por origem de recurso e ao combinar origem com dimensao', async () => {
    render(<Descentralizacoes />);

    fireEvent.click(screen.getByRole('button', { name: /Op/i }));

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: '231802' } });

    await waitFor(() => {
      expect(screen.getByTestId('stat-card-total-descentralizado')).toHaveTextContent('R$ 50,00');
    });

    expect(screen.getByText('Total: R$ 50,00')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText(/231802/)).toBeInTheDocument();

    fireEvent.change(selects[0], { target: { value: 'EN' } });

    await waitFor(() => {
      expect(screen.getByTestId('stat-card-total-descentralizado')).toHaveTextContent('R$ 50,00');
    });

    expect(screen.getByText('Total: R$ 50,00')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByText(/231802/)).toHaveLength(1);
  });

  it('reconcilia linha legada sem nota de credito ao reimportar CSV com NC', async () => {
    testState.isSuperAdmin = true;
    const addDescentralizacao = vi.fn();
    const updateDescentralizacao = vi.fn().mockResolvedValue(undefined);

    mockedUseData.mockReturnValue({
      atividades: [],
      empenhos: [],
      descentralizacoes: [
        makeDescentralizacao({
          id: 'legacy-desc',
          dataEmissao: new Date('2026-01-09'),
          origemRecurso: '231796',
          naturezaDespesa: '339000',
          planoInterno: 'L20RLP01ADN',
          valor: 10000,
          notaCredito: undefined,
          operacaoTipo: undefined,
        }),
      ],
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
      addDescentralizacao,
      updateDescentralizacao,
      deleteDescentralizacao: vi.fn(),
      getResumoOrcamentario: vi.fn(),
      getTotalPlanejado: vi.fn(),
      getTotalEmpenhado: vi.fn(),
      getTotalDescentralizado: vi.fn(),
      getADescentralizar: vi.fn(),
      getSaldoTotal: vi.fn(),
      refreshData: vi.fn(),
    });

    render(<Descentralizacoes />);

    const importHandler = Array.from(testState.importHandlers.entries()).find(([title]) =>
      title.includes('Descentraliza'),
    )?.[1];

    expect(importHandler).toBeDefined();
    await importHandler?.([
      {
        nc: '158155264352026NC000002',
        ncoperacaotipo: 'DESCENTRALIZACAO DE CREDITO',
        ncdiaemissao: '09/01/2026',
        ncdescricao: 'DESCENTRALIZACAO ORCAMENTARIA',
        nccelulaptres: '231796',
        nccelulanaturezadespesa: '339000',
        nccelulaplanointerno: 'L20RLP01ADN',
        nccelulavalor: '10000',
      },
    ]);

    expect(updateDescentralizacao).toHaveBeenCalledWith(
      'legacy-desc',
      expect.objectContaining({
        notaCredito: '2026NC000002',
        operacaoTipo: 'DESCENTRALIZACAO DE CREDITO',
        origemRecurso: '231796',
        naturezaDespesa: '339000',
        planoInterno: 'L20RLP01ADN',
        valor: 10000,
      }),
    );
    expect(addDescentralizacao).not.toHaveBeenCalled();
  });

  it('ignora linha de origem com rotulo complementar no upload principal', async () => {
    testState.isSuperAdmin = true;
    const addDescentralizacao = vi.fn();

    mockedUseData.mockReturnValue({
      atividades: [],
      empenhos: [],
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
      addDescentralizacao,
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

    render(<Descentralizacoes />);

    const importHandler = Array.from(testState.importHandlers.entries()).find(([title]) =>
      title.includes('Descentraliza'),
    )?.[1];

    expect(importHandler).toBeDefined();
    await importHandler?.([
      {
        nc: '158155264352026NC000004',
        nccelulatipo: 'Destino da NC',
        ncoperacaotipo: 'DESCENTRALIZACAO DE CREDITO',
        ncdiaemissao: '10/04/2026',
        ncdescricao: 'CREDITO REGULAR',
        nccelulaptres: '123456',
        nccelulanaturezadespesa: '339000',
        nccelulaplanointerno: 'PI123ADN',
        nccelulavalor: '700,00',
      },
      {
        nc: '158155264352026NC000004',
        nccelulatipo: 'Origem da NC',
        ncoperacaotipo: 'DESCENTRALIZACAO DE CREDITO',
        ncdiaemissao: '10/04/2026',
        ncdescricao: 'CREDITO REGULAR',
        nccelulaptres: '123456',
        nccelulanaturezadespesa: '339039',
        nccelulaplanointerno: 'PI123ADN',
        nccelulavalor: '700,00',
      },
    ]);

    expect(addDescentralizacao).toHaveBeenCalledTimes(1);
    expect(addDescentralizacao).toHaveBeenCalledWith(
      expect.objectContaining({
        notaCredito: '2026NC000004',
        operacaoTipo: 'DESCENTRALIZACAO DE CREDITO',
        origemRecurso: '123456',
        naturezaDespesa: '339000',
        planoInterno: 'PI123ADN',
        valor: 700,
      }),
    );
  });
});
