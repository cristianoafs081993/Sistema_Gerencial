/** Stop duplicate reads against the same backend when it is unavailable. */
export function assertSupabaseReadAvailable(error: unknown): void {
  if (!error || typeof error !== 'object') return;
  const value = error as { code?: string; status?: number; message?: string };
  if (
    ['57014', 'PGRST000', 'PGRST001', 'PGRST002', 'PGRST003', '53100', '53200', '53300', '57P03'].includes(value.code ?? '') ||
    (value.status !== undefined && value.status >= 500) ||
    /time[- ]?out|timed out|failed to fetch|networkerror|upstream request|connection terminated/i.test(value.message ?? '')
  ) {
    throw error;
  }
}
