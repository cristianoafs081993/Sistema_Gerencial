import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const invoke = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession,
    },
    functions: {
      invoke,
    },
  },
}));

describe('userAdmin service', () => {
  beforeEach(() => {
    getSession.mockReset();
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
});
