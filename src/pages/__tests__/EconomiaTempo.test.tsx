import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import EconomiaTempo from '@/pages/EconomiaTempo';
import { loadAutomationSavingsSummary } from '@/services/automationSavingsService';
import {
  buildAutomationSavingsRows,
  getMonthlySavingsProjectionMinutes,
  summarizeAutomationSavings,
  type AutomationSavingsScenario,
} from '@/utils/automationSavings';

vi.mock('@/components/HeaderParts', () => ({
  HeaderActions: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HeaderSubtitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Bar: () => <div />,
  CartesianGrid: () => <div />,
  Legend: () => <div />,
  Tooltip: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
}));

vi.mock('@/services/automationSavingsService', () => ({
  loadAutomationSavingsSummary: vi.fn(),
}));

const scenario: AutomationSavingsScenario = {
  id: 'relatorios-gerenciais',
  interactionName: 'Montagem de relatório gerencial',
  moduleName: 'Relatórios',
  source: 'Sistema Gerencial',
  baselineMinutes: 45,
  automatedMinutes: 5,
  estimatedMonthlyRuns: 12,
  status: 'active',
  sortOrder: 10,
};

const mockedLoadAutomationSavingsSummary = vi.mocked(loadAutomationSavingsSummary);

describe('EconomiaTempo', () => {
  beforeEach(() => {
    const rows = buildAutomationSavingsRows({
      scenarios: [scenario],
      events: [],
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    });
    const totals = summarizeAutomationSavings(rows);

    mockedLoadAutomationSavingsSummary.mockResolvedValue({
      scenarios: [scenario],
      events: [],
      rows,
      totals,
      monthlyProjectionMinutes: getMonthlySavingsProjectionMinutes(totals.totalSavedMinutes, '2026-04-01', '2026-04-30'),
      modules: ['Relatórios'],
      usedFallback: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza KPIs e a tabela de interacoes mapeadas', async () => {
    render(<EconomiaTempo />);

    await waitFor(() => {
      expect(screen.getByText('Montagem de relatório gerencial')).toBeInTheDocument();
    });

    expect(screen.getByText('Tempo economizado')).toBeInTheDocument();
    expect(screen.getByText('Projeção mensal')).toBeInTheDocument();
    expect(screen.getAllByText('Interações mapeadas').length).toBeGreaterThan(0);
    expect(screen.getByText('Sistema Gerencial')).toBeInTheDocument();
    expect(screen.getByText('Estimativa')).toBeInTheDocument();
  });
});
