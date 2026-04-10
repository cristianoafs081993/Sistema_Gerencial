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

describe('inviteUserByEmail', () => {
  beforeEach(() => {
    getSession.mockReset();
    getUser.mockReset();
    refreshSession.mockReset();
    invoke.mockReset();
  });

  it('envia o token atual na chamada da edge function', async () => {
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
          id: 'user-1',
        },
      },
      error: null,
    });
    invoke.mockResolvedValue({
      data: {
        invitedEmail: 'novo@exemplo.com',
        inviterEmail: 'cristiano.cnrn@gmail.com',
      },
      error: null,
    });

    const { inviteUserByEmail } = await import('@/services/authInvites');

    await expect(
      inviteUserByEmail({
        email: 'novo@exemplo.com',
        redirectTo: 'http://localhost:8080/auth?mode=invite',
      }),
    ).resolves.toEqual({
      invitedEmail: 'novo@exemplo.com',
      inviterEmail: 'cristiano.cnrn@gmail.com',
    });

    expect(getUser).toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith('invite-user', {
      body: {
        email: 'novo@exemplo.com',
        redirectTo: 'http://localhost:8080/auth?mode=invite',
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

    const { inviteUserByEmail } = await import('@/services/authInvites');

    await expect(
      inviteUserByEmail({
        email: 'novo@exemplo.com',
        redirectTo: 'http://localhost:8080/auth?mode=invite',
      }),
    ).rejects.toThrow('Sessao ausente. Faca login novamente para enviar convites.');

    expect(invoke).not.toHaveBeenCalled();
  });

  it('renova a sessao quando o token atual esta invalido', async () => {
    getSession
      .mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'token-expirado',
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'token-renovado',
          },
        },
        error: null,
      });
    getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Invalid JWT'),
    });
    refreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-renovado',
        },
      },
      error: null,
    });
    invoke.mockResolvedValue({
      data: {
        invitedEmail: 'novo@exemplo.com',
        inviterEmail: 'cristiano.cnrn@gmail.com',
      },
      error: null,
    });

    const { inviteUserByEmail } = await import('@/services/authInvites');

    await expect(
      inviteUserByEmail({
        email: 'novo@exemplo.com',
        redirectTo: 'http://localhost:8080/auth?mode=invite',
      }),
    ).resolves.toEqual({
      invitedEmail: 'novo@exemplo.com',
      inviterEmail: 'cristiano.cnrn@gmail.com',
    });

    expect(refreshSession).toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith('invite-user', {
      body: {
        email: 'novo@exemplo.com',
        redirectTo: 'http://localhost:8080/auth?mode=invite',
      },
      headers: {
        Authorization: 'Bearer token-renovado',
      },
    });
  });
});
