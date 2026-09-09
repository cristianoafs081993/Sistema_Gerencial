import { getSupabaseEnv } from './env';

type RestQueryOptions = {
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  filters?: Record<string, string | number | boolean>;
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

  if (typeof options.limit === 'number') {
    url.searchParams.set('limit', String(options.limit));
  }

  for (const [key, value] of Object.entries(options.filters ?? {})) {
    url.searchParams.set(key, `eq.${value}`);
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
