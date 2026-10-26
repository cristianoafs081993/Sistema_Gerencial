import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

type Capture = { id: string; processKey: string; processNumber: string; documentLabel: string; fileName: string };
type Bridge = {
  stage: (input: Record<string, unknown>) => Promise<Capture>;
  pendingOpen: () => Promise<Capture[]>;
  claim: (id: string) => Promise<boolean>;
  resolveSuapId: (key: string) => Promise<string>;
  find: (input: { uploadId?: string; keys?: string[] }) => Promise<{ capture: Capture | null; reason?: string; processes?: string[]; others?: number }>;
  download: (id: string) => Promise<Capture & { pdfBase64: string }>;
  consume: (id: string) => Promise<boolean>;
};
type BridgeModule = {
  processKey: (value: string) => string;
  formatProcess: (value: string) => string;
  documentKey: (value: string) => string;
  pdfFileName: (value: string) => string;
  toBase64: (bytes: Uint8Array) => string;
  buildUploadUrl: (capture: { id: string; processKey: string }, suapId: string) => string;
  createSiafiUploadBridge: (deps: Record<string, unknown>) => Bridge;
};

const USER = '00000000-0000-4000-8000-000000000001';
const ID = '11111111-1111-4111-8111-111111111111';
const NUP = '23035002988202697';
const URL_BASE = 'https://example.supabase.co';
const PDF = new TextEncoder().encode('%PDF-1.4\n%SIAGES\n%%EOF\n');
const row = (overrides: Record<string, unknown> = {}) => ({
  id: ID, process_key: NUP, document_key: '2026NP000123', document_label: '2026NP000123',
  file_name: '23035.002988.2026-97 - 2026NP000123.pdf', storage_path: `${USER}/${NUP}/2026NP000123.pdf`, byte_size: PDF.length,
  updated_at: '2026-10-23T13:00:00Z', ...overrides,
});
const json = (body: unknown, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body), json: async () => body, arrayBuffer: async () => PDF.buffer.slice(0) });

function loadModule(): BridgeModule {
  const scope: Record<string, unknown> = {};
  new Function('globalThis', readFileSync(extensionFixturePath('siafi-upload-bridge.js'), 'utf8'))(scope);
  return scope.SiagesSiafiUploadBridge as BridgeModule;
}

function createBridge(fetchImpl: ReturnType<typeof vi.fn>, session: unknown = { accessToken: 'jwt', user: { id: USER } }) {
  return loadModule().createSiafiUploadBridge({ supabaseUrl: URL_BASE, apiKey: 'anon', getSession: async () => session, fetchImpl, now: () => Date.parse('2026-10-23T13:05:00Z') });
}

afterEach(() => vi.unstubAllGlobals());

