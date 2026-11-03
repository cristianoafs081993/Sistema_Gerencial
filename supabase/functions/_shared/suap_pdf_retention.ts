export type Candidate = { object_id: string; object_path: string; byte_size: number };
type Result<T> = {data: T; error: {message: string} | null};
export interface RetentionStore {
  candidates(): Promise<Result<Candidate[]>>;
  claim(): Promise<Result<Candidate[]>>;
  confirm(id: string): Promise<Result<boolean>>;
  remove(path: string): Promise<Result<unknown>>;
  finish(id: string, deleted: boolean): Promise<Result<unknown>>;
}
function unwrap<T>(result: Result<T>): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export async function runSuapPdfRetention(store: RetentionStore, dryRun: boolean) {
  const rows = unwrap(await (dryRun ? store.candidates() : store.claim())) || [];
  const summary = {selected: rows.length, deleted: 0, bytes: 0, failed: 0, skipped: 0, dryRun};
  if (dryRun) return {...summary, eligibleBytes: rows.reduce((sum, row) => sum + Number(row.byte_size), 0)};
  for (const row of rows) {
    let removed = false;
    try {
      if (!unwrap(await store.confirm(row.object_id))) {
        unwrap(await store.finish(row.object_id, false));
        summary.skipped++;
        continue;
      }
      // Use Storage API: deleting storage.objects in SQL would orphan the physical file.
      unwrap(await store.remove(row.object_path));
      removed = true;
      unwrap(await store.finish(row.object_id, true));
      summary.deleted++;
      summary.bytes += Number(row.byte_size);
    } catch {
      summary.failed++;
      // After removal, keep the lease so reconciliation can repair references on restart.
      if (!removed) await store.finish(row.object_id, false).catch(() => undefined);
    }
  }
  return summary;
}
