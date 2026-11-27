import { getSupabaseEnv } from './env';
import { supabase } from './supabase';

type RestQueryOptions = {
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  offset?: number;
  /** Coluna de desempate para manter a ordem estável entre páginas. */
  tiebreaker?: string;
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
    const order = `${options.orderBy}.${options.ascending ? 'asc' : 'desc'}`;
    url.searchParams.set('order', options.tiebreaker ? `${order},${options.tiebreaker}.asc` : order);
  }

  if (typeof options.limit === 'number') {
    url.searchParams.set('limit', String(options.limit));
  }

  if (typeof options.offset === 'number' && options.offset > 0) {
    url.searchParams.set('offset', String(options.offset));
  }

  for (const [key, value] of Object.entries(options.filters ?? {})) {
    url.searchParams.set(key, `eq.${value}`);
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const response = await fetch(url.toString(), {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${sessionData.session?.access_token ?? supabaseAnonKey}`,
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Supabase REST request failed for ${table}: ${response.status}`);
  }

  return response.json() as Promise<T[]>;
}

/** Percorre todas as páginas do REST (limite de 1000 linhas por resposta). */
export async function fetchAllSupabaseRestRows<T>(
  table: string,
  select: string,
  options: Omit<RestQueryOptions, 'limit' | 'offset'> = {},
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await fetchSupabaseRestRows<T>(table, select, {
      tiebreaker: 'id',
      ...options,
      limit: pageSize,
      offset,
    });
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
