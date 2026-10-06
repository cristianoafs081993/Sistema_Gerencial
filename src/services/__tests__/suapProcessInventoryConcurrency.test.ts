// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
import { suapScraperService } from '@/services/suapScraperService';

type Row = { id: string; tenant_id: string; suap_id: string; status: string; pdf_url: string | null; num_processo?: string };
function inventoryClient(initial: Row[] = []) {
  const rows = new Map(initial.map(row => [`${row.tenant_id}:${row.suap_id}`, row]));
  const writes: Array<{ payload: Row; options: unknown }> = [];
  const client = { from: vi.fn(() => {
    const filters: Record<string, string> = {};
    let payload: Row | undefined;
    const resolve = () => {
      if (payload) {
        const key = `${payload.tenant_id}:${payload.suap_id}`;
        if (rows.has(key)) return { data: null, error: null };
        const saved = { ...payload, id: `process-${rows.size + 1}`, pdf_url: null };
        rows.set(key, saved);
        return { data: saved, error: null };
      }
      const matches = [...rows.values()].filter(row => Object.entries(filters).every(([key, value]) => row[key as keyof Row] === value));
      return { data: matches, error: null };
    };
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((key: string, value: string) => { filters[key] = value; return builder; }),
      upsert: vi.fn((value: Row, options: unknown) => { payload = value; writes.push({ payload: value, options }); return builder; }),
      maybeSingle: vi.fn(async () => resolve()),
      single: vi.fn(async () => { const result = resolve(); return { ...result, data: Array.isArray(result.data) ? result.data[0] : result.data }; }),
      then: (done: (value: unknown) => unknown) => Promise.resolve(resolve()).then(done),
    };
    return builder;
  }) };
  return { client: client as unknown as SupabaseClient, rows, writes };
}
const process = { suapId: '123', url: 'https://suap.ifrn.edu.br/processo_eletronico/processo/123/' };

describe('SUAP process inventory under concurrency', () => {
  it('reuses the winning row when two synchronizations insert the same process', async () => {
    const db = inventoryClient();
    const results = await Promise.all([
      suapScraperService.syncProcessListInSupabase([process], 'tenant-a', {}, db.client),
      suapScraperService.syncProcessListInSupabase([process], 'tenant-a', {}, db.client),
    ]);
    expect(db.rows.size).toBe(1);
    expect(results.map(rows => rows[0].processId)).toEqual(['process-1', 'process-1']);
    expect(results.flat().filter(row => row.created)).toHaveLength(1);
    expect(results.flat().filter(row => row.already_exists)).toHaveLength(1);
    expect(db.writes[0].options).toEqual({ onConflict: 'tenant_id,suap_id', ignoreDuplicates: true });
  });

  it('preserves existing extraction and PDF and deduplicates an input list within its tenant', async () => {
    const db = inventoryClient([{ id: 'ready', tenant_id: 'tenant-a', suap_id: '123', status: 'success', pdf_url: 'tenant-a/123.pdf' }]);
    const existing = await suapScraperService.syncProcessListInSupabase([process], 'tenant-a', {}, db.client);
    expect(existing[0]).toMatchObject({ processId: 'ready', status: 'success', pdfUrl: 'tenant-a/123.pdf', created: false });
    const other = await suapScraperService.syncProcessListInSupabase([process, process], 'tenant-b', {}, db.client);
    expect(other.map(row => row.processId)).toEqual(['process-2', 'process-2']);
    expect(db.writes).toHaveLength(1);
    expect(db.rows.get('tenant-a:123')?.status).toBe('success');
  });
});
