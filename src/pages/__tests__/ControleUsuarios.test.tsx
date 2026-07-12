import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import ControleUsuarios from '@/pages/ControleUsuarios';
import {
  createDirectUser,
  deleteAdminUser,
  listAdminUsersState,
  updateAdminUserPassword,
  upsertUserGroup,
} from '@/services/userAdmin';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/userAdmin', () => ({
  createDirectUser: vi.fn(),
  deleteAdminUser: vi.fn(),
  inviteAdminUser: vi.fn(),
  listAdminUsersState: vi.fn(),
  setAdminUserGroups: vi.fn(),
  updateAdminUserPassword: vi.fn(),
  upsertUserGroup: vi.fn(),
}));

const adminState = {
  users: [],
  groups: [
    {
      id: 'grupo-diretores',
      slug: 'diretores',
      name: 'Diretores',
      description: 'Grupo de diretores',
      isSystem: true,
      screenIds: ['dashboard'],
    },
  ],
  screens: [
    {
      id: 'dashboard',
      groupId: 'orcamentario',
      name: 'Dashboard',
      path: '/',
      sortOrder: 10,
      isAdminOnly: false,
    },
    {
      id: 'contratos',
      groupId: 'contratos',
      name: 'Contratos',
      path: '/contratos',
      sortOrder: 10,
      isAdminOnly: false,
    },
    {
      id: 'controle-usuarios',
      groupId: 'administracao',
      name: 'Controle de usuarios',
      path: '/controle-usuarios',
      sortOrder: 10,
      isAdminOnly: true,
    },
  ],
  screenGroups: [
    { id: 'orcamentario', name: 'Orcamentario', sortOrder: 10 },
    { id: 'contratos', name: 'Contratos', sortOrder: 30 },
    { id: 'administracao', name: 'Administracao', sortOrder: 90 },
  ],
};

describe('ControleUsuarios', () => {
  beforeEach(() => {
    vi.mocked(listAdminUsersState).mockReset();
    vi.mocked(createDirectUser).mockReset();
    vi.mocked(deleteAdminUser).mockReset();
    vi.mocked(updateAdminUserPassword).mockReset();
    vi.mocked(upsertUserGroup).mockReset();
  });

  it('cria usuario com senha inicial definida pelo superadmin', async () => {
    vi.mocked(listAdminUsersState).mockResolvedValue(adminState);
    vi.mocked(createDirectUser).mockResolvedValue(adminState);

    render(<ControleUsuarios />);

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('email@ifrn.edu.br')[0]).toBeInTheDocument();
    });

    fireEvent.change(screen.getAllByPlaceholderText('email@ifrn.edu.br')[0], {
      target: { value: 'diretor@ifrn.edu.br' },
    });
    fireEvent.change(screen.getByPlaceholderText('Senha inicial'), {
      target: { value: 'senha-inicial-123' },
    });
    fireEvent.change(screen.getByPlaceholderText('Confirmar senha inicial'), {
      target: { value: 'senha-inicial-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /criar/i }));

    await waitFor(() => {
      expect(createDirectUser).toHaveBeenCalledWith({
        email: 'diretor@ifrn.edu.br',
        groupId: 'grupo-diretores',
        password: 'senha-inicial-123',
      });
    });
  });

  it('seleciona o grupo padrao e permite alternar permissao clicando na linha da tela', async () => {
    vi.mocked(listAdminUsersState).mockResolvedValue(adminState);
    vi.mocked(upsertUserGroup).mockResolvedValue({
      ...adminState,
      groups: [
        {
          ...adminState.groups[0],
          screenIds: ['dashboard', 'contratos'],
        },
      ],
    });

    render(<ControleUsuarios />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Nome do grupo')).toHaveValue('Diretores');
    });

    const contratosCheckbox = screen.getByLabelText('screen-contratos');
    expect(contratosCheckbox).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(contratosCheckbox.closest('tr')!);

    expect(contratosCheckbox).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('button', { name: /salvar grupo/i }));

    await waitFor(() => {
      expect(upsertUserGroup).toHaveBeenCalledWith({
        id: 'grupo-diretores',
        name: 'Diretores',
        description: 'Grupo de diretores',
        screenIds: ['dashboard', 'contratos'],
      });
    });
  });

  it('permite ao superadmin alterar senha de usuario existente', async () => {
    const stateWithUser = {
      ...adminState,
      users: [
        {
          id: 'user-diretor',
          email: 'diretor@ifrn.edu.br',
          createdAt: '2026-07-12T00:00:00.000Z',
          lastSignInAt: null,
          usesDefaultPassword: false,
          groupIds: ['grupo-diretores'],
        },
      ],
    };
    vi.mocked(listAdminUsersState).mockResolvedValue(stateWithUser);
    vi.mocked(updateAdminUserPassword).mockResolvedValue(stateWithUser);

    render(<ControleUsuarios />);

    await waitFor(() => {
      expect(screen.getByText('diretor@ifrn.edu.br')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /alterar senha de diretor@ifrn\.edu\.br/i }));
    fireEvent.change(screen.getByPlaceholderText('Nova senha'), {
      target: { value: 'nova-senha-123' },
    });
    fireEvent.change(screen.getByPlaceholderText('Confirmar nova senha'), {
      target: { value: 'nova-senha-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /salvar senha/i }));

    await waitFor(() => {
      expect(updateAdminUserPassword).toHaveBeenCalledWith({
        userId: 'user-diretor',
        password: 'nova-senha-123',
      });
    });
  });

  it('permite ao superadmin excluir usuario existente apos confirmacao', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const stateWithUser = {
      ...adminState,
      users: [
        {
          id: 'user-diretor',
          email: 'diretor@ifrn.edu.br',
          createdAt: '2026-07-12T00:00:00.000Z',
          lastSignInAt: null,
          usesDefaultPassword: false,
          groupIds: ['grupo-diretores'],
        },
      ],
    };
    vi.mocked(listAdminUsersState).mockResolvedValue(stateWithUser);
    vi.mocked(deleteAdminUser).mockResolvedValue({
      ...stateWithUser,
      users: [],
    });

    render(<ControleUsuarios />);

    await waitFor(() => {
      expect(screen.getByText('diretor@ifrn.edu.br')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /excluir diretor@ifrn\.edu\.br/i }));

    await waitFor(() => {
      expect(deleteAdminUser).toHaveBeenCalledWith({
        userId: 'user-diretor',
        email: 'diretor@ifrn.edu.br',
      });
    });
    expect(confirmSpy).toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});