describe('siafi-upload-bridge.js (printup)', () => {
  it('normaliza NUP, chave do DH e nome do arquivo', () => {
    const module = loadModule();
    expect(module.processKey('23035.002988/2026-97')).toBe(NUP);
    expect(module.processKey('23035.002988')).toBe('');
    expect(module.formatProcess(NUP)).toBe('23035.002988.2026-97');
    expect(module.documentKey('RP em preenchimento')).toBe('RP-em-preenchimento');
    expect(module.pdfFileName('a/b: SERVIÇOS.pdf')).toBe('a b SERVIÇOS.pdf');
  });

  it('envia o PDF ao bucket do usuário e registra a captura do processo', async () => {
    const fetchImpl = vi.fn(async (url: string) => (String(url).includes('/storage/') ? json({ Key: 'ok' }) : json([row()])));
    const bridge = createBridge(fetchImpl);
    const capture = await bridge.stage({ processNumber: '23035.002988.2026-97', documentKey: '2026NP000123', documentLabel: '2026NP000123',
      fileName: '23035.002988.2026-97 - 2026NP000123.pdf', captureId: 'c1', openUp: true, pdfBase64: loadModule().toBase64(PDF) });
    expect(capture).toMatchObject({ id: ID, processNumber: '23035.002988.2026-97', documentLabel: '2026NP000123' });
    const [storageUrl, storageInit] = fetchImpl.mock.calls[0];
    expect(storageUrl).toBe(`${URL_BASE}/storage/v1/object/siafi-capturas/${USER}/${NUP}/2026NP000123.pdf`);
    expect(storageInit).toMatchObject({ method: 'POST', headers: expect.objectContaining({ 'x-upsert': 'true', 'Content-Type': 'application/pdf', Authorization: 'Bearer jwt' }) });
    const [restUrl, restInit] = fetchImpl.mock.calls[1];
    expect(restUrl).toContain('/rest/v1/extension_siafi_uploads?on_conflict=tenant_id,process_key,document_key');
    expect(JSON.parse(restInit.body)).toMatchObject({ process_key: NUP, document_key: '2026NP000123', storage_path: `${USER}/${NUP}/2026NP000123.pdf`, open_requested: true, opened_at: null, byte_size: PDF.length });
  });

  it('recusa DH sem processo, PDF inválido e envio sem sessão SIAGES', async () => {
    const fetchImpl = vi.fn();
    const pdfBase64 = loadModule().toBase64(PDF);
    await expect(createBridge(fetchImpl).stage({ processNumber: '123', documentKey: 'X', pdfBase64 })).rejects.toThrow(/processo SUAP válido/);
    await expect(createBridge(fetchImpl).stage({ processNumber: NUP, documentKey: 'X', pdfBase64: btoa('nada') })).rejects.toThrow(/PDF/);
    await expect(createBridge(fetchImpl, null).stage({ processNumber: NUP, documentKey: 'X', pdfBase64 })).rejects.toThrow(/Entre no SIAGES/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('encontra a captura pelo processo e recusa candidatos de processos diferentes', async () => {
    const fetchImpl = vi.fn(async () => json([row(), row({ id: '2', document_key: '2026NP000124' })]));
    await expect(createBridge(fetchImpl).find({ keys: ['23035.002988.2026-97'] })).resolves.toMatchObject({ capture: { id: ID }, others: 1 });
    expect(decodeURIComponent(String(fetchImpl.mock.calls[0][0]))).toContain(`process_key=in.("${NUP}")`);
    const ambiguous = vi.fn(async () => json([row(), row({ id: '3', process_key: '23035000001202601' })]));
    await expect(createBridge(ambiguous).find({ keys: [NUP, '23035000001202601'] })).resolves.toMatchObject({ capture: null, reason: 'ambiguo' });
    await expect(createBridge(vi.fn(), null).find({ keys: [NUP] })).resolves.toMatchObject({ capture: null, reason: 'sem-sessao' });
  });

  it('reivindica a abertura uma única vez e monta a URL do upload com o vínculo da captura', async () => {
    const claimed = vi.fn(async () => json([{ id: ID }]));
    await expect(createBridge(claimed).claim(ID)).resolves.toBe(true);
    expect(String(claimed.mock.calls[0][0])).toContain(`id=eq.${ID}&opened_at=is.null`);
    await expect(createBridge(vi.fn(async () => json([]))).claim(ID)).resolves.toBe(false);
    const url = loadModule().buildUploadUrl({ id: ID, processKey: NUP }, '498930');
    expect(url.startsWith('https://suap.ifrn.edu.br/processo_eletronico/documento_upload/498930/#siagesUpload=')).toBe(true);
    expect(JSON.parse(decodeURIComponent(url.split('siagesUpload=')[1]))).toMatchObject({ suapId: '498930', processNumber: '23035.002988.2026-97', siafiUploadId: ID, tipoDocumento: 'Liquidação' });
    expect(loadModule().buildUploadUrl({ id: ID, processKey: NUP }, '')).toBe('https://suap.ifrn.edu.br/admin/processo_eletronico/processo/?q=23035.002988.2026-97');
  });

  it('baixa o PDF e apaga linha e arquivo ao salvar no SUAP', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => (init?.method === 'DELETE' && String(_url).includes('/rest/') ? json([{ storage_path: row().storage_path }]) : json([row()])));
    const bridge = createBridge(fetchImpl);
    const file = await bridge.download(ID);
    expect(atob(file.pdfBase64)).toContain('%PDF-1.4');
    expect(String(fetchImpl.mock.calls[1][0])).toBe(`${URL_BASE}/storage/v1/object/authenticated/siafi-capturas/${USER}/${NUP}/2026NP000123.pdf`);
    fetchImpl.mockClear();
    await expect(bridge.consume(ID)).resolves.toBe(true);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
    expect(String(fetchImpl.mock.calls[0][0])).toContain(`extension_siafi_uploads?id=eq.${ID}`);
    expect(fetchImpl.mock.calls[1][0]).toBe(`${URL_BASE}/storage/v1/object/siafi-capturas`);
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1].body))).toEqual({ prefixes: [row().storage_path] });
  });
});

