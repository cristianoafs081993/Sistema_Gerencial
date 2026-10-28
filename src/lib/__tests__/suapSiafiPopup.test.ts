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
  const sendMessage = vi.fn().mockImplementation((_tab, message) => Promise.resolve({ ok: true, matched: true, inserted: message.records.length, processed: message.records.length, confirmed: message.records.length, pending: [] }));
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
  return { activeTab, executeScript, sendMessage, storageSet: chromeApi.storage.local.set };
}

const SIAFI_URL = 'https://siafi.tesouro.gov.br/siafi2026/cpr-comp-ng/#/transacoes/inclx';

function stubLargeList(length = 21) {
  const rows = Array.from({ length }, (_, index) => ({ cpf: String(10000000000 + index), valor: index + 1 }));
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (url.includes('/rest/v1/lc_saved_lists')) {
      return Promise.resolve({ ok: true, json: async () => [{ id: 'list-large', name: 'Lote grande', updated_at: '2026-08-27T12:00:00Z', rows }] });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  }));
}

function element<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

function chooseBatch(value: string) {
  const select = element<HTMLSelectElement>('siafi-batch-select');
  select.value = value;
  select.dispatchEvent(new Event('change'));
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
      version: 4,
      mode: 'fill',
      records: [{ cpf: '12345678901', valor: 250 }],
    }), { frameId: 7 });
    expect(executeScript).toHaveBeenCalledWith({ target: { tabId: 42, frameIds: [7] }, files: ['siafi-favorecidos.js'] });
  });

  it('divide listas grandes em blocos de dez e, sem seguir automaticamente, retoma o próximo bloco', async () => {
    stubLargeList();
    const { sendMessage } = setupChrome(SIAFI_URL);
    loadPopup();

    await waitFor(() => expect(document.querySelector('#siafi-list-select option')).toHaveTextContent('Lote grande (21 favorecido(s))'));
    element<HTMLInputElement>('siafi-auto-continue').checked = false;
    const fillButton = document.getElementById('btn-siafi-fill') as HTMLButtonElement;
    fillButton.click();
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    expect(sendMessage.mock.calls[0][1].records).toHaveLength(10);
    expect(sendMessage.mock.calls[0][1].records[0]).toEqual({ cpf: '10000000000', valor: 1 });

    await waitFor(() => expect(document.getElementById('siafi-fill-status')).toHaveTextContent('bloco 1/3'));
    expect(element('siafi-fill-status')).toHaveTextContent('Clique novamente para o próximo bloco (2/3)');
    expect(element<HTMLSelectElement>('siafi-batch-select').value).toBe('10');
    fillButton.click();
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
    expect(sendMessage.mock.calls[1][1].records).toHaveLength(10);
    expect(sendMessage.mock.calls[1][1].records[0]).toEqual({ cpf: '10000000010', valor: 11 });
  });

  it('segue sozinho para os próximos blocos quando não há erro nem pendência', async () => {
    stubLargeList();
    const { sendMessage, storageSet } = setupChrome(SIAFI_URL);
    loadPopup();
    await waitFor(() => expect(element('siafi-batch-select')).not.toBeDisabled());
    expect(element<HTMLInputElement>('siafi-auto-continue').checked).toBe(true);

    element<HTMLButtonElement>('btn-siafi-fill').click();
    await waitFor(() => expect(element('siafi-fill-status')).toHaveTextContent('Todos os blocos foram preenchidos'));
    expect(sendMessage.mock.calls.map(([, message]) => [message.records.length, message.records[0].cpf]))
      .toEqual([[10, '10000000000'], [10, '10000000010'], [1, '10000000020']]);
    expect(element('siafi-fill-status')).toHaveTextContent('21 favorecido(s) preenchido(s) nos blocos 1-3/3. 21 linha(s) confirmada(s)');
    expect(storageSet.mock.calls.map(([value]) => value['siages-siafi-batch-progress'].offset)).toEqual([10, 20, 21]);
  });

  it('para ao fim do bloco com pendência, sem incluir o próximo', async () => {
    stubLargeList();
    const { sendMessage } = setupChrome(SIAFI_URL);
    sendMessage.mockResolvedValueOnce({ ok: true, matched: true, processed: 10, confirmed: 9, pending: [{ position: 4, reason: 'Sem Pix cadastrado' }] });
    loadPopup();
    await waitFor(() => expect(element('siafi-batch-select')).not.toBeDisabled());

    element<HTMLButtonElement>('btn-siafi-fill').click();
    await waitFor(() => expect(element('siafi-fill-status')).toHaveTextContent('Selecione o Pix das linhas pendentes e confirme-as no SIAFI antes do próximo bloco (2/3)'));
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(element<HTMLSelectElement>('siafi-batch-select').value).toBe('10');
  });

  it('informa os blocos concluídos quando um bloco encadeado falha e oferece a retomada', async () => {
    stubLargeList();
    const { sendMessage } = setupChrome(SIAFI_URL);
    sendMessage
      .mockResolvedValueOnce({ ok: true, matched: true, processed: 10, confirmed: 10, pending: [] })
      .mockResolvedValueOnce({ ok: false, matched: true, processed: 3, confirmed: 3, pending: [], error: 'O menu Pix não carregou em 4 segundos.' });
    loadPopup();
    await waitFor(() => expect(element('siafi-batch-select')).not.toBeDisabled());

    element<HTMLButtonElement>('btn-siafi-fill').click();
    await waitFor(() => expect(element('siafi-fill-status')).toHaveTextContent('1 bloco(s) concluído(s) antes da falha. Bloco 2/3: O menu Pix não carregou em 4 segundos.'));
    expect(sendMessage).toHaveBeenCalledTimes(2);
    const batch = element<HTMLSelectElement>('siafi-batch-select');
    expect(batch.value).toBe('13');
    expect(batch.selectedOptions[0]).toHaveTextContent('Retomar da posição 14: posições 14-21 (próximo)');
    expect(element('siafi-list-info')).toHaveTextContent('Próximo bloco: posições 14-21');
  });

  it('permite escolher o bloco inicial e avisa ao repetir um bloco anterior ao progresso', async () => {
    stubLargeList();
    const { sendMessage } = setupChrome(SIAFI_URL);
    loadPopup();
    const batch = element<HTMLSelectElement>('siafi-batch-select');
    const fill = element<HTMLButtonElement>('btn-siafi-fill');
    await waitFor(() => expect(batch).not.toBeDisabled());
    expect(Array.from(batch.options, (option) => option.textContent))
      .toEqual(['Bloco 1/3: posições 1-10', 'Bloco 2/3: posições 11-20', 'Bloco 3/3: posições 21-21']);

    chooseBatch('20');
    expect(element('siafi-list-info')).toHaveTextContent('Próximo bloco: posições 21-21');
    fill.click();
    await waitFor(() => expect(element('siafi-fill-status')).toHaveTextContent('no bloco 3/3'));
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage.mock.calls[0][1].records).toEqual([{ cpf: '10000000020', valor: 21 }]);

    expect(batch.value).toBe('');
    expect(batch.selectedOptions[0]).toHaveTextContent('Fim da lista alcançado');
    expect(fill).toBeDisabled();
    chooseBatch('0');
    expect(element('siafi-list-info')).toHaveTextContent('Atenção: o bloco escolhido é anterior ao progresso salvo');
    expect(fill).not.toBeDisabled();
    fill.click();
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(3));
    expect(sendMessage.mock.calls[1][1].records[0]).toEqual({ cpf: '10000000000', valor: 1 });
  });

  it('informa quando a sessão da extensão está ausente', async () => {
    const fetchMock = vi.mocked(fetch);
    vi.stubGlobal('SiagesExtensionAuth', { getSession: vi.fn().mockResolvedValue(null) });
    setupChrome('https://siafi.tesouro.gov.br/siafi2026/cpr-comp-ng/');
    loadPopup();

    await waitFor(() => expect(document.getElementById('siafi-fill-status')).toHaveTextContent('Entre no SIAGES'));
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/rest/v1/lc_saved_lists'), expect.anything());
  });

  it('conclui linhas abertas mesmo após terminar os blocos, sem avançar o progresso', async () => {
    const { sendMessage } = setupChrome('https://siafi.tesouro.gov.br/siafi2026/cpr-comp-ng/#/transacoes/inclx');
    loadPopup();
    const fill = document.getElementById('btn-siafi-fill') as HTMLButtonElement;
    const resume = document.getElementById('btn-siafi-resume') as HTMLButtonElement;
    await waitFor(() => expect(document.querySelector('#siafi-list-select option')).toHaveTextContent('Agosto'));
    await waitFor(() => expect(fill).not.toBeDisabled());
    fill.click();
    await waitFor(() => expect(document.getElementById('siafi-fill-status')).toHaveTextContent('1 linha(s) confirmada(s)'));
    expect(fill).toBeDisabled(); expect(resume).not.toBeDisabled();
    const storage = (globalThis as typeof globalThis & { chrome: { storage: { local: { set: ReturnType<typeof vi.fn> } } } }).chrome.storage.local.set;
    const savedCount = storage.mock.calls.length;
    sendMessage.mockResolvedValueOnce({ ok: true, matched: true, processed: 1, confirmed: 0, pending: [{ position: 1, reason: 'Sem Pix cadastrado' }] });
    resume.click();
    await waitFor(() => expect(document.getElementById('siafi-fill-status')).toHaveTextContent('Sem Pix cadastrado'));
    expect(sendMessage.mock.calls[1][1]).toMatchObject({ mode: 'resume', records: [{ cpf: '12345678901', valor: 250 }] });
    expect(storage).toHaveBeenCalledTimes(savedCount);
  });

  it('persiste somente os registros processados antes de uma falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{ id: 'list-1', name: 'Lista', rows: [{ cpf: '12345678901', valor: 250 }, { cpf: '98765432100', valor: 80 }] }] }));
    const { sendMessage } = setupChrome('https://siafi.tesouro.gov.br/siafi2026/cpr-comp-ng/#/transacoes/inclx');
    sendMessage.mockResolvedValueOnce({ ok: false, processed: 1, confirmed: 1, error: 'Confirmação não verificada' });
    loadPopup();
    const fill = document.getElementById('btn-siafi-fill') as HTMLButtonElement;
    await waitFor(() => expect(document.querySelector('#siafi-list-select option')).toHaveTextContent('Lista (2'));
    await waitFor(() => expect(fill).not.toBeDisabled());
    fill.click();
    await waitFor(() => expect(document.getElementById('siafi-fill-status')).toHaveTextContent('Confirmação não verificada'));
    expect(document.getElementById('siafi-list-info')).toHaveTextContent('posições 2-2');
    fill.click();
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
    expect(sendMessage.mock.calls[1][1].records).toEqual([{ cpf: '98765432100', valor: 80 }]);
  });

  it('mantem o card oculto fora do SIAFI', async () => {
    setupChrome('https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/');
    loadPopup();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.getElementById('siafi-favorecidos-card')).toHaveAttribute('hidden');
  });
});
