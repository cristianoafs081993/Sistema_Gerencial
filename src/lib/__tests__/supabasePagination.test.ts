// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { fetchAllSupabasePages } from '@/lib/supabasePagination';

describe('fetchAllSupabasePages', () => {
  it('junta as páginas até receber uma página incompleta', async () => {
    const fetchPage = vi.fn(async (from: number) => ({
      data: from === 0 ? [1, 2] : [3],
      error: null,
    }));

    await expect(fetchAllSupabasePages(fetchPage, 2)).resolves.toEqual({ data: [1, 2, 3], error: null });
    expect(fetchPage.mock.calls).toEqual([[0, 1], [2, 3]]);
  });

  it('devolve o erro sem resultados parciais', async () => {
    const error = { code: '57014' };
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ data: [1, 2], error: null })
      .mockResolvedValueOnce({ data: null, error });

    await expect(fetchAllSupabasePages(fetchPage, 2)).resolves.toEqual({ data: null, error });
  });
});
