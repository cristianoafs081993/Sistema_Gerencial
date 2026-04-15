import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { DataProvider, useData } from '@/contexts/DataContext';
import { atividadesService } from '@/services/atividades';
import { contratosService } from '@/services/contratos';
import { creditosDisponiveisService } from '@/services/creditosDisponiveis';
import { descentralizacoesContaSaldosService } from '@/services/descentralizacoesContaSaldos';
import { descentralizacoesService } from '@/services/descentralizacoes';
import { empenhosService } from '@/services/empenhos';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/services/atividades', () => ({
  atividadesService: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/services/empenhos', () => ({
  empenhosService: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/services/descentralizacoes', () => ({
  descentralizacoesService: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/services/contratos', () => ({
  contratosService: {
    getContratos: vi.fn(),
    getContratosEmpenhos: vi.fn(),
  },
}));

vi.mock('@/services/creditosDisponiveis', () => ({
  creditosDisponiveisService: {
    getAll: vi.fn(),
  },
}));

vi.mock('@/services/descentralizacoesContaSaldos', () => ({
  descentralizacoesContaSaldosService: {
    getAll: vi.fn(),
  },
}));

const mockedAtividadesService = vi.mocked(atividadesService);
const mockedEmpenhosService = vi.mocked(empenhosService);
const mockedDescentralizacoesService = vi.mocked(descentralizacoesService);
const mockedContratosService = vi.mocked(contratosService);
const mockedCreditosService = vi.mocked(creditosDisponiveisService);
const mockedContaDescentralizacoesService = vi.mocked(descentralizacoesContaSaldosService);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <DataProvider>{children}</DataProvider>
    </QueryClientProvider>
  );
}

describe('DataContext', () => {
  beforeEach(() => {
    mockedAtividadesService.getAll.mockResolvedValue([
      {
        id: 'atividade-en',
        dimensao: 'EN - Ensino',
        componenteFuncional: 'Ensino Base',
        tipoAtividade: 'sistemico',
        atividade: 'Atividade ensino',
        descricao: 'Descricao',
        valorTotal: 120,
        origemRecurso: 'Tesouro',
        naturezaDespesa: '339039',
        planoInterno: 'PI-EN',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
      {
        id: 'atividade-ad',
        dimensao: 'AD - Administracao',
        componenteFuncional: 'Gestao',
        tipoAtividade: 'campus',
        atividade: 'Atividade administracao',
        descricao: 'Descricao',
        valorTotal: 80,
        origemRecurso: 'Tesouro',
        naturezaDespesa: '339039',
        planoInterno: 'PI-AD',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
    ]);

    mockedEmpenhosService.getAll.mockResolvedValue([
      {
        id: 'empenho-en',
        numero: '2026NE0001',
        descricao: 'Empenho ensino',
        valor: 30,
        dimensao: 'EN - Ensino',
        componenteFuncional: 'Ensino Base',
        origemRecurso: 'Tesouro',
        naturezaDespesa: '339039',
        planoInterno: 'PIEN',
        tipo: 'exercicio',
        dataEmpenho: new Date('2026-02-01'),
        status: 'pendente',
        createdAt: new Date('2026-02-01'),
        updatedAt: new Date('2026-02-01'),
      },
      {
        id: 'empenho-cancelado',
        numero: '2026NE0002',
        descricao: 'Empenho cancelado',
        valor: 999,
        dimensao: 'EN - Ensino',
        componenteFuncional: 'Ensino Base',
        origemRecurso: 'Tesouro',
        naturezaDespesa: '339039',
        planoInterno: 'PIEN',
        tipo: 'exercicio',
        dataEmpenho: new Date('2026-02-02'),
        status: 'cancelado',
        createdAt: new Date('2026-02-02'),
        updatedAt: new Date('2026-02-02'),
      },
    ]);

    mockedDescentralizacoesService.getAll.mockResolvedValue([
      {
        id: 'desc-en',
        dimensao: 'EN - Ensino',
        origemRecurso: 'Tesouro',
        valor: 50,
        createdAt: new Date('2026-01-10'),
        updatedAt: new Date('2026-01-10'),
      },
    ]);

    mockedContratosService.getContratos.mockResolvedValue([]);
    mockedContratosService.getContratosEmpenhos.mockResolvedValue([]);
    mockedCreditosService.getAll.mockResolvedValue([]);
    mockedContaDescentralizacoesService.getAll.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('carrega os datasets principais e calcula os indicadores derivados ignorando empenhos cancelados', async () => {
    const { result } = renderHook(() => useData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockedAtividadesService.getAll).toHaveBeenCalledTimes(1);
    expect(mockedEmpenhosService.getAll).toHaveBeenCalledTimes(1);
    expect(mockedDescentralizacoesService.getAll).toHaveBeenCalledTimes(1);
    expect(mockedContratosService.getContratos).toHaveBeenCalledTimes(1);
    expect(mockedContratosService.getContratosEmpenhos).toHaveBeenCalledTimes(1);
    expect(mockedCreditosService.getAll).toHaveBeenCalledTimes(1);
    expect(mockedContaDescentralizacoesService.getAll).toHaveBeenCalledTimes(1);

    expect(result.current.atividades).toHaveLength(2);
    expect(result.current.empenhos).toHaveLength(2);
    expect(result.current.descentralizacoes).toHaveLength(1);

    expect(result.current.getTotalPlanejado()).toBe(200);
    expect(result.current.getTotalEmpenhado()).toBe(30);
    expect(result.current.getTotalDescentralizado()).toBe(50);
    expect(result.current.getADescentralizar()).toBe(150);
    expect(result.current.getSaldoTotal()).toBe(170);

    expect(result.current.getResumoOrcamentario()).toEqual([
      {
        dimensao: 'EN - Ensino',
        origemRecurso: 'Tesouro',
        valorPlanejado: 120,
        valorEmpenhado: 30,
        saldoDisponivel: 90,
        percentualExecutado: 25,
      },
      {
        dimensao: 'AD - Administracao',
        origemRecurso: 'Tesouro',
        valorPlanejado: 80,
        valorEmpenhado: 0,
        saldoDisponivel: 80,
        percentualExecutado: 0,
      },
    ]);
  });
});
