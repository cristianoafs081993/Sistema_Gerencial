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
