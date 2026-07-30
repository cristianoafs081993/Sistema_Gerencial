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

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children, ...props }: { children: ReactNode; 'aria-label'?: string }) => (
    <button type="button" role="combobox" {...props}>{children}</button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <div role="option" data-value={value}>{children}</div>
  ),
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


  it('mostra para terceirizado somente empenhos vinculados diretamente a ele', async () => {
    mockedUseAuth.mockReturnValue({
      user: {
        id: 'terceirizado-1',
        email: 'prestador@ifrn.edu.br',
        user_metadata: { matricula: '3128880' },
      },
      userGroups: [{ slug: 'terceirizado' }],
      isSuperAdmin: false,
    } as never);

    mockedUseData.mockReturnValue({
      empenhos: [
        {
          id: 'emp-direto',
          numero: '2026NE000001',
          descricao: 'Empenho permitido diretamente',
          valor: 1000,
          tipo: 'exercicio',
          status: 'pendente',
          dataEmpenho: new Date('2026-07-01T12:00:00Z'),
          createdAt: new Date('2026-07-01T12:00:00Z'),
          updatedAt: new Date('2026-07-01T12:00:00Z'),
        },
        {
          id: 'emp-contrato',
          numero: '2026NE000002',
          descricao: 'Empenho apenas vinculado ao contrato',
          valor: 2000,
          tipo: 'exercicio',
          status: 'pendente',
          dataEmpenho: new Date('2026-07-01T12:00:00Z'),
          createdAt: new Date('2026-07-01T12:00:00Z'),
          updatedAt: new Date('2026-07-01T12:00:00Z'),
        },
        {
          id: 'emp-outro',
          numero: '2026NE000003',
          descricao: 'Empenho sem vinculo',
          valor: 3000,
          tipo: 'exercicio',
          status: 'pendente',
          dataEmpenho: new Date('2026-07-01T12:00:00Z'),
          createdAt: new Date('2026-07-01T12:00:00Z'),
          updatedAt: new Date('2026-07-01T12:00:00Z'),
        },
      ],
      contratos: [
        {
          id: 'contrato-1',
          numero: '00329/2025',
          contratada: 'Fornecedor Contrato',
          objeto: 'Contrato de teste',
          valor: 1000,
          dataInicio: new Date('2026-01-01T12:00:00Z'),
          dataTermino: new Date('2026-12-31T12:00:00Z'),
          status: 'ativo',
          createdAt: new Date('2026-01-01T12:00:00Z'),
          updatedAt: new Date('2026-01-01T12:00:00Z'),
        },
      ],
      contratosEmpenhos: [{ contrato_id: 'contrato-1', empenho_id: 'emp-contrato' }],
    } as never);

    mockedService.listPermissions.mockResolvedValue([
      {
        id: 'perm-contrato',
        userId: 'terceirizado-1',
        userMatricula: '3128880',
        userEmail: 'prestador@ifrn.edu.br',
        contratoId: 'contrato-1',
        createdAt: new Date('2026-07-01T12:00:00Z'),
      },
      {
        id: 'perm-empenho',
        userId: 'terceirizado-1',
        userMatricula: '3128880',
        userEmail: 'prestador@ifrn.edu.br',
        empenhoId: 'emp-direto',
        createdAt: new Date('2026-07-01T12:00:00Z'),
      },
    ] as never);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Nova Requisi.*Compra/i }));
    fireEvent.pointerDown(screen.getByRole('combobox', { name: /Empenho/i }), { button: 0, ctrlKey: false, pointerType: 'mouse' });

    expect(await screen.findByText(/2026NE000001/)).toBeInTheDocument();
    expect(screen.queryByText(/2026NE000002/)).not.toBeInTheDocument();
    expect(screen.queryByText(/2026NE000003/)).not.toBeInTheDocument();
  });

  it('mantem gestores com acesso a todos os empenhos', async () => {
    mockedUseData.mockReturnValue({
      empenhos: [
        {
          id: 'emp-1',
          numero: '2026NE000011',
          descricao: 'Empenho 1',
          valor: 1000,
          tipo: 'exercicio',
          status: 'pendente',
          dataEmpenho: new Date('2026-07-01T12:00:00Z'),
          createdAt: new Date('2026-07-01T12:00:00Z'),
          updatedAt: new Date('2026-07-01T12:00:00Z'),
        },
        {
          id: 'emp-2',
          numero: '2026NE000012',
          descricao: 'Empenho 2',
          valor: 2000,
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

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Nova Requisi.*Compra/i }));
    fireEvent.pointerDown(screen.getByRole('combobox', { name: /Empenho/i }), { button: 0, ctrlKey: false, pointerType: 'mouse' });

    expect(await screen.findByText(/2026NE000011/)).toBeInTheDocument();
    expect(await screen.findByText(/2026NE000012/)).toBeInTheDocument();
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
