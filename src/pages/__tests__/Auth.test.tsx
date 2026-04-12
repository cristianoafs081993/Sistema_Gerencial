import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import AuthPage from '@/pages/Auth';
import { useAuth } from '@/contexts/AuthContext';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/components/auth/AuthPanel', () => ({
  AuthPanel: ({ title }: { title: string }) => <div>login-panel:{title}</div>,
}));

vi.mock('@/components/auth/SetupPasswordPanel', () => ({
  SetupPasswordPanel: ({ title }: { title: string }) => <div>setup-panel:{title}</div>,
}));

const mockedUseAuth = vi.mocked(useAuth);

const authDefaults = {
  isAccessLoading: false,
  accessError: null,
  canManageUsers: false,
  userGroups: [],
  screenAccessIds: [],
  canAccessScreen: vi.fn(() => true),
  canAccessPath: vi.fn(() => true),
};

describe('Auth page', () => {
  afterEach(() => {
    mockedUseAuth.mockReset();
  });

  it('renderiza o painel de definicao de senha ao abrir um convite autenticado', async () => {
    mockedUseAuth.mockReturnValue({
      session: { user: { id: 'invite-user', email: 'novo@ifrn.edu.br' } } as never,
      user: { id: 'invite-user', email: 'novo@ifrn.edu.br' } as never,
      isAuthenticated: true,
      isLoading: false,
      ...authDefaults,
      isSuperAdmin: false,
      canInviteUsers: false,
      signInWithPassword: vi.fn(),
      updatePassword: vi.fn(),
      requestPasswordReset: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/auth?mode=invite&next=/consultor']}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('setup-panel:Senha do primeiro acesso')).toBeInTheDocument();
  });

  it('mantem o painel de login quando nao ha sessao ativa', async () => {
    mockedUseAuth.mockReturnValue({
      session: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      ...authDefaults,
      isSuperAdmin: false,
      canInviteUsers: false,
      signInWithPassword: vi.fn(),
      updatePassword: vi.fn(),
      requestPasswordReset: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/auth']}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('login-panel:Entrar')).toBeInTheDocument();
  });
});
