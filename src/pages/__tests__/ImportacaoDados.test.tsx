import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ImportacaoDados from '@/pages/ImportacaoDados';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { creditosDisponiveisDetalhesService, parseCreditoDisponivelFile } from '@/services/creditosDisponiveisDetalhes';
import { dataImportLogsService } from '@/services/dataImportLogsService';

const testState = vi.hoisted(() => ({
  isSuperAdmin: true,
  importHandlers: new Map<string, (data: Record<string, string>[]) => void | Promise<void>>(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isSuperAdmin: testState.isSuperAdmin,
  }),
}));

vi.mock('@/contexts/DataContext', () => ({
  useData: vi.fn(),
}));

vi.mock('@/services/creditosDisponiveisDetalhes', () => ({
  creditosDisponiveisDetalhesService: {
    importReport: vi.fn(),
  },
  parseCreditoDisponivelFile: vi.fn(),
}));

vi.mock('@/services/descentralizacoesContaSaldos', () => ({
  descentralizacoesContaSaldosService: {
    upsertBatch: vi.fn(),
  },
}));

vi.mock('@/services/descentralizacoes', () => ({
  descentralizacoesService: {
    processDevolucao: vi.fn(),
  },
}));

vi.mock('@/services/dataImportLogsService', () => ({
  dataImportLogsService: {
    recordImportRunStart: vi.fn().mockResolvedValue('run-mock-123'),
    recordImportRunSuccess: vi.fn().mockResolvedValue(undefined),
    recordImportRunFailure: vi.fn().mockResolvedValue(undefined),
    fetchUnifiedObservabilityLogs: vi.fn().mockResolvedValue([
      {
        id: 'manual_1',
        timestamp: '2026-08-28T10:00:00Z',
        pipelineKey: 'descentralizacoes',
        pipelineLabel: 'Descentralizações de Crédito',
        module: 'orcamentario',
        sourceType: 'manual_upload',
        sourceName: 'NC.csv',
        status: 'success',
        rowsDetected: 10,
        rowsWritten: 10,
        rowsSkipped: 0,
        rowsUpdated: 0,
      },
    ]),
    fetchDatasetStatusMatrix: vi.fn().mockResolvedValue([
      {
        key: 'descentralizacoes',
        name: 'Descentralizações de Crédito',
        module: 'orcamentario',
        description: 'Notas de Crédito',
        supportedSources: ['manual_upload', 'email_csv'],
        lastUpdatedAt: '2026-08-28T10:00:00Z',
        lastStatus: 'success',
        lastSourceType: 'manual_upload',
        lastSourceName: 'NC.csv',
        lastErrorMessage: null,
        lastRowsCount: 10,
        hasRecentError: false,
        totalRunsCount: 1,
      },
    ]),
    fetchObservabilityStats: vi.fn().mockResolvedValue({
      totalRuns: 1,
      successCount: 1,
      failedCount: 0,
      warningCount: 0,
      skippedCount: 0,
      manualUploadsCount: 1,
      emailIngestionsCount: 0,
      apiSyncsCount: 0,
      healthyDatasetsCount: 1,
      unhealthyDatasetsCount: 0,
      lastActivityTimestamp: '2026-08-28T10:00:00Z',
    }),
  },
}));

