import { describe, expect, it, vi } from 'vitest';
import { runSiafiCapturasCleanup, startOfBrasiliaDay, type SiafiCapturasCleanupStore } from '../../../supabase/functions/_shared/siafi_capturas_cleanup';

function store(batches: string[][]): SiafiCapturasCleanupStore {
  const pending = [...batches];
  return {
    candidates: vi.fn(async () => ({ data: (pending.shift() || []).map((name) => ({ name })), error: null })),
    remove: vi.fn().mockResolvedValue({ data: [], error: null }),
    deleteRows: vi.fn().mockResolvedValue({ data: null, error: null, count: 2 }),
  };
}

describe('limpeza diária das capturas do printup', () => {
  it('corta no início do dia em Brasília, inclusive logo após a meia-noite', () => {
    expect(startOfBrasiliaDay(new Date('2026-10-23T03:05:00Z')).toISOString()).toBe('2026-10-23T03:00:00.000Z');
    expect(startOfBrasiliaDay(new Date('2026-10-23T02:59:00Z')).toISOString()).toBe('2026-10-22T03:00:00.000Z');
  });

  it('remove os arquivos pela API do Storage em lotes e depois apaga as linhas do dia anterior', async () => {
    const s = store([['a.pdf', 'b.pdf'], ['c.pdf']]);
    const summary = await runSiafiCapturasCleanup(s, { now: new Date('2026-10-23T03:05:00Z'), batchSize: 2 });
    expect(summary).toEqual({ cutoff: '2026-10-23T03:00:00.000Z', deletedObjects: 3, deletedRows: 2, failedBatches: 0 });
    expect(s.candidates).toHaveBeenCalledWith('2026-10-23T03:00:00.000Z', 2);
    expect(s.remove).toHaveBeenNthCalledWith(1, ['a.pdf', 'b.pdf']);
    expect(s.remove).toHaveBeenNthCalledWith(2, ['c.pdf']);
    expect(s.deleteRows).toHaveBeenCalledWith('2026-10-23T03:00:00.000Z');
    expect(vi.mocked(s.deleteRows).mock.invocationCallOrder[0]).toBeGreaterThan(vi.mocked(s.remove).mock.invocationCallOrder[1]);
  });

  it('falha do Storage interrompe os lotes e fica para a próxima execução', async () => {
    const s = store([['a.pdf'], ['b.pdf']]);
    vi.mocked(s.remove).mockResolvedValue({ data: null, error: { message: 'offline' } });
    await expect(runSiafiCapturasCleanup(s, { now: new Date('2026-10-23T03:05:00Z'), batchSize: 1 })).resolves.toMatchObject({ deletedObjects: 0, failedBatches: 1 });
    expect(s.remove).toHaveBeenCalledTimes(1);
  });

  it('limita o número de lotes por execução', async () => {
    const s = store(Array.from({ length: 10 }, (_, index) => [`${index}.pdf`]));
    await runSiafiCapturasCleanup(s, { batchSize: 1, maxBatches: 3 });
    expect(s.remove).toHaveBeenCalledTimes(3);
  });
});
