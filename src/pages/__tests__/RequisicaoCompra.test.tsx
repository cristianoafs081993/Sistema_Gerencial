import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import RequisicaoCompraPage from '@/pages/RequisicaoCompra';
import { requisicoesCompraService } from '@/services/requisicoesCompra';

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
  },
}));

vi.mock('@/components/HeaderParts', () => ({
  HeaderSubtitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/services/contratosApi', () => ({
  contratosApiService: {
    getContratosApi: vi.fn(),
    getContratoApiDetails: vi.fn(),
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseData = vi.mocked(useData);
const mockedService = vi.mocked(requisicoesCompraService);

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
  });

  it('nao exibe mais a gestao administrativa de vinculos de terceirizados', async () => {
    renderPage();

    expect(await screen.findByRole('button', { name: /Nova Requisição de Compra/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gerenciar Vínculos de Terceirizados/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Vincular Contratos e Empenhos/i)).not.toBeInTheDocument();
  });
});