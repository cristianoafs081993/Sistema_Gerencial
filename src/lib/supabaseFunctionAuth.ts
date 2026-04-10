import { supabase } from '@/lib/supabase';

export async function getSupabaseAccessToken(
  missingSessionMessage = 'Sessao ausente. Faca login novamente para continuar.',
) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!session?.access_token) {
    throw new Error(missingSessionMessage);
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
    throw new Error('Sua sessao expirou. Entre novamente para continuar.');
  }

  return nextSession.access_token;
}
