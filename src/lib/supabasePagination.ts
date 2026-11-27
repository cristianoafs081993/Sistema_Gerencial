/**
 * O PostgREST do Supabase devolve no máximo 1000 linhas por requisição (`max_rows`).
 * Leituras que alimentam totais (planejado, empenhado, descentralizado) precisam
 * percorrer todas as páginas; caso contrário o total sai cortado sem erro.
 */
export const SUPABASE_PAGE_SIZE = 1000;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

export async function fetchAllSupabasePages<T>(
  fetchPage: (from: number, to: number) => PageResult<T>,
  pageSize = SUPABASE_PAGE_SIZE,
): Promise<{ data: T[]; error: null } | { data: null; error: unknown }> {
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { data: null, error };

    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}
