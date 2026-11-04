export type RetentionCandidate = {
  object_name: string;
  object_updated_at: string;
  object_size: number;
};

export type RetentionStore = {
  reconcile(): Promise<void>;
  candidates(name?: string): Promise<RetentionCandidate[]>;
  remove(name: string): Promise<void>;
  clearReference(name: string): Promise<void>;
};

export async function cleanExpiredSuapPdfs(store: RetentionStore) {
  await store.reconcile();
  const candidates = await store.candidates();
  let removed = 0;
  let skipped = 0;
  let failed = 0;
  let bytes = 0;

  for (const candidate of candidates) {
    try {
      // Recheck immediately before removal: a new upload or extraction may
      // have changed eligibility after the initial inventory.
      const current = (await store.candidates(candidate.object_name))[0];
      if (!current || current.object_updated_at !== candidate.object_updated_at) {
        skipped++;
        continue;
      }
      await store.remove(candidate.object_name);
      await store.clearReference(candidate.object_name);
      removed++;
      bytes += Number(candidate.object_size) || 0;
    } catch {
      failed++;
    }
  }
  return { checked: candidates.length, removed, skipped, failed, bytes };
}