describe('background.js: printup entre perfis', () => {
  type Listener = (message: unknown, sender: unknown, reply: (value: unknown) => void) => unknown;
  function loadBackground({ tabs = [] as Array<{ id: number; url: string; active?: boolean; windowId?: number }>, values = {} as Record<string, unknown>, responder }: { tabs?: Array<{ id: number; url: string; active?: boolean; windowId?: number }>; values?: Record<string, unknown>; responder: (url: string, init?: RequestInit) => unknown }) {
    const listeners: Listener[] = [];
    const focus: Array<(windowId: number) => void> = [];
    const stored: Record<string, unknown> = { 'siages-extension-session': { accessToken: 'jwt', refreshToken: 'r', expiresAt: Date.now() / 1000 + 7200, user: { id: USER } }, ...values };
    const chromeApi = {
      storage: { local: {
        get: vi.fn(async (keys: string | string[]) => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter((key) => key in stored).map((key) => [key, stored[key]]))),
        set: vi.fn(async (entries: Record<string, unknown>) => { Object.assign(stored, entries); }),
        remove: vi.fn(),
      } },
      runtime: { getURL: (path: string) => `chrome-extension://test/${path}`, onMessage: { addListener: (listener: Listener) => listeners.push(listener) }, onInstalled: { addListener: vi.fn() }, onStartup: { addListener: vi.fn() } },
      alarms: { create: vi.fn(), get: vi.fn().mockResolvedValue(undefined), onAlarm: { addListener: vi.fn() } },
      tabs: {
        query: vi.fn(async (query: { url?: string; active?: boolean; windowId?: number }) => tabs.filter((tab) =>
          (!query.url || tab.url.startsWith('https://suap.ifrn.edu.br/')) && (!query.active || tab.active) && (query.windowId === undefined || tab.windowId === query.windowId))),
        create: vi.fn(async () => ({ id: 99 })),
      },
      windows: { onFocusChanged: { addListener: (listener: (windowId: number) => void) => focus.push(listener) } },
    };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => responder(String(url), init));
    const scope: Record<string, unknown> = {};
    for (const file of ['siafi-upload-bridge.js']) new Function('globalThis', readFileSync(extensionFixturePath(file), 'utf8'))(scope);
    new Function('chrome', 'fetch', 'globalThis', readFileSync(extensionFixturePath('background.js'), 'utf8'))(chromeApi, fetchMock, scope);
    const send = (message: Record<string, unknown>, sender: Record<string, unknown>) => new Promise<Record<string, unknown>>((resolve) => {
      for (const listener of listeners) if (listener(message, sender, resolve as (value: unknown) => void) === true) return;
      resolve({ unhandled: true });
    });
    return { send, focus, chromeApi, fetchMock };
  }
  const siafi = { url: 'https://siafi.tesouro.gov.br/siafi2026/editarDH', frameId: 0, tab: { windowId: 1 } };
  const uploadPage = { url: 'https://suap.ifrn.edu.br/processo_eletronico/documento_upload/498930/', frameId: 0 };
  const stagePayload = () => ({ processNumber: '23035.002988.2026-97', documentKey: '2026NP000123', documentLabel: '2026NP000123', fileName: 'x.pdf', openUp: true, pdfBase64: loadModule().toBase64(PDF) });

  it('aceita o printup só do SIAFI e abre o upload aqui quando este perfil está no SUAP', async () => {
    const background = loadBackground({
      tabs: [{ id: 3, url: 'https://suap.ifrn.edu.br/', windowId: 1 }],
      values: { suape_active_processes: { tab_suap_498930: { suapId: '498930', processNumber: '23035.002988.2026-97' } } },
      responder: (url) => (url.includes('/storage/') ? json({}) : url.includes('opened_at=is.null&select=id') ? json([{ id: ID }]) : json([row()])),
    });
    await expect(background.send({ source: 'siages-siafi-evidence', type: 'stage-upload', payload: stagePayload() }, { ...siafi, url: 'https://evil.test/' }))
      .resolves.toMatchObject({ ok: false });
    expect(background.fetchMock).not.toHaveBeenCalled();
    await expect(background.send({ source: 'siages-siafi-evidence', type: 'stage-upload', payload: stagePayload() }, siafi))
      .resolves.toMatchObject({ ok: true, opened: true, capture: { id: ID } });
    const [{ url, windowId }] = background.chromeApi.tabs.create.mock.calls[0] as unknown as [{ url: string; windowId: number }];
    expect(windowId).toBe(1);
    expect(url).toContain('/processo_eletronico/documento_upload/498930/#siagesUpload=');
  });

  it('em outro perfil, abre o upload pendente ao focar uma janela no SUAP', async () => {
    const background = loadBackground({
      tabs: [{ id: 7, url: 'https://suap.ifrn.edu.br/processo_eletronico/processo/498930/', active: true, windowId: 4 }],
      responder: (url) => {
        if (url.includes('open_requested=is.true')) return json([row()]);
        if (url.includes('opened_at=is.null&select=id')) return json([{ id: ID }]);
        if (url.includes('extension_process_registry?select=suap_id')) return json([{ suap_id: '498930' }]);
        return json([]);
      },
    });
    background.focus[0](4);
    await vi.waitFor(() => expect(background.chromeApi.tabs.create).toHaveBeenCalledTimes(1));
    expect(background.chromeApi.tabs.create.mock.calls[0][0]).toMatchObject({ windowId: 4, active: true, url: expect.stringContaining('/documento_upload/498930/') });
  });

  it('reconfere por alguns segundos quando o foco chega antes do PDF terminar de subir', async () => {
    vi.useFakeTimers();
    try {
      let staged = false;
      const responder = (url: string) => {
        if (url.includes('open_requested=is.true')) return json(staged ? [row()] : []);
        if (url.includes('opened_at=is.null&select=id')) return json([{ id: ID }]);
        if (url.includes('extension_process_registry?select=suap_id')) return json([{ suap_id: '498930' }]);
        return json([]);
      };
      const suapTab = { id: 7, url: 'https://suap.ifrn.edu.br/', active: true, windowId: 4 };
      const background = loadBackground({ tabs: [suapTab], responder });
      background.focus[0](4);
      await vi.advanceTimersByTimeAsync(100);
      expect(background.chromeApi.tabs.create).not.toHaveBeenCalled();
      staged = true;
      await vi.advanceTimersByTimeAsync(4000);
      expect(background.chromeApi.tabs.create).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(20000);
      expect(background.chromeApi.tabs.create).toHaveBeenCalledTimes(1);

      // Saindo do Chrome, a reconferência para.
      staged = false;
      const other = loadBackground({ tabs: [suapTab], responder });
      other.focus[0](4);
      await vi.advanceTimersByTimeAsync(100);
      other.focus[0](-1);
      staged = true;
      await vi.advanceTimersByTimeAsync(24000);
      expect(other.chromeApi.tabs.create).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('não procura capturas ao focar janelas fora do SUAP', async () => {
    const background = loadBackground({ tabs: [{ id: 8, url: 'https://siafi.tesouro.gov.br/', active: true, windowId: 2 }], responder: () => json([row()]) });
    background.focus[0](2);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(background.fetchMock).not.toHaveBeenCalled();
    expect(background.chromeApi.tabs.create).not.toHaveBeenCalled();
  });

  it('a página de upload só consulta capturas do próprio processo', async () => {
    const background = loadBackground({
      values: { suape_active_processes: { tab_suap_498930: { suapId: '498930', processNumber: '23035.002988.2026-97' } } },
      responder: (url) => (url.includes('extension_siafi_uploads') ? json([row()]) : json([])),
    });
    await expect(background.send({ source: 'siages-upload', type: 'find-siafi-capture', pageNumbers: [] }, { ...uploadPage, url: 'https://suap.ifrn.edu.br/admin/' }))
      .resolves.toMatchObject({ ok: false });
    const found = await background.send({ source: 'siages-upload', type: 'find-siafi-capture', pageNumbers: ['23035.000001.2026-01'] }, uploadPage);
    expect(found).toMatchObject({ ok: true, capture: { id: ID } });
    const query = decodeURIComponent(String(background.fetchMock.mock.calls.map(([url]) => url).find((url) => String(url).includes('extension_siafi_uploads'))));
    expect(query).toContain(`process_key=in.("${NUP}")`);
    expect(query).not.toContain('23035000001202601');
  });
});
