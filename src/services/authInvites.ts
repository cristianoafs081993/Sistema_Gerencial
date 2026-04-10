import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type InviteUserInput = {
  email: string;
  redirectTo: string;
};

export type InviteUserResult = {
  invitedEmail: string;
  inviterEmail: string;
};

async function getInviteAccessToken() {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session?.access_token) {
    throw new Error('Sessao ausente. Faca login novamente para enviar convites.');
  }

  const { error: userError } = await supabase.auth.getUser();
  if (!userError) {
    const {
      data: { session: refreshedSession },
    } = await supabase.auth.getSession();

    return refreshedSession?.access_token || session.access_token;
  }

  const {
    data: { session: nextSession },
    error: refreshError,
  } = await supabase.auth.refreshSession();

  if (refreshError || !nextSession?.access_token) {
    throw new Error('Sua sessao expirou. Entre novamente para enviar convites.');
  }

  return nextSession.access_token;
}

export async function inviteUserByEmail(input: InviteUserInput) {
  const accessToken = await getInviteAccessToken();

  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: input,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const rawPayload = await error.context.text();
        let message = rawPayload || 'Falha ao enviar o convite.';

        if (rawPayload) {
          try {
            const payload = JSON.parse(rawPayload) as { error?: string };
            message = payload?.error || message;
          } catch {
            message = rawPayload;
          }
        }

        throw new Error(message);
      } catch (parseError) {
        if (parseError instanceof Error) {
          throw parseError;
        }
      }
    }

    throw error;
  }

  return data as InviteUserResult;
}
