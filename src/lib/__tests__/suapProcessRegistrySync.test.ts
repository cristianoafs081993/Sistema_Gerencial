import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

type StorageValues = Record<string, unknown>;
type Listener = (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean | undefined;
type RemoteProcess = { suapId: string; processNumber: string; remote?: boolean; updatedAt: number; process: Record<string, unknown> | null; fields: unknown[] };
type RegistryModule = {
  PROFILE_KEY: string;
  REMOTE_CACHE_KEY: string;
  MAX_PAYLOAD_BYTES: number;
  buildPayload: (record: unknown) => { process: Record<string, unknown> | null; fields: unknown[] };
  mergeRemoteProcesses: (local: unknown[], remote: unknown[]) => RemoteProcess[];
  createProcessRegistrySync: (deps: {
    storage: ReturnType<typeof createStorage>;
    getAccessToken: () => Promise<string | null>;
    fetchRest: (path: string, token: string, options?: RequestInit) => Promise<unknown>;
    now?: () => number;
    timeoutMs?: number;
  }) => {
    push: (record: unknown) => Promise<{ ok: boolean; skipped?: string }>;
    remove: (record: unknown) => Promise<{ ok: boolean }>;
    fetchRemote: () => Promise<RemoteProcess[]>;
    fetchRemoteWithStatus: () => Promise<{ status: string; error?: string; processes: RemoteProcess[] }>;
    getLastPush: () => { ok: boolean; skipped: string; error: string } | null;
  };
};

const PROFILE_SIAFI = '22222222-2222-4222-8222-222222222222';
const PROFILE_SUAP = '11111111-1111-4111-8111-111111111111';
const NOW = Date.parse('2026-10-14T15:00:00Z');

function createStorage(values: StorageValues) {
  return {
    get: vi.fn(async (keys: string | string[] | null) => {
      if (keys === null) return { ...values };
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.filter((key) => key in values).map((key) => [key, values[key]]));
    }),
    set: vi.fn(async (entries: StorageValues) => { Object.assign(values, entries); }),
    remove: vi.fn(async (key: string) => { delete values[key]; }),
  };
}

function loadModule(): RegistryModule {
  const scope: Record<string, unknown> = { crypto: globalThis.crypto };
  new Function('globalThis', readFileSync(extensionFixturePath('process-registry-sync.js'), 'utf8'))(scope);
  return scope.SiagesProcessRegistrySync as RegistryModule;
}

