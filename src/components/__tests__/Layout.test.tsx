import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

describe('Layout', () => {
  beforeEach(() => {
    mockedToast.warning.mockReset();
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
      canAccessScreen: vi.fn(() => true),
      canAccessPath: vi.fn(() => true),
      signInWithPassword: vi.fn(),
      updatePassword: vi.fn(),
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
});
