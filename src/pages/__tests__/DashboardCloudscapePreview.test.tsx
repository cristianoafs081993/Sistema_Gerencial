import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardCloudscapePreview from '@/pages/DashboardCloudscapePreview';
import { useData } from '@/contexts/DataContext';

vi.mock('@/contexts/DataContext', () => ({
  useData: vi.fn(),
}));

vi.mock('recharts', () => ({
  Area: () => null,
  AreaChart: () => <div data-testid="preview-area-chart" />,
  Bar: () => null,
  BarChart: () => <div data-testid="preview-bar-chart" />,
  CartesianGrid: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const mockedUseData = vi.mocked(useData);

const dataFixture = {
  atividades: [
    {
      id: 'atividade-1',
      dimensao: 'EN',
      componenteFuncional: 'Ensino',
      atividade: 'Programa de ensino',
      descricao: 'Programa de ensino',
      tipoAtividade: 'campus',
      valorTotal: 1000,
      origemRecurso: 'Tesouro',
      naturezaDespesa: '339030',
      planoInterno: 'PI-1',
      createdAt: new Date('2026-01-10'),
      updatedAt: new Date('2026-01-10'),
    },
  ],
  empenhos: [
    {
      id: 'empenho-1',
      numero: '2026NE0001',
      descricao: 'Empenho de teste',
      valor: 400,
      dimensao: 'EN',
      componenteFuncional: 'Ensino',
      origemRecurso: 'Tesouro',
      naturezaDespesa: '339030',
      tipo: 'exercicio',
      dataEmpenho: new Date('2026-01-20'),
      status: 'pendente',
      valorLiquidadoOficial: 100,
      valorPagoOficial: 50,
      createdAt: new Date('2026-01-20'),
      updatedAt: new Date('2026-01-20'),
    },
    {
      id: 'rap-1',
      numero: '2025NE0001',
      descricao: 'RAP de teste',
      valor: 250,
      dimensao: 'EN',
      componenteFuncional: 'Ensino',
      origemRecurso: 'Tesouro',
      naturezaDespesa: '339030',
      tipo: 'rap',
      rapInscrito: 250,
      saldoRapOficial: 175,
      dataEmpenho: new Date('2025-12-20'),
      status: 'pendente',
      createdAt: new Date('2025-12-20'),
      updatedAt: new Date('2025-12-20'),
    },
  ],
  descentralizacoes: [
    {
      id: 'descentralizacao-1',
      dimensao: 'EN',
      origemRecurso: 'Tesouro',
      valor: 600,
      dataEmissao: new Date('2026-01-18'),
      createdAt: new Date('2026-01-18'),
      updatedAt: new Date('2026-01-18'),
    },
  ],
  contratos: [{ id: 'contrato-1', numero: '001/2026', contratada: 'Fornecedor', created_at: new Date(), updated_at: new Date() }],
  contratosEmpenhos: [],
  contaDescentralizacoes: [],
  creditosDisponiveis: [],
  isLoading: false,
  refreshData: vi.fn().mockResolvedValue(undefined),
} as never;

describe('DashboardCloudscapePreview', () => {
  beforeEach(() => {
    mockedUseData.mockReturnValue(dataFixture);
  });

  it('exibe os KPIs calculados com dados reais do contexto', () => {
    render(
      <MemoryRouter>
        <DashboardCloudscapePreview />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Painel de governança orçamentária' })).toBeInTheDocument();
    expect(screen.getByText('dados reais do sistema')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 1.000,00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R$ 400,00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R$ 600,00').length).toBeGreaterThan(0);
  });

  it('mantém a navegação entre as visões de orçamento e RAP', () => {
    render(
      <MemoryRouter>
        <DashboardCloudscapePreview />
      </MemoryRouter>,
    );

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Restos a pagar' }), { button: 0, ctrlKey: false });

    return waitFor(() => {
      expect(screen.getByText('Base vigente')).toBeVisible();
      expect(screen.getAllByText('R$ 250,00').length).toBeGreaterThan(0);
    });
  });
});
