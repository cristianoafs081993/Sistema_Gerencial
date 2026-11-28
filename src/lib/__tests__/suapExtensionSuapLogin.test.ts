import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

const SESSION_KEY = 'siages-extension-session';
const PENDING_KEY = 'siages-extension-suap-login-pending';
const STATUS_KEY = 'siages-extension-suap-login-status';
const BLOCK_KEY = 'siages-extension-site-session-blocked';
const SUPABASE_URL = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const REDIRECT = 'https://www.siages.com.br/suap-callback';

type StorageValues = Record<string, unknown>;
type Listener = (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean | undefined;

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function loadBackground(values: StorageValues) {
  const messageListeners: Listener[] = [];
  const tabListeners: Array<(tabId: number, changeInfo: { url?: string }, tab: { url?: string }) => void> = [];
  const storage = {
    get: vi.fn(async (key: string) => ({ [key]: values[key] })),
    set: vi.fn(async (entries: StorageValues) => { Object.assign(values, entries); }),
    remove: vi.fn(async (key: string) => { delete values[key]; }),
  };
  const tabs = {
    create: vi.fn(async (_options: { url: string; active?: boolean }) => ({ id: 77 })),
    remove: vi.fn(async () => undefined),
    update: vi.fn(async () => undefined),
    query: vi.fn(async () => []),
    onUpdated: { addListener: (listener: (typeof tabListeners)[number]) => tabListeners.push(listener) },
  };
  const chromeApi = {
    storage: { local: storage },
    tabs,
    runtime: {
      id: 'extensao-siages',
      onMessage: { addListener: (listener: Listener) => messageListeners.push(listener) },
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
    },
    alarms: { create: vi.fn(), get: vi.fn().mockResolvedValue(undefined), onAlarm: { addListener: vi.fn() } },
  };
  (window as typeof window & { chrome?: unknown }).chrome = chromeApi;
  const syncContext: Record<string, unknown> = {};
  new Function('globalThis', readFileSync(extensionFixturePath('scheduled-process-sync.js'), 'utf8'))(syncContext);
  new Function('chrome', 'fetch', 'globalThis', readFileSync(extensionFixturePath('background.js'), 'utf8'))(chromeApi, globalThis.fetch, syncContext);

  const send = (message: Record<string, unknown>, sender: unknown = {}) => new Promise<unknown>((resolve) => {
    const keepOpen = messageListeners[0](message, sender, resolve);
    if (keepOpen !== true) throw new Error('canal fechado');
  });
  return {
    tabs,
    values,
    send,
    sendRaw: (message: Record<string, unknown>, sender: unknown) => {
      let response: unknown;
      const keepOpen = messageListeners[0](message, sender, (value) => { response = value; });
      return { keepOpen, response };
    },
    navigateTab: (tabId: number, url: string) => tabListeners.forEach((listener) => listener(tabId, { url }, { url })),
  };
}

function okExchangeFetch(extra: Record<string, unknown> = {}) {
  return vi.fn(async (url: string, _init?: { body?: string; headers?: Record<string, string> }) => {
    if (url === `${SUPABASE_URL}/functions/v1/suap-token-exchange`) return jsonResponse({ hashed_token: 'hash-1', ...extra });
    if (url === `${SUPABASE_URL}/functions/v1/extension-session-handoff`) return jsonResponse({ hashed_token: 'hash-site' });
    if (url === `${SUPABASE_URL}/auth/v1/verify`) {
      return jsonResponse({ access_token: 'access-suap', refresh_token: 'refresh-suap', expires_in: 3600, user: { id: 'u1', email: 'a@ifrn.edu.br' } });
    }
    return jsonResponse({}, 200);
  });
}

afterEach(() => {
  delete (window as typeof window & { chrome?: unknown }).chrome;
  vi.unstubAllGlobals();
});

describe('login SUAP da extensão', () => {
  it('abre o SUAP com o retorno do site e um state ext: aleatório', async () => {
    vi.stubGlobal('fetch', okExchangeFetch());
    const background = loadBackground({});

    await expect(background.send({ source: 'siages-extension-auth', type: 'sign-in-suap' })).resolves.toEqual({ ok: true, started: true });

    const url = new URL(background.tabs.create.mock.calls[0]![0].url);
    expect(url.origin + url.pathname).toBe('https://suap.ifrn.edu.br/o/authorize/');
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toMatch(/^ext:[0-9a-f]{32}$/);
    expect(background.values[PENDING_KEY]).toMatchObject({ state: url.searchParams.get('state') });
  });

  it('troca o código do retorno por uma sessão própria e fecha a aba', async () => {
    const fetchMock = okExchangeFetch();
    vi.stubGlobal('fetch', fetchMock);
    const background = loadBackground({});
    await background.send({ source: 'siages-extension-auth', type: 'sign-in-suap' });
    const state = new URL(background.tabs.create.mock.calls[0]![0].url).searchParams.get('state');

    background.navigateTab(77, `${REDIRECT}?code=codigo-1&state=${state}`);

    await vi.waitFor(() => expect(background.values[SESSION_KEY]).toMatchObject({ accessToken: 'access-suap', refreshToken: 'refresh-suap' }));
    const exchangeCall = fetchMock.mock.calls.find(([url]) => url.endsWith('/suap-token-exchange'));
    expect(JSON.parse(exchangeCall![1]!.body!)).toMatchObject({ code: 'codigo-1', redirectUri: REDIRECT, loginSupabase: true });
    const verifyCall = fetchMock.mock.calls.find(([url]) => url.endsWith('/auth/v1/verify'));
    expect(JSON.parse(verifyCall![1]!.body!)).toEqual({ type: 'magiclink', token_hash: 'hash-1' });
    expect(background.tabs.remove).toHaveBeenCalledWith(77);
    expect(background.values[PENDING_KEY]).toBeUndefined();
    await vi.waitFor(() => expect(background.values[STATUS_KEY]).toMatchObject({ phase: 'done' }));
  });

  it('ignora retorno com state diferente do iniciado e não reutiliza o state', async () => {
    const fetchMock = okExchangeFetch();
    vi.stubGlobal('fetch', fetchMock);
    const background = loadBackground({});
    await background.send({ source: 'siages-extension-auth', type: 'sign-in-suap' });

    background.navigateTab(77, `${REDIRECT}?code=codigo-x&state=ext:forjado`);
    background.navigateTab(78, `${REDIRECT}?code=codigo-y&state=app:123`);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(fetchMock).not.toHaveBeenCalledWith(`${SUPABASE_URL}/functions/v1/suap-token-exchange`, expect.anything());
    expect(background.tabs.remove).not.toHaveBeenCalled();
    expect(background.values[SESSION_KEY]).toBeUndefined();
  });

  it('avisa o popup quando o SUAP nega o acesso', async () => {
    vi.stubGlobal('fetch', okExchangeFetch());
    const background = loadBackground({});
    await background.send({ source: 'siages-extension-auth', type: 'sign-in-suap' });
    const state = new URL(background.tabs.create.mock.calls[0]![0].url).searchParams.get('state');

    background.navigateTab(77, `${REDIRECT}?error=access_denied&state=${state}`);

    await vi.waitFor(() => expect(background.values[STATUS_KEY]).toMatchObject({ phase: 'error', message: 'O acesso foi negado no SUAP.' }));
    await expect(background.send({ source: 'siages-extension-auth', type: 'get-suap-login-status' }))
      .resolves.toMatchObject({ ok: true, status: { phase: 'error' } });
    expect(background.values[SESSION_KEY]).toBeUndefined();
  });
});

describe('sessão do site aproveitada pela extensão', () => {
  const siteSender = { id: 'extensao-siages', url: 'https://www.siages.com.br/dashboard' };
  const siteJwt = 'header.payload.signature';

  it('pede uma sessão própria ao servidor quando a extensão está sem sessão', async () => {
    const fetchMock = okExchangeFetch();
    vi.stubGlobal('fetch', fetchMock);
    const background = loadBackground({});

    await expect(background.send({ source: 'siages-site-session', type: 'site-session', accessToken: siteJwt }, siteSender))
      .resolves.toEqual({ ok: true, adopted: true });

    const handoffCall = fetchMock.mock.calls.find(([url]) => url.endsWith('/extension-session-handoff'));
    expect(handoffCall![1]!.headers!.Authorization).toBe(`Bearer ${siteJwt}`);
    expect(background.values[SESSION_KEY]).toMatchObject({ accessToken: 'access-suap', refreshToken: 'refresh-suap' });
    expect(JSON.stringify(background.values[SESSION_KEY])).not.toContain(siteJwt);
  });

  it('não troca uma sessão que a extensão já tem', async () => {
    const fetchMock = okExchangeFetch();
    vi.stubGlobal('fetch', fetchMock);
    const existing = { accessToken: 'atual', refreshToken: 'refresh-atual', expiresAt: Date.now() / 1000 + 3600 };
    const background = loadBackground({ [SESSION_KEY]: existing });

    await expect(background.send({ source: 'siages-site-session', type: 'site-session', accessToken: siteJwt }, siteSender))
      .resolves.toEqual({ ok: true, adopted: false, reason: 'has-session' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(background.values[SESSION_KEY]).toEqual(existing);
  });

  it('respeita o Sair da extensão até um novo login feito de propósito', async () => {
    const fetchMock = okExchangeFetch();
    vi.stubGlobal('fetch', fetchMock);
    const background = loadBackground({});
    await background.send({ source: 'siages-extension-auth', type: 'sign-out' });

    await expect(background.send({ source: 'siages-site-session', type: 'site-session', accessToken: siteJwt }, siteSender))
      .resolves.toEqual({ ok: true, adopted: false, reason: 'signed-out' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(background.values[BLOCK_KEY]).toBe(true);
  });

  it('recusa a oferta vinda de outra origem', () => {
    vi.stubGlobal('fetch', okExchangeFetch());
    const background = loadBackground({});

    const { keepOpen, response } = background.sendRaw(
      { source: 'siages-site-session', type: 'site-session', accessToken: siteJwt },
      { id: 'extensao-siages', url: 'https://www.siages.com.br.evil.example/' },
    );
    expect(keepOpen).toBeUndefined();
    expect(response).toEqual({ ok: false, error: 'Origem não autorizada.' });
  });
});
