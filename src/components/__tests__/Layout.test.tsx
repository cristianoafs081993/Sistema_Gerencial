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
vi.mock('@/components/suap/SuapSyncPanel', () => ({
  SuapSyncPanel: () => <div>Painel de integração SUAP</div>,
}));
vi.mock('@/components/ai/AIAssistantWidget', () => ({
  AIAssistantWidget: () => <div>assistente-gerencial-widget</div>,
}));


vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

if (typeof window !== 'undefined') {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = window.ResizeObserver || ResizeObserverMock;
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
}

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

  it('monta o widget global do assistente gerencial', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div>conteudo</div>
        </Layout>
      </MemoryRouter>,
    );

    expect(screen.getByText('assistente-gerencial-widget')).toBeInTheDocument();
  });

  it('mostra o orgao do usuario autenticado no menu do perfil', () => {
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

    fireEvent.keyDown(screen.getByRole('button', { name: 'Abrir configurações do usuário' }), { key: 'ArrowDown' });

    expect(screen.getByText('IFRN Reitoria')).toBeInTheDocument();
    expect(screen.queryByText('IFRN Campus Currais Novos')).not.toBeInTheDocument();
  });

  it('abre a configuração da integração SUAP pelo menu do usuário', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div>conteudo</div>
        </Layout>
      </MemoryRouter>,
    );

    fireEvent.keyDown(screen.getByRole('button', { name: 'Abrir configurações do usuário' }), { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('menuitem', { name: /configurar integração com o suap/i }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Configurar integração com o SUAP');
    expect(screen.getByText('Painel de integração SUAP')).toBeInTheDocument();
  });

  it('exibe a opção de padrão de design do SUAP dentro do menu do usuário', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div>conteudo</div>
        </Layout>
      </MemoryRouter>,
    );

    // Não deve haver botão avulso de tema no header
    expect(screen.queryByTitle('Alternar Tema do SUAP Design System')).not.toBeInTheDocument();

    // Abrir o menu de configurações do usuário
    fireEvent.keyDown(screen.getByRole('button', { name: 'Abrir configurações do usuário' }), { key: 'ArrowDown' });

    expect(screen.getByText('Padrão de design (SUAP)')).toBeInTheDocument();
  });

  it('permite alterar a senha pelo menu do usuário', async () => {
    updatePasswordMock.mockResolvedValue(null);

    render(
      <MemoryRouter>
        <Layout>
          <div>conteudo</div>
        </Layout>
      </MemoryRouter>,
    );

    fireEvent.keyDown(screen.getByRole('button', { name: 'Abrir configurações do usuário' }), { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('menuitem', { name: /alterar senha/i }));
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
    expect(cotacoes).not.toHaveClass('font-bold');
    expect(capacitacao).toHaveClass('font-bold');
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

  it('abre a Command Palette ao clicar no atalho do header', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div>conteudo</div>
        </Layout>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir busca e comandos/i }));

    expect(screen.getByPlaceholderText(/digite um comando/i)).toBeInTheDocument();
  });


  it('permite alternar a sidebar para o modo compacto (Rail Mode)', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div>conteudo</div>
        </Layout>
      </MemoryRouter>,
    );

    const toggleButton = screen.getByRole('button', { name: /recolher barra lateral/i });
    fireEvent.click(toggleButton);

    expect(screen.getByRole('button', { name: /expandir barra lateral/i })).toBeInTheDocument();
  });

  it('exibe o botão da central de notificações no cabeçalho e abre o popover', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div>conteudo</div>
        </Layout>
      </MemoryRouter>,
    );

    const notifButton = screen.getByRole('button', { name: /abrir central de notificações/i });
    expect(notifButton).toBeInTheDocument();

    fireEvent.click(notifButton);
    expect(screen.getByText('Notificações')).toBeInTheDocument();
    expect(screen.getByText(/eventos orçamentários/i)).toBeInTheDocument();
  });
});


