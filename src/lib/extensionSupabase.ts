import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

import { getSupabaseEnv } from '@/lib/env';

/** Cliente descartável para uma ação iniciada pela extensão, sem refresh token. */
export function createExtensionSupabaseClient(accessToken: string): SupabaseClient {
  const { url, anonKey } = getSupabaseEnv();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export async function authenticateExtensionAccessToken(accessToken: string): Promise<{ client: SupabaseClient; user: User }> {
  if (!accessToken) throw new Error('Entre novamente pela extensão para continuar.');
  const client = createExtensionSupabaseClient(accessToken);
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) throw error ?? new Error('A sessão da extensão não pôde ser validada.');
  return { client, user: data.user };
}
