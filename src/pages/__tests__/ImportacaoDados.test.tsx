import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ImportacaoDados from '@/pages/ImportacaoDados';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { creditosDisponiveisDetalhesService, parseCreditoDisponivelFile } from '@/services/creditosDisponiveisDetalhes';

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

  it('renderiza as três seções principais de importação (Orçamentário, Financeiro, Contratos)', () => {
    renderPage();

    expect(screen.getByText('Módulo Orçamentário')).toBeInTheDocument();
    expect(screen.getByText('Módulo Financeiro')).toBeInTheDocument();
    expect(screen.getByText('Contratos e Gestão Operacional')).toBeInTheDocument();

    expect(screen.getByText('Descentralizações de Crédito')).toBeInTheDocument();
    expect(screen.getByText('Crédito Disponível')).toBeInTheDocument();
    expect(screen.getByText('Empenhos SIAFI')).toBeInTheDocument();
    expect(screen.getByText('Financeiro (Fontes)')).toBeInTheDocument();
    expect(screen.getByText('Lista de Credores (LC)')).toBeInTheDocument();
    expect(screen.getByText('Retenções EFD-Reinf')).toBeInTheDocument();
    expect(screen.getByText('Rastreabilidade de PFs')).toBeInTheDocument();
    expect(screen.getByText('Contratos (Comprasnet)')).toBeInTheDocument();
    expect(screen.getByText('Energia Campus')).toBeInTheDocument();
  });

  it('processa reconciliação de descentralizações via handler de importação', async () => {
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
});