function remoteRow(overrides: Record<string, unknown> = {}) {
  return {
    profile_id: PROFILE_SUAP,
    process_key: '495256',
    suap_id: '495256',
    process_number: '23035.002581.2026-60',
    payload: {
      process: { numProcesso: '23035.002581.2026-60', cpfCnpj: '12.345.678/0001-90', dadosCompletos: { dados_bancarios: { banco: '001' } } },
      fields: [{ label: 'Assunto', value: 'Material de TI', category: 'Processo' }],
      title: 'Processo 23035.002581.2026-60',
      url: 'https://suap.ifrn.edu.br/processo_eletronico/processo/495256/',
    },
    updated_at: '2026-10-14T14:30:00Z',
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('registro de processos compartilhado entre perfis (Alt+V)', () => {
  it('publica o processo com upsert por perfil e reutiliza o identificador do perfil', async () => {
    const mod = loadModule();
    const values: StorageValues = { [mod.PROFILE_KEY]: PROFILE_SUAP };
    const fetchRest = vi.fn().mockResolvedValue(null);
    const sync = mod.createProcessRegistrySync({ storage: createStorage(values), getAccessToken: async () => 'jwt', fetchRest, now: () => NOW });

    await expect(sync.push({ suapId: '495256', processNumber: '23035.002581.2026-60', process: { cpfCnpj: '1' }, fields: [] })).resolves.toEqual({ ok: true });

    const [path, token, options] = fetchRest.mock.calls[0];
    expect(path).toBe('extension_process_registry?on_conflict=tenant_id,profile_id,process_key');
    expect(token).toBe('jwt');
    expect(options.headers).toEqual({ Prefer: 'resolution=merge-duplicates,return=minimal' });
    expect(JSON.parse(options.body)).toMatchObject({ profile_id: PROFILE_SUAP, process_key: '495256', suap_id: '495256', process_number: '23035.002581.2026-60', payload: { process: { cpfCnpj: '1' } } });
    // A primeira publicação também limpa registros antigos do próprio perfil.
    expect(fetchRest.mock.calls[1][0]).toMatch(/^extension_process_registry\?profile_id=eq\.11111111-.*&updated_at=lt\./);
    expect(fetchRest.mock.calls[1][2]).toMatchObject({ method: 'DELETE' });
  });

  it('cria um identificador de perfil estável quando ainda não existe', async () => {
    const mod = loadModule();
    const values: StorageValues = {};
    const fetchRest = vi.fn().mockResolvedValue(null);
    const sync = mod.createProcessRegistrySync({ storage: createStorage(values), getAccessToken: async () => 'jwt', fetchRest });

    await sync.push({ suapId: '1' });
    await sync.push({ suapId: '2' });

    expect(values[mod.PROFILE_KEY]).toMatch(/^[0-9a-f-]{36}$/);
    const profiles = fetchRest.mock.calls.filter(([, , o]) => o?.method === 'POST').map(([, , o]) => JSON.parse(o.body).profile_id);
    expect(new Set(profiles)).toEqual(new Set([values[mod.PROFILE_KEY]]));
  });

  it('não publica sem sessão e evita reenviar o mesmo conteúdo em menos de um minuto', async () => {
    const mod = loadModule();
    const fetchRest = vi.fn().mockResolvedValue(null);
    let token: string | null = null;
    let clock = NOW;
    const sync = mod.createProcessRegistrySync({ storage: createStorage({ [mod.PROFILE_KEY]: PROFILE_SUAP }), getAccessToken: async () => token, fetchRest, now: () => clock });

    await expect(sync.push({ suapId: '495256' })).resolves.toEqual({ ok: false, skipped: 'sem-sessao' });
    expect(fetchRest).not.toHaveBeenCalled();

    token = 'jwt';
    await sync.push({ suapId: '495256' });
    await expect(sync.push({ suapId: '495256' })).resolves.toEqual({ ok: true, skipped: 'sem-alteracao' });
    clock += 61_000;
    await sync.push({ suapId: '495256' });
    expect(fetchRest.mock.calls.filter(([, , o]) => o?.method === 'POST')).toHaveLength(2);
  });

  it('retira os dados completos de processos acima do limite para continuar publicando a identificação', () => {
    const mod = loadModule();
    const payload = mod.buildPayload({
      process: { numProcesso: '23035.1', dadosCompletos: { blob: 'x'.repeat(mod.MAX_PAYLOAD_BYTES) } },
      fields: [{ label: 'CPF', value: '1' }],
    });
    expect(payload.process).toEqual({ numProcesso: '23035.1' });
    expect(payload.fields).toHaveLength(1);
  });

  it('lê apenas processos de outros perfis da janela recente e guarda cópia para falhas de rede', async () => {
    const mod = loadModule();
    const values: StorageValues = { [mod.PROFILE_KEY]: PROFILE_SIAFI };
    const fetchRest = vi.fn().mockResolvedValue([remoteRow()]);
    const sync = mod.createProcessRegistrySync({ storage: createStorage(values), getAccessToken: async () => 'jwt', fetchRest, now: () => NOW });

    const processes = await sync.fetchRemote();

    const path = fetchRest.mock.calls[0][0] as string;
    expect(path).toContain(`profile_id=neq.${PROFILE_SIAFI}`);
    expect(path).toContain(`updated_at=gte.${encodeURIComponent('2026-10-14T03:00:00.000Z')}`);
    expect(path).toContain('order=updated_at.desc&limit=20');
    expect(processes).toEqual([expect.objectContaining({
      suapId: '495256',
      processNumber: '23035.002581.2026-60',
      remote: true,
      updatedAt: Date.parse('2026-10-14T14:30:00Z'),
      process: expect.objectContaining({ cpfCnpj: '12.345.678/0001-90' }),
      fields: [expect.objectContaining({ label: 'Assunto' })],
    })]);

    fetchRest.mockRejectedValueOnce(new Error('offline'));
    await expect(sync.fetchRemote()).resolves.toEqual(processes);
  });

  it('não devolve processos de outros perfis sem sessão e respeita o prazo da consulta', async () => {
    vi.useFakeTimers();
    const mod = loadModule();
    const values: StorageValues = { [mod.PROFILE_KEY]: PROFILE_SIAFI, [mod.REMOTE_CACHE_KEY]: { processes: [{ suapId: '1', updatedAt: Date.now() }] } };
    const fetchRest = vi.fn(() => new Promise(() => {}));
    let token: string | null = null;
    const sync = mod.createProcessRegistrySync({ storage: createStorage(values), getAccessToken: async () => token, fetchRest, timeoutMs: 500 });

    await expect(sync.fetchRemote()).resolves.toEqual([]);
    expect(fetchRest).not.toHaveBeenCalled();

    token = 'jwt';
    const pending = sync.fetchRemote();
    await vi.advanceTimersByTimeAsync(600);
    await expect(pending).resolves.toEqual([expect.objectContaining({ suapId: '1' })]);
  });

  it('informa se a consulta a outros perfis falhou por falta de sessão, erro ou teve sucesso', async () => {
    const mod = loadModule();
    const values: StorageValues = { [mod.PROFILE_KEY]: PROFILE_SIAFI };
    const fetchRest = vi.fn().mockResolvedValue([remoteRow()]);
    let token: string | null = null;
    const sync = mod.createProcessRegistrySync({ storage: createStorage(values), getAccessToken: async () => token, fetchRest, now: () => NOW });

    await expect(sync.fetchRemoteWithStatus()).resolves.toEqual({ status: 'sem-sessao', processes: [] });

    token = 'jwt';
    await expect(sync.fetchRemoteWithStatus()).resolves.toMatchObject({ status: 'ok', processes: [expect.objectContaining({ suapId: '495256' })] });

    fetchRest.mockRejectedValueOnce(new Error('HTTP 500'));
    await expect(sync.fetchRemoteWithStatus()).resolves.toMatchObject({ status: 'erro', error: 'HTTP 500', processes: [expect.objectContaining({ suapId: '495256' })] });
  });

  it('inclui a leitura do token no prazo da consulta, para não abandonar redes lentas cedo demais', async () => {
    vi.useFakeTimers();
    try {
      const mod = loadModule();
      const values: StorageValues = { [mod.PROFILE_KEY]: PROFILE_SIAFI };
      const fetchRest = vi.fn().mockResolvedValue([remoteRow()]);
      const getAccessToken = () => new Promise<string>((resolve) => setTimeout(() => resolve('jwt'), 3000));
      const sync = mod.createProcessRegistrySync({ storage: createStorage(values), getAccessToken, fetchRest, now: () => NOW });
      const pending = sync.fetchRemoteWithStatus();
      await vi.advanceTimersByTimeAsync(3100);
      await expect(pending).resolves.toMatchObject({ status: 'ok', processes: [expect.objectContaining({ suapId: '495256' })] });
    } finally {
      vi.useRealTimers();
    }
  });

  it('registra o resultado da última publicação para diagnóstico', async () => {
    const mod = loadModule();
    const values: StorageValues = { [mod.PROFILE_KEY]: PROFILE_SUAP };
    const sync = mod.createProcessRegistrySync({ storage: createStorage(values), getAccessToken: async () => null, fetchRest: vi.fn(), now: () => NOW });
    expect(sync.getLastPush()).toBeNull();
    await sync.push({ suapId: '1', processNumber: '', process: null, fields: [] });
    expect(sync.getLastPush()).toMatchObject({ ok: false, skipped: 'sem-sessao' });
  });

  it('mantém processos locais na frente e não duplica o mesmo processo vindo de outro perfil', () => {
    const mod = loadModule();
    const merged = mod.mergeRemoteProcesses(
      [{ suapId: '495256', processNumber: 'A', updatedAt: 1 }],
      [
        { suapId: '495256', processNumber: 'A', remote: true, updatedAt: 5 },
        { suapId: '100', processNumber: 'B', remote: true, updatedAt: 2 },
        { suapId: '200', processNumber: 'C', remote: true, updatedAt: 9 },
      ],
    );
    expect(merged.map((item) => [item.suapId, item.remote === true])).toEqual([['495256', false], ['200', true], ['100', true]]);
  });
});

describe('background: Alt+V com processos de outros perfis', () => {
  function loadBackground(values: StorageValues, fetchMock: ReturnType<typeof vi.fn>, tabs: Array<{ id: number; url: string; title: string; active?: boolean }> = []) {
    const messageListeners: Listener[] = [];
    const removedListeners: Array<(tabId: number) => void> = [];
    const alarmListeners: Array<(alarm: { name: string }) => void> = [];
    let tabResponse: unknown = null;
    const storage = createStorage(values);
    const chromeApi = {
      storage: { local: storage },
      runtime: {
        onMessage: { addListener: (listener: Listener) => messageListeners.push(listener) },
        onInstalled: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
      },
      alarms: { create: vi.fn(), get: vi.fn().mockResolvedValue(undefined), onAlarm: { addListener: (listener: (alarm: { name: string }) => void) => alarmListeners.push(listener) } },
      tabs: {
        query: (_q: unknown, callback?: (tabs: unknown[]) => void) => (callback ? callback(tabs) : Promise.resolve(tabs)),
        sendMessage: vi.fn((_tabId: number, _message: unknown, callback?: (response: unknown) => void) => callback?.(tabResponse)),
        onRemoved: { addListener: (listener: (tabId: number) => void) => removedListeners.push(listener) },
      },
    };
    vi.stubGlobal('fetch', fetchMock);
    const scope: Record<string, unknown> = { crypto: globalThis.crypto };
    new Function('globalThis', readFileSync(extensionFixturePath('scheduled-process-sync.js'), 'utf8'))(scope);
    new Function('globalThis', readFileSync(extensionFixturePath('process-registry-sync.js'), 'utf8'))(scope);
    new Function('chrome', 'fetch', 'globalThis', readFileSync(extensionFixturePath('background.js'), 'utf8'))(chromeApi, fetchMock, scope);
    const send = (message: Record<string, unknown>, sender: unknown = {}) => new Promise<Record<string, unknown>>((resolve) => {
      for (const listener of messageListeners) {
        if (listener({ source: 'suape-process-registry', ...message }, sender, resolve as (response: unknown) => void) === true) return;
      }
    });
    return { send, removedListeners, alarmListeners, setTabResponse: (value: unknown) => { tabResponse = value; } };
  }

  const session = { 'siages-extension-session': { accessToken: 'jwt', refreshToken: 'refresh', expiresAt: Date.now() / 1000 + 7200 } };
  const okJson = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });

  it('mostra no perfil do SIAFI o processo aberto no perfil do SUAP', async () => {
    const fetchMock = vi.fn(async () => okJson([remoteRow({ updated_at: new Date().toISOString() })]));
    const background = loadBackground({ ...session, 'siages-extension-profile-id': PROFILE_SIAFI }, fetchMock);

    const response = await background.send({ type: 'get-active-processes' });

    expect(response).toMatchObject({ ok: true, processes: [expect.objectContaining({ suapId: '495256', remote: true })] });
    expect(String(fetchMock.mock.calls[0][0])).toContain(`/rest/v1/extension_process_registry?select=`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: expect.objectContaining({ Authorization: 'Bearer jwt' }) });
  });

  it('consulta outros perfis em separado, com o estado da consulta, e permite pular essa consulta', async () => {
    const fetchMock = vi.fn(async () => okJson([remoteRow({ updated_at: new Date().toISOString() })]));
    const background = loadBackground({ ...session, 'siages-extension-profile-id': PROFILE_SIAFI }, fetchMock);

    const local = await background.send({ type: 'get-active-processes', includeRemote: false });
    expect(local).toMatchObject({ ok: true, processes: [] });
    expect(fetchMock).not.toHaveBeenCalled();

    const remote = await background.send({ type: 'get-remote-processes' });
    expect(remote).toMatchObject({
      ok: true,
      remote: { status: 'ok' },
      processes: [expect.objectContaining({ suapId: '495256', remote: true })],
    });
  });

  it('avisa quando este perfil não tem sessão do SIAGES para ler outros perfis', async () => {
    const fetchMock = vi.fn();
    const background = loadBackground({ 'siages-extension-profile-id': PROFILE_SIAFI }, fetchMock);
    await expect(background.send({ type: 'get-remote-processes' })).resolves.toMatchObject({ ok: true, remote: { status: 'sem-sessao' }, processes: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('republica as abas de processo já abertas, mas só quando o snapshot do processo está carregado', async () => {
    const fetchMock = vi.fn(async () => okJson(null));
    const tabs = [{ id: 9, url: 'https://suap.ifrn.edu.br/processo_eletronico/processo/495256/', title: 'Processo' }];
    const background = loadBackground({ ...session, 'siages-extension-profile-id': PROFILE_SUAP }, fetchMock, tabs);
    const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');

    background.setTabResponse({ processData: { suapId: '495256', processNumber: '23035.002581.2026-60', process: null, fields: [] } });
    background.alarmListeners.forEach((listener) => listener({ name: 'siages-extension-session-refresh' }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(posts()).toHaveLength(0);

    background.setTabResponse({ processData: { suapId: '495256', processNumber: '23035.002581.2026-60', process: { cpfCnpj: '1' }, fields: [{ label: 'Assunto', value: 'x' }] } });
    background.alarmListeners.forEach((listener) => listener({ name: 'siages-extension-session-refresh' }));
    await vi.waitFor(() => expect(posts()).toHaveLength(1));
    expect(JSON.parse(String(posts()[0][1]?.body))).toMatchObject({ process_key: '495256', payload: { process: { cpfCnpj: '1' } } });
  });

  it('publica ao registrar o processo e retira o registro quando a aba é fechada', async () => {
    const fetchMock = vi.fn(async () => okJson(null));
    const background = loadBackground({ ...session, 'siages-extension-profile-id': PROFILE_SUAP }, fetchMock);

    await background.send(
      { type: 'register-process', payload: { suapId: '495256', processNumber: '23035.002581.2026-60', process: { cpfCnpj: '1' }, fields: [] } },
      { tab: { id: 7, url: 'https://suap.ifrn.edu.br/processo_eletronico/processo/495256/' } },
    );
    await vi.waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(String(post?.[0])).toContain('extension_process_registry?on_conflict=tenant_id,profile_id,process_key');

    background.removedListeners.forEach((listener) => listener(7));
    await vi.waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) =>
      init?.method === 'DELETE' && String(url).includes('process_key=eq.495256'))).toBe(true));
  });
});
