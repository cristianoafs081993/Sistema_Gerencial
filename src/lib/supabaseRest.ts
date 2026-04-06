import { getSupabaseEnv } from './env';

type RestQueryOptions = {
  orderBy?: string;
  ascending?: boolean;
};

export async function fetchSupabaseRestRows<T>(
  table: string,
  select: string,
  options: RestQueryOptions = {},
): Promise<T[]> {
  const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseEnv();

  const url = new URL(`/rest/v1/${table}`, supabaseUrl);
  url.searchParams.set('select', select);

  if (options.orderBy) {
    url.searchParams.set('order', `${options.orderBy}.${options.ascending ? 'asc' : 'desc'}`);
  }

  const response = await fetch(url.toString(), {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase REST request failed for ${table}: ${response.status}`);
  }

  return response.json() as Promise<T[]>;
}
