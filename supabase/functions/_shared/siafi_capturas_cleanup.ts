// Limpeza diária das capturas do printup (bucket siafi-capturas + extension_siafi_uploads).
// Os PDFs só existem para chegar ao upload do SUAP no mesmo dia; tudo anterior ao dia corrente sai.

export const SIAFI_CAPTURAS_BUCKET = 'siafi-capturas';

type Result<T> = { data: T | null; error: unknown };

export interface SiafiCapturasCleanupStore {
  candidates: (cutoff: string, limit: number) => Promise<Result<Array<{ name: string }>>>;
  remove: (paths: string[]) => Promise<Result<unknown>>;
  deleteRows: (cutoff: string) => Promise<Result<unknown> & { count?: number | null }>;
}

export interface SiafiCapturasCleanupSummary {
  cutoff: string;
  deletedObjects: number;
  deletedRows: number;
  failedBatches: number;
}

// Brasília não tem horário de verão desde 2019: o dia local começa às 03:00 UTC.
export function startOfBrasiliaDay(now: Date = new Date()): Date {
  const local = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 3));
}

export async function runSiafiCapturasCleanup(
  store: SiafiCapturasCleanupStore,
  { now = new Date(), batchSize = 100, maxBatches = 50 }: { now?: Date; batchSize?: number; maxBatches?: number } = {},
): Promise<SiafiCapturasCleanupSummary> {
  const cutoff = startOfBrasiliaDay(now).toISOString();
  let deletedObjects = 0;
  let failedBatches = 0;
  // Arquivos primeiro (inclusive órfãos sem linha); uma falha do Storage fica para a próxima execução.
  for (let batch = 0; batch < maxBatches; batch++) {
    const { data, error } = await store.candidates(cutoff, batchSize);
    if (error) throw error;
    const paths = (data || []).map((item) => item.name).filter(Boolean);
    if (!paths.length) break;
    const removed = await store.remove(paths);
    if (removed.error) {
      failedBatches += 1;
      break;
    }
    deletedObjects += paths.length;
    if (paths.length < batchSize) break;
  }
  const rows = await store.deleteRows(cutoff);
  if (rows.error) throw rows.error;
  return { cutoff, deletedObjects, deletedRows: rows.count ?? 0, failedBatches };
}
