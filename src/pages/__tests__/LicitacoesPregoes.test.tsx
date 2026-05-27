import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LicitacoesPregoes from '@/pages/LicitacoesPregoes';
import { licitacoesPncpService } from '@/services/licitacoesPncp';

vi.mock('@/components/HeaderParts', () => ({
  HeaderActions: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HeaderSubtitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/services/licitacoesPncp', async () => {
  const actual = await vi.importActual<typeof import('@/services/licitacoesPncp')>('@/services/licitacoesPncp');
  return {
    ...actual,
    licitacoesPncpService: {
      list: vi.fn(),
      listUasgs: vi.fn(),
      listSituacoes: vi.fn(),
      getLastSyncRun: vi.fn(),
      sync: vi.fn(),
      syncInternalUasgs: vi.fn(),
    },
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const mockedService = vi.mocked(licitacoesPncpService);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <MemoryRouter initialEntries={['/licitacoes-pregoes']}>
      <QueryClientProvider client={queryClient}>
        <LicitacoesPregoes />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const licitacao = {
  id: 'lic-1',
  numeroControlePncp: '10877412000168-1-000198/2025',
  cnpjOrgao: '10877412000168',
  razaoSocialOrgao: 'IFRN',
  anoCompra: 2025,
  sequencialCompra: 198,
  numeroCompra: '90001',
  processo: '23035001765202521',
  objetoCompra: 'Servicos de combustiveis para o campus',
  modalidadeId: 6,
  modalidadeNome: 'Pregao - Eletronico',
  modoDisputaId: 1,
  modoDisputaNome: 'Aberto',
  situacaoCompraId: 1,
  situacaoCompraNome: 'Divulgada no PNCP',
  uasgCodigo: '158366',
  uasgNome: 'CAMPUS CURRAIS NOVOS',
  unidadeUf: 'RN',
  unidadeMunicipio: 'Currais Novos',
  unidadeCodigoIbge: '2403103',
  valorTotalEstimado: 275841.38,
  valorTotalHomologado: 264108.29,
  srp: true,
  dataPublicacaoPncp: '2025-09-16T07:18:24.000Z',
  dataAberturaProposta: '2025-10-02T08:00:00.000Z',
  dataEncerramentoProposta: '2025-10-16T09:00:00.000Z',
  dataInclusao: '2025-09-16T07:18:24.000Z',
  dataAtualizacao: '2025-10-02T07:35:50.000Z',
  dataAtualizacaoGlobal: '2025-10-28T20:51:58.000Z',
  amparoLegalCodigo: 1,
  amparoLegalNome: 'Lei 14.133/2021, Art. 28, I',
  amparoLegalDescricao: null,
  tipoInstrumentoConvocatorioCodigo: 1,
  tipoInstrumentoConvocatorioNome: 'Edital',
  usuarioNome: 'Compras.gov.br',
  informacaoComplementar: 'Retirada do edital nos portais oficiais.',
  linkSistemaOrigem: 'https://compras.gov.br/compra',
  linkProcessoEletronico: null,
  rawData: {},
  comprasGovData: {},
  updatedAt: '2026-05-04T12:00:00.000Z',
};

describe('LicitacoesPregoes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedService.list.mockResolvedValue({ rows: [licitacao], count: 1 });
    mockedService.listUasgs.mockResolvedValue([{ codigo: '158366', nome: 'CAMPUS CURRAIS NOVOS' }]);
    mockedService.listSituacoes.mockResolvedValue(['Divulgada no PNCP']);
    mockedService.getLastSyncRun.mockResolvedValue({
      id: 'run-1',
      startedAt: '2026-05-04T10:00:00.000Z',
      finishedAt: '2026-05-04T10:05:00.000Z',
      status: 'success',
      cnpjOrgao: '10877412000168',
      unidadeCodigos: ['158366'],
      dataInicial: '2025-05-05',
      dataFinal: '2026-05-04',
      modalidadeId: 6,
      totalWindows: 1,
      totalFetched: 1,
      totalUpserted: 1,
      errorMessage: null,
      details: {},
    });
    mockedService.sync.mockResolvedValue({
      runId: 'run-2',
      status: 'success',
      fetched: 1,
      uniqueRows: 1,
      upserted: 1,
    });
    mockedService.syncInternalUasgs.mockResolvedValue({
      runId: 'run-3',
      status: 'success',
      fetched: 2,
      uniqueRows: 2,
      upserted: 2,
    });
  });

  it('lista pregoes e abre drawer de detalhes', async () => {
    renderPage();

    expect(await screen.findByText('Servicos de combustiveis para o campus')).toBeInTheDocument();
    expect(screen.getByText('10877412000168-1-000198/2025')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Detalhar/i }));

    expect(await screen.findByText('Retirada do edital nos portais oficiais.')).toBeInTheDocument();
    expect(screen.getByText('Lei 14.133/2021, Art. 28, I')).toBeInTheDocument();
  });

  it('busca no PNCP pela UASG e periodo informados', async () => {
    renderPage();

    expect(await screen.findByRole('button', { name: /Buscar PNCP/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Buscar PNCP/i }));

    await waitFor(() => {
      expect(mockedService.sync).toHaveBeenCalledWith(expect.objectContaining({
        unidadeCodigos: ['158366'],
        source: 'frontend-search',
      }));
    });
  });

  it('permite sincronizar UASG digitada com filtro de objeto', async () => {
    renderPage();

    fireEvent.change(await screen.findByLabelText('UASG'), {
      target: { value: '158155' },
    });
    fireEvent.change(screen.getByLabelText('Objeto especifico'), {
      target: { value: 'energia eletrica' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Buscar PNCP/i }));

    await waitFor(() => {
      expect(mockedService.sync).toHaveBeenCalledWith(expect.objectContaining({
        unidadeCodigos: ['158155'],
        objetoBusca: 'energia eletrica',
      }));
    });
  });

  it('sincroniza catalogo interno de UASGs IFRN no periodo atual', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Sincronizar UASGs IFRN/i }));

    await waitFor(() => {
      expect(mockedService.syncInternalUasgs).toHaveBeenCalledWith(expect.objectContaining({
        source: 'frontend-ifrn-cache',
      }));
    });
  });
});
