import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

const SESSION_KEY = 'siages-extension-session';
const AUTH_SOURCE = 'siages-extension-auth';

type StorageValues = Record<string, unknown>;

function loadBackground(values: StorageValues) {
  const messageListeners: Array<(message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean | undefined> = [];
  const alarmListeners: Array<(alarm: { name: string }) => void> = [];
  const storage = {
    get: vi.fn(async (key: string) => ({ [key]: values[key] })),
    set: vi.fn(async (entries: StorageValues) => { Object.assign(values, entries); }),
    remove: vi.fn(async (key: string) => { delete values[key]; }),
  };
  const chromeApi = {
    storage: { local: storage },
    runtime: {
      onMessage: { addListener: (listener: (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean | undefined) => messageListeners.push(listener) },
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
    },
    alarms: {
      create: vi.fn(),
      onAlarm: { addListener: (listener: (alarm: { name: string }) => void) => alarmListeners.push(listener) },
    },
  };
  (window as typeof window & { chrome?: unknown }).chrome = chromeApi;
  new Function('chrome', 'fetch', readFileSync(extensionFixturePath('background.js'), 'utf8'))(chromeApi, globalThis.fetch);

  return {
    storage,
    send: (message: { type: string }) => new Promise<unknown>((resolve) => {
      const keepChannelOpen = messageListeners[0](
        { source: AUTH_SOURCE, ...message },
        {},
        resolve,
      );
      expect(keepChannelOpen).toBe(true);
    }),
    alarmListeners,
  };
}

afterEach(() => {
  delete (window as typeof window & { chrome?: unknown }).chrome;
  vi.unstubAllGlobals();
});

describe('autenticação persistente da extensão', () => {
  it('serializa renovações concorrentes e salva o refresh token mais recente', async () => {
    const values: StorageValues = {
      [SESSION_KEY]: { accessToken: 'expirado', refreshToken: 'refresh-antigo', expiresAt: 1 },
    };
    let releaseRefresh!: (response: unknown) => void;
    const fetchMock = vi.fn(() => new Promise((resolve) => { releaseRefresh = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    const background = loadBackground(values);

    const first = background.send({ type: 'get-session' });
    const second = background.send({ type: 'get-session' });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    releaseRefresh({
      ok: true,
      json: async () => ({ access_token: 'novo-access', refresh_token: 'novo-refresh', expires_in: 3600 }),
    });
    const responses = await Promise.all([first, second]);

    expect(responses).toEqual([
      { ok: true, session: expect.objectContaining({ accessToken: 'novo-access', refreshToken: 'novo-refresh' }) },
      { ok: true, session: expect.objectContaining({ accessToken: 'novo-access', refreshToken: 'novo-refresh' }) },
    ]);
    expect(values[SESSION_KEY]).toEqual(expect.objectContaining({ accessToken: 'novo-access', refreshToken: 'novo-refresh' }));
  });

  it('preserva a sessão quando a renovação falha e só a remove no logout explícito', async () => {
    const storedSession = { accessToken: 'expirado', refreshToken: 'refresh-preservado', expiresAt: 1 };
    const values: StorageValues = { [SESSION_KEY]: storedSession };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }));
    const background = loadBackground(values);

    const failedRefresh = await background.send({ type: 'get-session' });
    expect(failedRefresh).toEqual({ ok: false, error: expect.stringContaining('não pôde ser renovada') });
    expect(values[SESSION_KEY]).toEqual(storedSession);
    expect(background.storage.remove).not.toHaveBeenCalled();

    await expect(background.send({ type: 'sign-out' })).resolves.toEqual({ ok: true, session: null });
    expect(values[SESSION_KEY]).toBeUndefined();
    expect(background.storage.remove).toHaveBeenCalledWith(SESSION_KEY);
  });

  it('não recria a sessão se o usuário clicar em Sair durante uma renovação', async () => {
    const values: StorageValues = {
      [SESSION_KEY]: { accessToken: 'expirado', refreshToken: 'refresh-antigo', expiresAt: 1 },
    };
    let releaseRefresh!: (response: unknown) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { releaseRefresh = resolve; })));
    const background = loadBackground(values);

    const refreshing = background.send({ type: 'get-session' });
    await Promise.resolve();
    await expect(background.send({ type: 'sign-out' })).resolves.toEqual({ ok: true, session: null });

    releaseRefresh({ ok: true, json: async () => ({ access_token: 'late-access', refresh_token: 'late-refresh', expires_in: 3600 }) });
    await expect(refreshing).resolves.toEqual({ ok: true, session: null });
    expect(values[SESSION_KEY]).toBeUndefined();
  });
});
