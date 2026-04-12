import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
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

describe('ProtectedRoute', () => {
  afterEach(() => {
    mockedUseAuth.mockReset();
  });

  it('redireciona para /auth quando nao existe sessao', async () => {
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
      <MemoryRouter initialEntries={['/consultor']}>
        <Routes>
          <Route path="/auth" element={<div>auth-page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/consultor" element={<div>consultor-page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('auth-page')).toBeInTheDocument();
  });

  it('renderiza a rota protegida quando a sessao existe', async () => {
    mockedUseAuth.mockReturnValue({
      session: { user: { id: 'user-1', email: 'teste@ifrn.edu.br' } } as never,
      user: { id: 'user-1', email: 'teste@ifrn.edu.br' } as never,
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
      <MemoryRouter initialEntries={['/consultor']}>
        <Routes>
          <Route path="/auth" element={<div>auth-page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/consultor" element={<div>consultor-page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('consultor-page')).toBeInTheDocument();
  });

  it('bloqueia acesso direto quando o grupo nao permite a tela', async () => {
    mockedUseAuth.mockReturnValue({
      session: { user: { id: 'user-1', email: 'teste@ifrn.edu.br' } } as never,
      user: { id: 'user-1', email: 'teste@ifrn.edu.br' } as never,
      isAuthenticated: true,
      isLoading: false,
      ...authDefaults,
      canAccessPath: vi.fn(() => false),
      isSuperAdmin: false,
      canInviteUsers: false,
      signInWithPassword: vi.fn(),
      updatePassword: vi.fn(),
      requestPasswordReset: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/controle-usuarios']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/controle-usuarios" element={<div>controle-page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Acesso restrito')).toBeInTheDocument();
    expect(screen.queryByText('controle-page')).not.toBeInTheDocument();
  });
});
