import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

type Snippets = Record<string, string>;
type Row = { snippets: Snippets; updated_at: string } | null;
type SnippetsModule = {
  SNIPPETS_KEY: string;
  STATE_KEY: string;
  signature: (snippets: unknown) => string;
  createSnippetsSync: (deps: Record<string, unknown>) => {
    reconcile: () => Promise<{ ok: boolean; skipped?: string; pushed?: boolean; pulled?: boolean; error?: string }>;
    reconcileIfStale: () => Promise<{ ok: boolean; skipped?: string }>;
  };
};

const DEFAULTS: Snippets = { '/cn': 'Currais Novos', '/ifrn': 'Instituto Federal' };
const NOW = Date.parse('2026-10-26T12:00:00Z');

function createStorage(values: Record<string, unknown>) {
  return {
    get: vi.fn(async (key: string) => (key in values ? { [key]: values[key] } : {})),
    set: vi.fn(async (entries: Record<string, unknown>) => { Object.assign(values, entries); }),
  };
}

function setup({ local, remote, state, token = 'token' }: { local: Snippets; remote: Row; state?: unknown; token?: string | null }) {
  const mod = (() => {
    const scope: Record<string, unknown> = {};
    new Function('globalThis', readFileSync(extensionFixturePath('snippets-sync.js'), 'utf8'))(scope);
    return scope.SiagesSnippetsSync as SnippetsModule;
  })();
  const syncValues: Record<string, unknown> = { [mod.SNIPPETS_KEY]: local };
  const localValues: Record<string, unknown> = state ? { [mod.STATE_KEY]: state } : {};
  let remoteRow = remote;
  const fetchRest = vi.fn(async (path: string, _token: string, options?: { method?: string; body?: string }) => {
    if (options?.method === 'POST') {
      remoteRow = { snippets: JSON.parse(options.body!).snippets, updated_at: new Date(NOW).toISOString() };
      return null;
    }
    expect(path).toContain('extension_snippets');
    return remoteRow ? [remoteRow] : [];
  });
  const api = mod.createSnippetsSync({
    syncStorage: createStorage(syncValues),
    localStorage: createStorage(localValues),
    getAccessToken: async () => token,
    fetchRest,
    defaults: DEFAULTS,
    now: () => NOW,
  });
  return { mod, api, syncValues, localValues, fetchRest, getRemote: () => remoteRow };
}

describe('snippets-sync da extensao', () => {
  it('traz para um perfil novo os atalhos personalizados guardados no SIAGES', async () => {
    const custom = { ...DEFAULTS, '/liq': 'Liquidação de despesa' };
    const ctx = setup({ local: DEFAULTS, remote: { snippets: custom, updated_at: '2026-10-25T10:00:00Z' } });
    expect(await ctx.api.reconcile()).toMatchObject({ ok: true, pulled: true, pushed: false });
    expect(ctx.syncValues[ctx.mod.SNIPPETS_KEY]).toEqual(custom);
    expect(ctx.localValues[ctx.mod.STATE_KEY]).toMatchObject({ signature: ctx.mod.signature(custom) });
  });

  it('nao troca atalhos personalizados deste perfil pelo conjunto padrao que ja estava no SIAGES', async () => {
    const custom = { ...DEFAULTS, '/liq': 'Liquidação de despesa' };
    const ctx = setup({ local: custom, remote: { snippets: DEFAULTS, updated_at: '2026-10-25T10:00:00Z' } });
    expect(await ctx.api.reconcile()).toMatchObject({ ok: true, pushed: true, pulled: false });
    expect(ctx.getRemote()?.snippets).toEqual(custom);
  });

  it('une as duas copias na primeira sincronizacao quando ambas foram personalizadas', async () => {
    const ctx = setup({ local: { '/a': 'A' }, remote: { snippets: { '/b': 'B' }, updated_at: '2026-10-25T10:00:00Z' } });
    await ctx.api.reconcile();
    expect(ctx.syncValues[ctx.mod.SNIPPETS_KEY]).toEqual({ '/a': 'A', '/b': 'B' });
    expect(ctx.getRemote()?.snippets).toEqual({ '/a': 'A', '/b': 'B' });
  });

  it('envia a edicao local e puxa a edicao remota quando so um lado mudou', async () => {
    const synced = { signature: setup({ local: DEFAULTS, remote: null }).mod.signature(DEFAULTS), syncedAt: NOW - 1000 };
    const edited = { ...DEFAULTS, '/novo': 'Texto novo' };
    const local = setup({ local: edited, remote: { snippets: DEFAULTS, updated_at: '2026-10-25T10:00:00Z' }, state: synced });
    expect(await local.api.reconcile()).toMatchObject({ pushed: true, pulled: false });
    expect(local.getRemote()?.snippets).toEqual(edited);

    const remote = setup({ local: DEFAULTS, remote: { snippets: edited, updated_at: '2026-10-25T10:00:00Z' }, state: synced });
    expect(await remote.api.reconcile()).toMatchObject({ pushed: false, pulled: true });
    expect(remote.syncValues[remote.mod.SNIPPETS_KEY]).toEqual(edited);
  });

  it('publica os atalhos quando o SIAGES ainda nao tem registro e ignora quando nao ha sessao', async () => {
    const first = setup({ local: DEFAULTS, remote: null });
    expect(await first.api.reconcile()).toMatchObject({ ok: true, pushed: true });
    expect(first.getRemote()?.snippets).toEqual(DEFAULTS);

    const anonymous = setup({ local: DEFAULTS, remote: null, token: null });
    expect(await anonymous.api.reconcile()).toEqual({ ok: false, skipped: 'sem-sessao' });
    expect(anonymous.fetchRest).not.toHaveBeenCalled();
  });

  it('consulta o servidor apenas quando a ultima sincronizacao esta velha', async () => {
    const fresh = setup({ local: DEFAULTS, remote: null, state: { signature: 'x', syncedAt: NOW - 60_000 } });
    expect(await fresh.api.reconcileIfStale()).toEqual({ ok: true, skipped: 'recente' });
    expect(fresh.fetchRest).not.toHaveBeenCalled();

    const stale = setup({ local: DEFAULTS, remote: null, state: { signature: 'x', syncedAt: NOW - 10 * 60_000 } });
    expect(await stale.api.reconcileIfStale()).toMatchObject({ ok: true, pushed: true });
  });

  it('devolve o erro da rede sem derrubar o chamador', async () => {
    const ctx = setup({ local: DEFAULTS, remote: null });
    ctx.fetchRest.mockRejectedValueOnce(new Error('offline'));
    expect(await ctx.api.reconcile()).toEqual({ ok: false, error: 'offline' });
  });
});