vi.mock('@/lib/siafi-parser', () => ({
  parseSiafiCsv: vi.fn(),
  syncSiafiDataToDb: vi.fn(),
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
  HeaderSubtitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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

vi.mock('@/components/modals/ContratosSyncDialog', () => ({
  ContratosSyncDialog: () => null,
}));

vi.mock('@/components/modals/PFImportDialog', () => ({
  PFImportDialog: () => null,
}));

const mockedUseData = vi.mocked(useData);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ImportacaoDados />
    </QueryClientProvider>,
  );
}

describe('ImportacaoDados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.importHandlers.clear();
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

  it('renderiza as abas de navegação (Envio de Arquivos e Central de Observabilidade)', () => {
    renderPage();

    expect(screen.getByText(/Envio de Arquivos/i)).toBeInTheDocument();
    expect(screen.getByText(/Central de Observabilidade & Logs/i)).toBeInTheDocument();
    expect(screen.getAllByText('Módulo Orçamentário').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Módulo Financeiro').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Contratos e Gestão Operacional').length).toBeGreaterThan(0);
  });

  it('renderiza a central de observabilidade com matriz de bases e tabela de logs', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Matriz de Observabilidade e Atualização das Bases')).toBeInTheDocument();
      expect(screen.getByText('Histórico Cronológico de Ingestões e Atualizações')).toBeInTheDocument();
    });
  });

  it('processa reconciliação de descentralizações e grava o log de execução', async () => {
    const addDescentralizacao = vi.fn();
    const updateDescentralizacao = vi.fn().mockResolvedValue(undefined);

    mockedUseData.mockReturnValue({
      atividades: [],
      empenhos: [],
      descentralizacoes: [
        {
          id: 'legacy-desc',
          dataEmissao: new Date('2026-01-09'),
          origemRecurso: '231796',
          naturezaDespesa: '339000',
          planoInterno: 'L20RLP01ADN',
          valor: 10000,
          notaCredito: undefined,
          operacaoTipo: undefined,
          descricao: 'DESCENTRALIZACAO',
          dimensao: 'AD - Administração',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
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

    renderPage();

    const importHandler = Array.from(testState.importHandlers.entries()).find(([title]) =>
      title.includes('Descentralizações'),
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

    expect(dataImportLogsService.recordImportRunStart).toHaveBeenCalledWith(
      expect.objectContaining({
        pipeline: 'descentralizacoes',
      }),
    );
    expect(updateDescentralizacao).toHaveBeenCalledWith(
      'legacy-desc',
      expect.objectContaining({
        notaCredito: '2026NC000002',
      }),
    );
    expect(dataImportLogsService.recordImportRunSuccess).toHaveBeenCalledWith(
      'run-mock-123',
      expect.objectContaining({
        rowsDetected: 1,
        rowsUpdated: 1,
      }),
    );
  });

  it('processa upload de Saldo RAP passando o File para o parser e sincronizando no banco com log', async () => {
    const { parseSiafiCsv, syncSiafiDataToDb } = await import('@/lib/siafi-parser');
    vi.mocked(parseSiafiCsv).mockResolvedValue([
      {
        numeroCompleto: '158366264352024NE000010',
        numeroResumido: '2024NE000010',
        processo: '',
        favorecidoNome: '',
        favorecidoDocumento: '',
        descricao: '',
        naturezaDespesa: '',
        planoInterno: '',
        ptres: '',
        isRap: true,
        valorLiquidadoOficial: 0,
        valorPagoOficial: 0,
        valorEmpenhado: 0,
        rapInscrito: 0,
        rapALiquidar: 0,
        rapLiquidado: 0,
        rapPago: 0,
        rapAPagar: 3570,
        valorLiquidadoAPagar: 0,
        saldoRapOficial: 3570,
        rapSaldoOnly: true,
      },
    ]);
    vi.mocked(syncSiafiDataToDb).mockResolvedValue({
      atualizados: 1,
      criados: 0,
      erros: 0,
    });

    const { container } = renderPage();
    const rapInput = container.querySelector('input[type="file"][accept=".csv"]:nth-of-type(3)') as HTMLInputElement;
    expect(rapInput).toBeInTheDocument();

    const file = new File(['"NE CCor","Métrica"\n"158366264352024NE000010","Saldo","3570"'], 'saldo_rap.csv', { type: 'text/csv' });
    fireEvent.change(rapInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(parseSiafiCsv).toHaveBeenCalledWith(file);
      expect(syncSiafiDataToDb).toHaveBeenCalled();
      expect(dataImportLogsService.recordImportRunStart).toHaveBeenCalledWith(
        expect.objectContaining({
          pipeline: 'rap_saldo',
          sourceName: 'saldo_rap.csv',
        }),
      );
      expect(dataImportLogsService.recordImportRunSuccess).toHaveBeenCalledWith(
        'run-mock-123',
        expect.objectContaining({
          rowsDetected: 1,
          rowsUpdated: 1,
        }),
      );
    });
  });
});
