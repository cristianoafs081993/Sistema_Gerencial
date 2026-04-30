import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const getUser = vi.fn();
const refreshSession = vi.fn();
const invoke = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession,
      getUser,
      refreshSession,
    },
    functions: {
      invoke,
    },
  },
}));

describe('userAdmin service', () => {
  beforeEach(() => {
    getSession.mockReset();
    getUser.mockReset();
    refreshSession.mockReset();
    invoke.mockReset();
  });

  it('envia e-mail, grupo e acao de criacao direta para a edge function', async () => {
    getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-123',
        },
      },
      error: null,
    });
    getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
        },
      },
      error: null,
    });
    invoke.mockResolvedValue({
      data: {
        users: [],
        groups: [],
        screens: [],
        screenGroups: [],
      },
      error: null,
    });

    const { createDirectUser } = await import('@/services/userAdmin');

    await createDirectUser({ email: 'diretor@ifrn.edu.br', groupId: 'grupo-diretores' });

    expect(invoke).toHaveBeenCalledWith('admin-users', {
      body: {
        action: 'create-user',
        email: 'diretor@ifrn.edu.br',
        groupId: 'grupo-diretores',
      },
      headers: {
        Authorization: 'Bearer token-123',
      },
    });
  });

  it('falha cedo quando nao existe sessao ativa', async () => {
    getSession.mockResolvedValue({
      data: {
        session: null,
      },
      error: null,
    });

    const { listAdminUsersState } = await import('@/services/userAdmin');

    await expect(listAdminUsersState()).rejects.toThrow('Sessão ausente. Faça login novamente para administrar usuários.');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('renova a sessao antes de chamar a edge function quando o token atual expirou', async () => {
    getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'expired-token',
        },
      },
      error: null,
    });
    getUser.mockResolvedValue({
      data: {
        user: null,
      },
      error: new Error('JWT expired'),
    });
    refreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'fresh-token',
        },
      },
      error: null,
    });
    invoke.mockResolvedValue({
      data: {
        users: [],
        groups: [],
        screens: [],
        screenGroups: [],
      },
      error: null,
    });

    const { upsertUserGroup } = await import('@/services/userAdmin');

    await upsertUserGroup({
      id: 'grupo-diretores',
      name: 'Diretores',
      screenIds: ['dashboard'],
    });

    expect(refreshSession).toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith('admin-users', {
      body: {
        action: 'upsert-group',
        id: 'grupo-diretores',
        name: 'Diretores',
        screenIds: ['dashboard'],
      },
      headers: {
        Authorization: 'Bearer fresh-token',
      },
    });
  });
});
