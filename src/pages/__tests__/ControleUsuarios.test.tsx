import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import ControleUsuarios from '@/pages/ControleUsuarios';
import { listAdminUsersState, upsertUserGroup } from '@/services/userAdmin';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/userAdmin', () => ({
  createDirectUser: vi.fn(),
  inviteAdminUser: vi.fn(),
  listAdminUsersState: vi.fn(),
  setAdminUserGroups: vi.fn(),
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
    vi.mocked(upsertUserGroup).mockReset();
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
});
