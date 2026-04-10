import { FunctionsHttpError } from '@supabase/supabase-js';

import { getSupabaseAccessToken } from '@/lib/supabaseFunctionAuth';
import { supabase } from '@/lib/supabase';

export type InviteUserInput = {
  email: string;
  redirectTo: string;
};

export type InviteUserResult = {
  invitedEmail: string;
  inviterEmail: string;
};

export async function inviteUserByEmail(input: InviteUserInput) {
  const accessToken = await getSupabaseAccessToken(
    'Sessao ausente. Faca login novamente para enviar convites.',
  );

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
