import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import RequisicaoCompraPage from '@/pages/RequisicaoCompra';
import { contratosApiService } from '@/services/contratosApi';
import { requisicoesCompraService } from '@/services/requisicoesCompra';
import { transparenciaService } from '@/services/transparencia';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/contexts/DataContext', () => ({
  useData: vi.fn(),
}));

vi.mock('@/services/requisicoesCompra', () => ({
  requisicoesCompraService: {
    listRecentRequisicoes: vi.fn(),
    listPermissions: vi.fn(),
    getReviewItemReservations: vi.fn(),
    getRequisicaoById: vi.fn(),
  },
}));

vi.mock('@/components/HeaderParts', () => ({
  HeaderSubtitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/services/contratosApi', () => ({
  contratosApiService: {
    getContratosApi: vi.fn(),
    getContratoApiDetails: vi.fn(),
    getLiquidacoesPublicasPorEmpenho: vi.fn(),
  },
}));
vi.mock('@/services/transparencia', () => ({
  transparenciaService: {
    getItensEmpenhoPortal: vi.fn(),
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseData = vi.mocked(useData);
const mockedService = vi.mocked(requisicoesCompraService);
const mockedContratosApiService = vi.mocked(contratosApiService);
const mockedTransparenciaService = vi.mocked(transparenciaService);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RequisicaoCompraPage />
    </QueryClientProvider>,
  );
}

describe('RequisicaoCompraPage', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
      configurable: true,
      value: vi.fn(() => false),
    });
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    vi.clearAllMocks();

    mockedUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        email: 'admin@ifrn.edu.br',
        user_metadata: { matricula: '000001' },
      },
      userGroups: [{ slug: 'diretores' }],
      isSuperAdmin: true,
    } as never);

    mockedUseData.mockReturnValue({
      empenhos: [],
      contratos: [],
      contratosEmpenhos: [],
    } as never);

    mockedService.listRecentRequisicoes.mockResolvedValue([]);
    mockedService.listPermissions.mockResolvedValue([]);
    mockedService.getReviewItemReservations.mockResolvedValue({});
    mockedContratosApiService.getLiquidacoesPublicasPorEmpenho.mockResolvedValue([]);
    mockedTransparenciaService.getItensEmpenhoPortal.mockResolvedValue([]);
    mockedService.getReviewItemReservations.mockResolvedValue({});
    mockedContratosApiService.getLiquidacoesPublicasPorEmpenho.mockResolvedValue([]);
    mockedTransparenciaService.getItensEmpenhoPortal.mockResolvedValue([]);
  });

  it('nao exibe mais a gestao administrativa de vinculos de terceirizados', async () => {
    renderPage();

    expect(await screen.findByRole('button', { name: /Nova Requisição de Compra/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gerenciar Vínculos de Terceirizados/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Vincular Contratos e Empenhos/i)).not.toBeInTheDocument();
  });

  it('exibe requisicoes em tabela em vez de cards', async () => {
    mockedService.listRecentRequisicoes.mockResolvedValue([
      {
        id: 'req-1',
        title: 'Compra de insumos',
        number: 'REQ-2026-0001',
        status: 'review',
        createdBy: 'terceirizado-1',
        createdByEmail: 'terceirizado@ifrn.edu.br',
        empenhoId: 'emp-83',
        empenhoNumero: '2025NE000083',
        contratoId: 'contrato-1',
        contratoNumero: '00329/2025',
        processNumber: '23035.000001/2026-01',
        notes: 'Pedido de teste',
        createdAt: new Date('2026-07-28T10:00:00Z'),
        updatedAt: new Date('2026-07-28T10:00:00Z'),
      },
    ] as never);

    renderPage();

    const table = await screen.findByRole('table');
    expect(within(table).getByRole('columnheader', { name: /Situação/i })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: /Requisição/i })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: /Referências/i })).toBeInTheDocument();
    expect(within(table).getByText('REQ-2026-0001')).toBeInTheDocument();
    expect(within(table).getByText('Em Revisão')).toBeInTheDocument();
    expect(within(table).getByText('2025NE000083')).toBeInTheDocument();
    expect(within(table).getByText('00329/2025')).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: /Visualizar e editar requisição REQ-2026-0001/i })).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: /Aprovar requisição REQ-2026-0001/i })).toBeInTheDocument();
    expect(within(table).queryAllByRole('row')).toHaveLength(2);
  });

  it('restaura item da NE sem exigir contrato na edicao', async () => {
    mockedUseData.mockReturnValue({
      empenhos: [
        {
          id: 'emp-83',
          numero: '2026NE000083',
          descricao: 'Compra de alimentos',
          valor: 1000,
          dimensao: '',
          componenteFuncional: '',
          origemRecurso: '',
          naturezaDespesa: '',
          tipo: 'exercicio',
          status: 'pendente',
          dataEmpenho: new Date('2026-07-01T12:00:00Z'),
          createdAt: new Date('2026-07-01T12:00:00Z'),
          updatedAt: new Date('2026-07-01T12:00:00Z'),
        },
      ],
      contratos: [],
      contratosEmpenhos: [],
    } as never);
    mockedService.listRecentRequisicoes.mockResolvedValue([
      {
        id: 'req-1',
        title: 'Compra de alimentos',
        number: 'REQ-2026-0001',
        status: 'draft',
        createdBy: 'admin-1',
        createdByEmail: 'admin@ifrn.edu.br',
        empenhoId: 'emp-83',
        empenhoNumero: '2026NE000083',
        createdAt: new Date('2026-07-01T12:00:00Z'),
        updatedAt: new Date('2026-07-01T12:00:00Z'),
      },
    ] as never);
    mockedService.getRequisicaoById.mockResolvedValue({
      id: 'req-1',
      title: 'Compra de alimentos',
      number: 'REQ-2026-0001',
      status: 'draft',
      createdBy: 'admin-1',
      createdByEmail: 'admin@ifrn.edu.br',
      empenhoId: 'emp-83',
      empenhoNumero: '2026NE000083',
      createdAt: new Date('2026-07-01T12:00:00Z'),
      updatedAt: new Date('2026-07-01T12:00:00Z'),
      items: [
        {
          id: 'item-1',
          requisicaoCompraId: 'req-1',
          description: 'ARROZ BENEFICIADO TIPO 1',
          quantity: 2,
          unit: 'UN',
          unitPrice: 50,
          sourceType: 'portal_transparencia_empenho_item',
          sourceItemKey: '2026NE000083|158366264352026NE000083|1',
          sourceReference: '30 - MATERIAL DE CONSUMO',
          sourceSnapshot: { saldoItem: 100 },
          sortOrder: 0,
          createdAt: new Date('2026-07-01T12:00:00Z'),
          updatedAt: new Date('2026-07-01T12:00:00Z'),
        },
      ],
    } as never);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Editar requisição REQ-2026-0001/i }));

    expect(await screen.findByDisplayValue('ARROZ BENEFICIADO TIPO 1')).toBeDisabled();
    expect(screen.getByText('Itens do empenho')).toBeInTheDocument();
    expect(screen.getByText('Subitem da NE')).toBeInTheDocument();
    expect(screen.getByText('30 - MATERIAL DE CONSUMO')).toBeInTheDocument();
  });
});
