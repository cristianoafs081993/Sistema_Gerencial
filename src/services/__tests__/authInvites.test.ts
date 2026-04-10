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

describe('inviteUserByEmail', () => {
  beforeEach(() => {
    getSession.mockReset();
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
});
