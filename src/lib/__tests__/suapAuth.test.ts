import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('@/lib/env');
});

describe('suapAuth', () => {
  it('usa VITE_APP_ORIGIN como origem canonica do redirect SUAP', async () => {
    vi.doMock('@/lib/env', () => ({
      env: {
        appOrigin: 'https://siages.ifrn.edu.br',
        suapClientId: 'client-prod',
      },
    }));

    const { buildSuapAuthorizeUrl, getSuapRedirectUri } = await import('@/lib/suapAuth');

    expect(getSuapRedirectUri('https://preview.vercel.app')).toBe('https://siages.ifrn.edu.br/suap-callback');

    const url = new URL(buildSuapAuthorizeUrl({ state: 'app' }));
    expect(url.origin + url.pathname).toBe('https://suap.ifrn.edu.br/o/authorize/');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('client-prod');
    expect(url.searchParams.get('redirect_uri')).toBe('https://siages.ifrn.edu.br/suap-callback');
    expect(url.searchParams.get('state')).toBe('app');
  });

  it('mantem a origem atual quando nao ha origem canonica configurada', async () => {
    vi.doMock('@/lib/env', () => ({
      env: {
        appOrigin: undefined,
        suapClientId: 'client-local',
      },
    }));

    const { getSuapRedirectUri } = await import('@/lib/suapAuth');

    expect(getSuapRedirectUri('http://localhost:5173')).toBe('http://localhost:5173/suap-callback');
  });
});

describe('state do login SUAP', () => {
  function memoryStorage() {
    const data = new Map<string, string>();
    return {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    };
  }

  it('gera state aleatório com prefixo app e aceita só o mesmo valor no retorno', async () => {
    const { createSuapLoginState, isValidSuapLoginState } = await import('@/lib/suapAuth');
    const storage = memoryStorage();
    const state = createSuapLoginState(storage);
    expect(state).toMatch(/^app:[0-9a-z]{16,}$/);
    expect(createSuapLoginState(memoryStorage())).not.toBe(state);
    expect(isValidSuapLoginState('app:outro', storage)).toBe(false);

    const storage2 = memoryStorage();
    const state2 = createSuapLoginState(storage2);
    expect(isValidSuapLoginState(state2, storage2)).toBe(true);
    // Uso único.
    expect(isValidSuapLoginState(state2, storage2)).toBe(false);
  });

  it('mantém aceito o formato antigo e o fluxo de feedback público', async () => {
    const { isValidSuapLoginState } = await import('@/lib/suapAuth');
    expect(isValidSuapLoginState('app', memoryStorage())).toBe(true);
    expect(isValidSuapLoginState('AMB-123', memoryStorage())).toBe(true);
  });
});

describe('login SUAP iniciado pela extensão', () => {
  it('reconhece só o state com prefixo ext:', async () => {
    const { isExtensionSuapLoginState } = await import('@/lib/suapAuth');
    expect(isExtensionSuapLoginState('ext:abc123')).toBe(true);
    expect(isExtensionSuapLoginState('app:abc123')).toBe(false);
    expect(isExtensionSuapLoginState('AMB-ext:1')).toBe(false);
    expect(isExtensionSuapLoginState(null)).toBe(false);
  });
});
