import { describe, expect, it, vi } from 'vitest';
import {
  cleanExpiredSuapPdfs,
  type RetentionCandidate,
  type RetentionStore,
} from '../../../supabase/functions/_shared/suap_pdf_retention';

const candidate = (name: string, size = 100, updatedAt = '2026-10-01T10:00:00Z'): RetentionCandidate => ({
  object_name: name,
  object_updated_at: updatedAt,
  object_size: size,
});

function createStore(candidates: RetentionCandidate[]) {
  const calls: string[] = [];
  const store: RetentionStore = {
    reconcile: vi.fn(async () => {
      calls.push('reconcile');
    }),
    // A chamada sem nome lista o inventario; com nome, revalida o objeto antes da remocao.
    candidates: vi.fn(async (name?: string) => (name ? candidates.filter((item) => item.object_name === name) : candidates)),
    remove: vi.fn(async (name: string) => {
      calls.push(`remove:${name}`);
    }),
    clearReference: vi.fn(async (name: string) => {
      calls.push(`clear:${name}`);
    }),
  };
  return { store, calls };
}

describe('retencao de PDFs do SUAP', () => {
  it('reconcilia antes, remove pela API do Storage e so depois limpa a referencia', async () => {
    const { store, calls } = createStore([candidate('tenant/1.pdf', 100), candidate('tenant/2.pdf', 250)]);

    await expect(cleanExpiredSuapPdfs(store)).resolves.toEqual({
      checked: 2,
      removed: 2,
      skipped: 0,
      failed: 0,
      bytes: 350,
    });
    expect(calls).toEqual([
      'reconcile',
      'remove:tenant/1.pdf',
      'clear:tenant/1.pdf',
      'remove:tenant/2.pdf',
      'clear:tenant/2.pdf',
    ]);
  });

  it('pula o objeto que deixou de ser elegivel ou foi reenviado entre o inventario e a remocao', async () => {
    const { store } = createStore([candidate('tenant/1.pdf'), candidate('tenant/2.pdf')]);
    vi.mocked(store.candidates).mockImplementation(async (name?: string) => {
      if (!name) return [candidate('tenant/1.pdf'), candidate('tenant/2.pdf')];
      if (name === 'tenant/1.pdf') return []; // passou a ser usado por uma extracao ativa
      return [candidate('tenant/2.pdf', 100, '2026-11-02T10:00:00Z')]; // novo upload no mesmo caminho
    });

    await expect(cleanExpiredSuapPdfs(store)).resolves.toMatchObject({ checked: 2, removed: 0, skipped: 2, failed: 0 });
    expect(store.remove).not.toHaveBeenCalled();
    expect(store.clearReference).not.toHaveBeenCalled();
  });

  it('mantem a referencia quando o Storage falha e segue com os demais', async () => {
    const { store } = createStore([candidate('tenant/1.pdf', 100), candidate('tenant/2.pdf', 50)]);
    vi.mocked(store.remove).mockImplementation(async (name: string) => {
      if (name === 'tenant/1.pdf') throw new Error('offline');
    });

    await expect(cleanExpiredSuapPdfs(store)).resolves.toEqual({
      checked: 2,
      removed: 1,
      skipped: 0,
      failed: 1,
      bytes: 50,
    });
    expect(store.clearReference).toHaveBeenCalledTimes(1);
    expect(store.clearReference).toHaveBeenCalledWith('tenant/2.pdf');
  });

  it('propaga a falha da reconciliacao sem remover nada', async () => {
    const { store } = createStore([candidate('tenant/1.pdf')]);
    vi.mocked(store.reconcile).mockRejectedValue(new Error('rpc indisponivel'));

    await expect(cleanExpiredSuapPdfs(store)).rejects.toThrow('rpc indisponivel');
    expect(store.remove).not.toHaveBeenCalled();
  });
});
