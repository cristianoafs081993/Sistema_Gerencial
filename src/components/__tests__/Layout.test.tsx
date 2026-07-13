import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';

import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/components/auth/InviteUserDialog', () => ({
  InviteUserDialog: () => <button type="button">Convidar</button>,
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedToast = vi.mocked(toast);
const updatePasswordMock = vi.fn();

describe('Layout', () => {
  beforeEach(() => {
    mockedToast.warning.mockReset();
    updatePasswordMock.mockReset();
    mockedUseAuth.mockReturnValue({
      session: {
        user: {
          id: 'user-1',
          email: 'admin@ifrn.edu.br',
          user_metadata: {
            uses_default_password: true,
          },
        },
      } as never,
      user: {
        id: 'user-1',
        email: 'admin@ifrn.edu.br',
        user_metadata: {
          uses_default_password: true,
        },
      } as never,
      isAuthenticated: true,
      isLoading: false,
      isAccessLoading: false,
      accessError: null,
      isSuperAdmin: true,
      canInviteUsers: true,
      canManageUsers: true,
      userGroups: [],
      screenAccessIds: [],
      userOrg: {
        id: 'org-1',
        slug: 'ifrn-cn',
        name: 'IFRN Campus Currais Novos',
        role: 'member',
      },
      canAccessScreen: vi.fn(() => true),
      canAccessPath: vi.fn(() => true),
      signInWithPassword: vi.fn(),
      updatePassword: updatePasswordMock,
      requestPasswordReset: vi.fn(),
      signOut: vi.fn(),
    });
  });

  it('exibe aviso quando o usuario usa senha padrao', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div>conteudo</div>
        </Layout>
      </MemoryRouter>,
    );

    expect(mockedToast.warning).toHaveBeenCalledWith(
      'Sua conta foi criada com a senha padrão "ifrn". Recomenda-se trocar a senha no próximo acesso.',
    );
  });

  it('mostra o orgao do usuario autenticado na sidebar', () => {
    mockedUseAuth.mockReturnValue({
      ...mockedUseAuth(),
      userOrg: {
        id: 'org-2',
        slug: 'ifrn-reitoria',
        name: 'IFRN Reitoria',
        role: 'member',
      },
    });

    render(
      <MemoryRouter>
        <Layout>
          <div>conteudo</div>
        </Layout>
      </MemoryRouter>,
    );

    expect(screen.getByText('IFRN Reitoria')).toBeInTheDocument();
    expect(screen.queryByText('IFRN Campus Currais Novos')).not.toBeInTheDocument();
  });

  it('permite alterar a senha pelo menu do usuario', async () => {
    updatePasswordMock.mockResolvedValue(null);

    render(
      <MemoryRouter>
        <Layout>
          <div>conteudo</div>
        </Layout>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTitle('Alterar senha'));
    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'nova-senha-123' },
    });
    fireEvent.change(screen.getByLabelText('Confirmar senha'), {
      target: { value: 'nova-senha-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /salvar nova senha/i }));

    await waitFor(() => {
      expect(updatePasswordMock).toHaveBeenCalledWith('nova-senha-123');
    });
  });

  it('mostra controle de usuarios quando a tela esta permitida', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div>conteudo</div>
        </Layout>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Administração'));

    expect(screen.getByText('Controle de usuários')).toBeInTheDocument();
  });

  it('mantem a busca visual no header e expande submenus da sidebar', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div>conteudo</div>
        </Layout>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Buscar módulo'), { target: { value: 'a' } });
    fireEvent.click(screen.getByText('Planejamento'));

    expect(screen.getByText('Campus')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('exibe a biblioteca de artefatos no grupo de documentos', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div>conteudo</div>
        </Layout>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Documentos'));

    expect(screen.getByText('Artefatos de Licitação')).toBeInTheDocument();
  });

  it('exibe modulos de licitacoes no grupo de licitacoes', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div>conteudo</div>
        </Layout>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Licitações'));

    expect(screen.getByText('Pregões por UASG')).toBeInTheDocument();
    expect(screen.getByText('Atas e ARP')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Pesquisa de Preços'));
    expect(screen.getByText('Capacitação EAD')).toBeInTheDocument();
  });



  it('mantem capacitacao EAD como ultimo subitem e nao marca cotacoes quando EAD esta ativo', () => {
    render(
      <MemoryRouter initialEntries={['/pesquisa-precos/ead']}>
        <Layout>
          <div>conteudo</div>
        </Layout>
      </MemoryRouter>,
    );

    const cotacoes = screen.getByRole('link', { name: 'Cotações' });
    const cadastro = screen.getByRole('link', { name: 'Cadastro de Fornecedores' });
    const capacitacao = screen.getByRole('link', { name: 'Capacitação EAD' });

    expect(cotacoes.compareDocumentPosition(cadastro) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cadastro.compareDocumentPosition(capacitacao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cotacoes).not.toHaveClass('font-semibold');
    expect(capacitacao).toHaveClass('font-semibold');
  });

  it('exibe credito disponivel no grupo orcamentario', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div>conteudo</div>
        </Layout>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Orçamentário'));

    expect(screen.getByText('Crédito disponível')).toBeInTheDocument();
  });

  it('exibe o painel de energia na sidebar', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div>conteudo</div>
        </Layout>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Energia'));

    expect(screen.getByText('Indicadores ESG')).toBeInTheDocument();
  });

  it('mantem a ordem dos tipos do editor na sidebar', () => {
    render(
      <MemoryRouter initialEntries={['/editor-documentos/termo-referencia-compras']}>
        <Layout>
          <div>conteudo</div>
        </Layout>
      </MemoryRouter>,
    );

    expect(
      screen
        .getAllByRole('link')
        .map((link) => link.textContent)
        .filter((text) =>
          [
            'Despacho de Liquidação',
            'ETP — Serviços Contínuos',
            'Mapa de Risco',
            'Termo de Referência',
            'Contrato de Serviço IFRN',
          ].includes(text || ''),
        ),
    ).toEqual([
      'Despacho de Liquidação',
      'ETP — Serviços Contínuos',
      'Mapa de Risco',
      'Termo de Referência',
      'Contrato de Serviço IFRN',
    ]);
  });
});
