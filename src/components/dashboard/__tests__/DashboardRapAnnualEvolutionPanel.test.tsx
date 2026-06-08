import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '@/contexts/AuthContext';
import { DashboardRapAnnualEvolutionPanel } from '@/components/dashboard/DashboardRapAnnualEvolutionPanel';
import { rapHistoricoAnualService } from '@/services/rapHistoricoAnual';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div data-testid="responsive-chart">{children}</div>,
  ComposedChart: ({ children }: { children: ReactNode }) => <div data-testid="composed-chart">{children}</div>,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Bar: ({ name, hide }: { name: string; hide?: boolean }) => !hide ? <span data-testid="chart-series">{name}</span> : null,
  Line: ({ name, hide }: { name: string; hide?: boolean }) => !hide ? <span data-testid="chart-series">{name}</span> : null,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/services/rapHistoricoAnual', () => ({
  parseRapHistoricoAnualFile: vi.fn(),
  rapHistoricoAnualService: {
    getLatestReport: vi.fn(),
    importReport: vi.fn(),
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedService = vi.mocked(rapHistoricoAnualService);

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardRapAnnualEvolutionPanel />
    </QueryClientProvider>,
  );
}

describe('DashboardRapAnnualEvolutionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({ isSuperAdmin: true } as never);
    mockedService.getLatestReport.mockResolvedValue({
      sourceFile: 'historico-rap.csv',
      importedAt: '2026-06-02T12:00:00.000Z',
      rows: [
        {
          id: 'row-1',
          ugExecutora: '158366',
          ugNome: 'Campus Currais Novos',
          ano: 2024,
          metrica: 'Saldo',
          itemInformacaoCodigo: '35',
          itemInformacaoNome: 'RESTOS A PAGAR PROCESSADOS INSCRITOS',
          valor: 100,
          importBatchId: 'batch-1',
          sourceFile: 'historico-rap.csv',
          importedAt: '2026-06-02T12:00:00.000Z',
        },
        {
          id: 'row-2',
          ugExecutora: '158366',
          ugNome: 'Campus Currais Novos',
          ano: 2024,
          metrica: 'Saldo',
          itemInformacaoCodigo: '40',
          itemInformacaoNome: 'RESTOS A PAGAR NAO PROCESSADOS INSCRITOS',
          valor: 300,
          importBatchId: 'batch-1',
          sourceFile: 'historico-rap.csv',
          importedAt: '2026-06-02T12:00:00.000Z',
        },
        {
          id: 'row-3',
          ugExecutora: '158366',
          ugNome: 'Campus Currais Novos',
          ano: 2024,
          metrica: 'Saldo',
          itemInformacaoCodigo: '41',
          itemInformacaoNome: 'RESTOS A PAGAR NAO PROCESSADOS REINSCRITOS',
          valor: 50,
          importBatchId: 'batch-1',
          sourceFile: 'historico-rap.csv',
          importedAt: '2026-06-02T12:00:00.000Z',
        },
        {
          id: 'row-4',
          ugExecutora: '158366',
          ugNome: 'Campus Currais Novos',
          ano: 2024,
          metrica: 'Saldo',
          itemInformacaoCodigo: '50',
          itemInformacaoNome: 'RESTOS A PAGAR INSCRITOS (PROC E N PROC)',
          valor: 500,
          importBatchId: 'batch-1',
          sourceFile: 'historico-rap.csv',
          importedAt: '2026-06-02T12:00:00.000Z',
        },
      ],
    });
  });

  it('mostra estado vazio ate selecionar uma UG e renderiza a evolucao anual', async () => {
    renderPanel();

    expect(await screen.findByText(/Selecione uma UG/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('combobox', { name: /Selecionar UG/i }));
    fireEvent.click(await screen.findByRole('option', { name: /158366 - Campus Currais Novos/i }));

    expect(await screen.findByTestId('composed-chart')).toBeInTheDocument();
    expect(screen.getAllByTestId('chart-series').map((item) => item.textContent)).toEqual([
      'Processado inscrito',
      'Não processado inscrito',
      'Não processado reinscrito',
      'Total',
    ]);

    const row = screen.getByRole('row', { name: /2024/i });
    expect(within(row).getByText('R$ 500,00')).toBeInTheDocument();
  });

  it('oculta importacao para usuario que nao e superadmin', async () => {
    mockedUseAuth.mockReturnValue({ isSuperAdmin: false } as never);
    renderPanel();

    expect(await screen.findByText(/Selecione uma UG/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Importar histórico RAP/i })).not.toBeInTheDocument();
  });

  it('permite filtrar as séries do gráfico ao clicar nos botões da legenda (inclusive Alt/Shift-Click para isolar)', async () => {
    renderPanel();

    const combobox = await screen.findByRole('combobox', { name: /Selecionar UG/i });
    fireEvent.click(combobox);
    fireEvent.click(await screen.findByRole('option', { name: /158366 - Campus Currais Novos/i }));

    // Garante que o gráfico está renderizado
    expect(await screen.findByTestId('composed-chart')).toBeInTheDocument();

    const getVisibleSeries = () =>
      screen.queryAllByTestId('chart-series').map((item) => item.textContent);

    // Inicialmente todas estão visíveis
    expect(getVisibleSeries()).toEqual([
      'Processado inscrito',
      'Não processado inscrito',
      'Não processado reinscrito',
      'Total',
    ]);

    // 1. Clique simples no 'Total': deve alternar (esconder) o Total
    const btnTotal = screen.getByRole('button', { name: /^Total$/i });
    fireEvent.click(btnTotal);
    expect(getVisibleSeries()).toEqual([
      'Processado inscrito',
      'Não processado inscrito',
      'Não processado reinscrito',
    ]);

    // 2. Outro clique simples no 'Total': deve alternar de volta (mostrar) o Total
    fireEvent.click(btnTotal);
    expect(getVisibleSeries()).toEqual([
      'Processado inscrito',
      'Não processado inscrito',
      'Não processado reinscrito',
      'Total',
    ]);

    // 3. Alt+Clique no 'Total': deve isolar o Total (só ele fica visível)
    fireEvent.click(btnTotal, { altKey: true });
    expect(getVisibleSeries()).toEqual(['Total']);

    // 4. Clique simples em 'Processado inscrito': deve adicionar à seleção ativa
    const btnProc = screen.getByRole('button', { name: /^Processado inscrito$/i });
    fireEvent.click(btnProc);
    expect(getVisibleSeries()).toEqual([
      'Processado inscrito',
      'Total',
    ]);

    // 5. Clique simples no único ativo restante após remoção: deve restaurar todos
    // Desativa 'Total' deixando apenas 'Processado inscrito' ativo
    fireEvent.click(btnTotal);
    expect(getVisibleSeries()).toEqual(['Processado inscrito']);

    // Clica de novo no único ativo 'Processado inscrito' -> deve resetar e ativar todos
    fireEvent.click(btnProc);
    expect(getVisibleSeries()).toEqual([
      'Processado inscrito',
      'Não processado inscrito',
      'Não processado reinscrito',
      'Total',
    ]);
  });
});
