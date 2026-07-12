import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AuthPanel } from '@/components/auth/AuthPanel';
import { useAuth } from '@/contexts/AuthContext';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockedUseAuth = vi.mocked(useAuth);

describe('AuthPanel', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      signInWithPassword: vi.fn(),
    } as never);
  });

  afterEach(() => {
    mockedUseAuth.mockReset();
  });

  it('alterna a visibilidade da senha no login', () => {
    render(
      <MemoryRouter>
        <AuthPanel title="Entrar" />
      </MemoryRouter>,
    );

    const passwordInput = screen.getByLabelText('Senha');

    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
