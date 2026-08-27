import { readFileSync } from 'node:fs';

import { waitFor } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

const popupHtml = readFileSync(extensionFixturePath('popup.html'), 'utf8');
const popupScript = readFileSync(extensionFixturePath('popup.js'), 'utf8');

function renderPopup() {
  const body = popupHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || popupHtml;
  document.body.innerHTML = body;
}

function setupChrome(url: string) {
  const activeTab = { id: 42, url };
  const executeScript = vi.fn().mockResolvedValue([{ frameId: 7, result: true }]);
  const sendMessage = vi.fn().mockResolvedValue({ ok: true, matched: true, inserted: 1 });
  const chromeApi = {
    tabs: {
      query: vi.fn().mockResolvedValue([activeTab]),
      sendMessage,
    },
    scripting: { executeScript },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
    },
  };
  vi.stubGlobal('chrome', chromeApi);
  return { activeTab, executeScript, sendMessage };
}

function loadPopup() {
  new Function(popupScript)();
}

describe('popup da extensao: preenchimento SIAFI', () => {
  beforeEach(() => {
    renderPopup();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/rest/v1/lc_saved_lists')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{
            id: 'list-1',
            name: 'Agosto',
            updated_at: '2026-08-27T12:00:00Z',
            rows: [{ cpf: '123.456.789-01', valor: 250 }],
          }],
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }));
    vi.stubGlobal('SiagesExtensionAuth', { getSession: vi.fn().mockResolvedValue({ accessToken: 'access-token' }) });
    window.localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete (globalThis as typeof globalThis & { SiagesExtensionAuth?: unknown }).SiagesExtensionAuth;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('carrega a lista compartilhada, identifica o frame interno e envia somente para ele', async () => {
    const { executeScript, sendMessage } = setupChrome('https://siafi.tesouro.gov.br/siafi2026/cpr-comp-ng/#/transacoes/inclx');
    loadPopup();

    await waitFor(() => expect(document.getElementById('siafi-favorecidos-card')).not.toHaveAttribute('hidden'));
    await waitFor(() => expect(document.querySelector('#siafi-list-select option')).toHaveTextContent('Agosto (1 favorecido(s))'));
    expect(document.getElementById('siafi-list-info')).toHaveTextContent('1 favorecido(s) pronto(s)');

    (document.getElementById('btn-siafi-fill') as HTMLButtonElement).click();
    await waitFor(() => expect(sendMessage).toHaveBeenCalled());
    expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({ target: { tabId: 42, allFrames: true } }));
    expect(sendMessage).toHaveBeenCalledWith(42, expect.objectContaining({
      source: 'siages',
      type: 'siafi:fill-favorecidos',
      version: 1,
      records: [{ cpf: '12345678901', valor: 250 }],
    }), { frameId: 7 });
  });

  it('informa quando a sessão da extensão está ausente', async () => {
    const fetchMock = vi.mocked(fetch);
    vi.stubGlobal('SiagesExtensionAuth', { getSession: vi.fn().mockResolvedValue(null) });
    setupChrome('https://siafi.tesouro.gov.br/siafi2026/cpr-comp-ng/');
    loadPopup();

    await waitFor(() => expect(document.getElementById('siafi-fill-status')).toHaveTextContent('Entre no SIAGES'));
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/rest/v1/lc_saved_lists'), expect.anything());
  });

  it('mantem o card oculto fora do SIAFI', async () => {
    setupChrome('https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/');
    loadPopup();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.getElementById('siafi-favorecidos-card')).toHaveAttribute('hidden');
  });
});
