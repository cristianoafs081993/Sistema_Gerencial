import { readFileSync } from 'node:fs';
import { waitFor } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

type ExtensionApi = {
  getProcessId: () => string | null;
  getProcessNumber: () => string;
  buildContext: (session?: unknown) => { payload: { suapId: string; processNumber: string } } | null;
  installToolkit: () => Promise<void>;
  renderFinanceSummary: (summary: unknown) => void;
  openModal: () => void;
  closeModal: () => void;
  selectTab: (tab: string) => void;
  normalizeSnippetKey: (value: string) => string;
};

const localValues: Record<string, unknown> = {
  'siages-extension-session': { accessToken: 'access', refreshToken: 'refresh', expiresAt: Date.now() / 1000 + 3600 },
};
const syncValues: Record<string, unknown> = {};

function storageArea(values: Record<string, unknown>) {
  return {
    get: vi.fn((key: string, callback: (result: Record<string, unknown>) => void) => callback({ [key]: values[key] })),
    set: vi.fn((entries: Record<string, unknown>, callback?: () => void) => { Object.assign(values, entries); callback?.(); }),
    remove: vi.fn((key: string, callback?: () => void) => { delete values[key]; callback?.(); }),
  };
}

function loadProcessScript() {
  const testWindow = window as typeof window & {
    __SIAGES_SUAP_PROCESS_TEST__?: boolean;
    __siagesSuapProcessDocument?: ExtensionApi;
    chrome?: unknown;
  };
  testWindow.__SIAGES_SUAP_PROCESS_TEST__ = true;
  testWindow.chrome = {
    storage: { local: storageArea(localValues), sync: storageArea(syncValues), onChanged: { addListener: vi.fn() } },
  };
  window.eval(readFileSync(extensionFixturePath('process-document.js'), 'utf8'));
  if (!testWindow.__siagesSuapProcessDocument) throw new Error('Content script nao carregado.');
  return testWindow.__siagesSuapProcessDocument;
}

function financeSummary() {
  return {
    status: 'ready', beneficiario: { nome: 'Fornecedor Alfa' }, contrato: { numero: '00040/2026' }, escopoContrato: true,
    totais: { empenhado: 1000, saldo: 700 },
    empenhos: [{ numero: '2026NE000001', empenhado: 1000, saldo: 700, liquidacoes: [
      { numero: 'NF 123', data: '2026-02-20', situacao: 'Liquidada', valor: 280 },
      { numero: 'NF 124', data: '2026-02-21', situacao: 'Siafi Apropriado', valor: 20 },
    ] }],
  };
}

describe('process-document 1.9', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main><aside id="timeline"><div>Recebido por COFINC/CN</div><div>Encaminhado por DIAD/CN</div></aside><p>Processo 23035.000001.2026-11</p></main>';
    window.history.replaceState(null, '', '/processo_eletronico/processo/321/');
    localValues['siages-extension-session'] = { accessToken: 'access', refreshToken: 'refresh', expiresAt: Date.now() / 1000 + 3600 };
    localValues['siages-toolkit-theme'] = 'dark';
    localValues['siages-toolkit-collapsed'] = false;
    syncValues['siages-snippets'] = { '/cn': 'Currais Novos' };
  });

  afterEach(() => {
    const testWindow = window as typeof window & Record<string, unknown>;
    delete testWindow.__SIAGES_SUAP_PROCESS_TEST__;
    delete testWindow.__siagesSuapProcessDocument;
    delete testWindow.chrome;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reconhece as duas rotas de processo e gera contexto sem tokens por padrao', () => {
    let api = loadProcessScript();
    expect(api.getProcessId()).toBe('321');
    expect(api.getProcessNumber()).toBe('23035.000001.2026-11');
    expect(api.buildContext()).toMatchObject({ payload: { suapId: '321', processNumber: '23035.000001.2026-11' } });

    delete (window as typeof window & Record<string, unknown>).__siagesSuapProcessDocument;
    window.history.replaceState(null, '', '/processo_eletronico/visualizar_processo/654/');
    api = loadProcessScript();
    expect(api.getProcessId()).toBe('654');
  });

  it('injeta uma unica vez no topo da lateral e cria as cinco abas', async () => {
    const api = loadProcessScript();
    await api.installToolkit();
    await api.installToolkit();

    const root = document.getElementById('siages-suap-toolkit');
    expect(document.querySelectorAll('#siages-suap-toolkit')).toHaveLength(1);
    expect(document.getElementById('timeline')?.firstElementChild).toBe(root);
    expect(root?.querySelectorAll('[role="tab"]')).toHaveLength(5);
    expect(root?.querySelector('[data-tab="summary"]')?.getAttribute('aria-selected')).toBe('true');
    expect(root?.dataset.theme).toBe('dark');
  });

  it('persiste recolhimento e troca de tema sem alterar o body do SUAP', async () => {
    const api = loadProcessScript();
    await api.installToolkit();
    const root = document.getElementById('siages-suap-toolkit')!;
    const originalBodyClass = document.body.className;

    (root.querySelector('[data-action="collapse"]') as HTMLButtonElement).click();
    (root.querySelector('[data-action="theme"]') as HTMLButtonElement).click();

    await waitFor(() => expect(root.dataset.collapsed).toBe('true'));
    expect(root.dataset.theme).toBe('light');
    expect(localValues['siages-toolkit-collapsed']).toBe(true);
    expect(localValues['siages-toolkit-theme']).toBe('light');
    expect(document.body.className).toBe(originalBodyClass);
  });

  it('renderiza snapshot com copia individual e lista de empenhos', async () => {
    const api = loadProcessScript();
    await api.installToolkit();
    await waitFor(() => expect(document.getElementById('siages-suap-finance-frame')).toBeTruthy());
    const frame = document.getElementById('siages-suap-finance-frame') as HTMLIFrameElement;
    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://www.siages.com.br', source: frame.contentWindow,
      data: { source: 'siages', type: 'siages:suap-process-snapshot', version: 1, payload: {
        fallback: { suapId: '321', processNumber: '23035.000001.2026-11' },
        process: { suapId: '321', numProcesso: '23035.000001.2026-11', status: 'success', beneficiario: 'Fornecedor Alfa', cpfCnpj: '12345678000190', assunto: 'Servico', dadosCompletos: { val_nf: '1.250,00', notas_fiscais: [{ numero: 'DANFE 2350', data_emissao: '2026-01-10', valor: '100,00' }, { numero: 'DANFE 2347', data_emissao: '2026-01-11', valor: '80,00' }], empenhos: ['2026NE000001', '2026NE000002'], dados_bancarios: { banco: 'Banco do Brasil', agencia: '1234', conta: '5678-9' }, retencoes_tributarias: { optante_simples_nacional: true, iss: '25,00', ir: '37,35', csll: '15,56', cofins: '37,65', pis_pasep: '8,16' } } },
      } },
    }));

    const summary = document.querySelector('[data-panel="summary"]');
    expect(summary).toHaveTextContent('Fornecedor Alfa');
    expect(summary).toHaveTextContent('DANFE 2350');
    expect(summary).toHaveTextContent('DANFE 2347');
    expect(summary).not.toHaveTextContent('Status');
    expect(summary).not.toHaveTextContent('Atualizado');
    expect(summary).toHaveTextContent('Banco do Brasil');
    expect(summary).toHaveTextContent('Empenhos');
    expect(summary).not.toHaveTextContent('Retenções e empenhos');
    expect(summary).not.toHaveTextContent('Regime');
    expect(summary).not.toHaveTextContent('ISS');
    expect(summary).not.toHaveTextContent('INSS');
    expect(summary).not.toHaveTextContent('IR');
    expect(summary).not.toHaveTextContent('CSLL');
    expect(summary).not.toHaveTextContent('COFINS');
    expect(summary).not.toHaveTextContent('PIS/PASEP');
    expect(summary).not.toHaveTextContent('25,00');
    expect(summary).toHaveTextContent('2026NE000002');
    expect(summary?.querySelectorAll('.suape-copy').length).toBeGreaterThan(8);
  });
  it('mantem as retenções quando o processo tem uma única nota', async () => {
    const api = loadProcessScript();
    await api.installToolkit();
    await waitFor(() => expect(document.getElementById('siages-suap-finance-frame')).toBeTruthy());
    const frame = document.getElementById('siages-suap-finance-frame') as HTMLIFrameElement;
    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://www.siages.com.br', source: frame.contentWindow,
      data: { source: 'siages', type: 'siages:suap-process-snapshot', version: 1, payload: {
        fallback: { suapId: '321', processNumber: '23035.000001.2026-11' },
        process: { suapId: '321', numProcesso: '23035.000001.2026-11', status: 'success', dadosCompletos: { notas_fiscais: [{ numero: 'DANFE 2350', data_emissao: '2026-01-10', valor: '100,00' }], empenhos: ['2026NE000001'], retencoes_tributarias: { optante_simples_nacional: true, iss: '25,00' } } },
      } },
    }));

    const summary = document.querySelector('[data-panel="summary"]');
    expect(summary).toHaveTextContent('Retenções e empenhos');
    expect(summary).toHaveTextContent('Regime');
    expect(summary).toHaveTextContent('ISS');
    expect(summary).toHaveTextContent('25,00');
    expect(summary).toHaveTextContent('2026NE000001');
  });

  it('normaliza empenhos, remove duplicados e nunca renderiza objetos brutos', async () => {
    const api = loadProcessScript();
    await api.installToolkit();
    await waitFor(() => expect(document.getElementById('siages-suap-finance-frame')).toBeTruthy());
    const frame = document.getElementById('siages-suap-finance-frame') as HTMLIFrameElement;
    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://www.siages.com.br', source: frame.contentWindow,
      data: { source: 'siages', type: 'siages:suap-process-snapshot', version: 1, payload: {
        fallback: { suapId: '321', processNumber: '23035.000001.2026-11' },
        process: { suapId: '321', numProcesso: '23035.000001.2026-11', status: 'success', dadosCompletos: { empenhos: [
          { numero: '2026NE000060' }, '158366264352026NE000060', { empenho: '158366264352025NE000297' }, '47NE2024', { invalido: true },
        ] } },
      } },
    }));

    const values = Array.from(document.querySelectorAll('[data-panel="summary"] .suape-mono'))
      .map((element) => element.textContent)
      .filter((value): value is string => Boolean(value?.match(/^20\d{2}NE\d{6}/)));
    expect(values).toEqual(['2026NE000060', '2025NE000297', '2026NE000060, 2025NE000297']);
    expect(document.querySelector('[data-panel="summary"]')).not.toHaveTextContent('[object Object]');
    expect(document.querySelector('[data-panel="summary"]')).not.toHaveTextContent('47NE2024');
  });
  it('preserva o resumo financeiro com empenhos e liquidacoes sem pagamento', async () => {
    const api = loadProcessScript();
    await api.installToolkit();
    api.renderFinanceSummary(financeSummary());
    api.selectTab('finance');

    const finance = document.getElementById('siages-suap-finance-panel');
    expect(finance).toHaveTextContent('Fornecedor Alfa');
    expect(finance).toHaveTextContent('00040/2026');
    expect(finance).toHaveTextContent('Empenhado');
    expect(finance).not.toHaveTextContent(/SIAGES - Empenhos do benefici?rio/i);
    expect(finance?.querySelector('.suape-liquidations')?.style.display).toBe('none');
    const commitmentToggle = finance?.querySelector('button[aria-expanded="false"]') as HTMLButtonElement;
    expect(commitmentToggle).toHaveTextContent('2026NE000001');
    commitmentToggle.click();
    expect(commitmentToggle.getAttribute('aria-expanded')).toBe('true');
    expect(finance?.querySelector('.suape-liquidations')?.style.display).toBe('grid');
    expect(finance).toHaveTextContent('NF 123');
    expect(finance).toHaveTextContent('NF 124');
    expect(finance?.textContent).not.toMatch(/pago|pagamento/i);
  });

  it('mantem o gerador em modal e nao duplica a abertura', async () => {
    const api = loadProcessScript();
    await api.installToolkit();
    api.openModal();
    api.openModal();
    expect(document.querySelectorAll('#siages-suap-dispatch-modal')).toHaveLength(1);
    expect(document.getElementById('siages-suap-dispatch-frame')).toBeTruthy();
    api.closeModal();
    expect(document.getElementById('siages-suap-dispatch-modal')).toBeNull();
  });

  it('nao injeta o toolkit fora de uma rota de processo', async () => {
    window.history.replaceState(null, '', '/plan_estrategico/plano_concluido/8/');
    const api = loadProcessScript();
    await api.installToolkit();
    expect(api.getProcessId()).toBeNull();
    expect(document.getElementById('siages-suap-toolkit')).toBeNull();
  });

  it('normaliza chaves de atalhos', () => {
    const api = loadProcessScript();
    expect(api.normalizeSnippetKey(' CN ')).toBe('/cn');
    expect(api.normalizeSnippetKey('/Lei 14133')).toBe('/lei14133');
  });

  it('isola o formulario de login dos estilos globais do SUAP', async () => {
    const toolkitStyle = document.createElement('style');
    toolkitStyle.textContent = readFileSync(extensionFixturePath('process-toolkit.css'), 'utf8');
    document.head.appendChild(toolkitStyle);
    const hostileStyle = document.createElement('style');
    hostileStyle.textContent = '#timeline form label { float:left; position:absolute; width:50%; opacity:.05; grid-area:label } #timeline form input { position:absolute; width:20%; opacity:.05; grid-area:input } #timeline form button { float:left; width:49% }';
    document.head.appendChild(hostileStyle);
    const api = loadProcessScript();
    await api.installToolkit();
    api.selectTab('settings');

    const form = document.querySelector('.suape-auth-form') as HTMLFormElement;
    const label = form.querySelector('label') as HTMLLabelElement;
    const input = form.elements.namedItem('email') as HTMLInputElement;
    const button = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(form).toBeTruthy();
    expect(getComputedStyle(label).position).toBe('static');
    expect(getComputedStyle(label).float).toBe('none');
    expect(getComputedStyle(label).gridArea).toBe('auto');
    expect(getComputedStyle(input).position).toBe('static');
    expect(getComputedStyle(input).opacity).toBe('1');
    expect(getComputedStyle(input).gridArea).toBe('auto');
    expect(getComputedStyle(button).float).toBe('none');
    hostileStyle.remove();
    toolkitStyle.remove();
  });

  it('mantem atalhos, campos e titulos das abas alinhados contra estilos globais', async () => {
    const toolkitStyle = document.createElement('style');
    toolkitStyle.textContent = readFileSync(extensionFixturePath('process-toolkit.css'), 'utf8');
    document.head.appendChild(toolkitStyle);
    const hostileStyle = document.createElement('style');
    hostileStyle.textContent = '#timeline form.suape-form label { float:left; position:absolute; width:50%; grid-area:label; writing-mode:vertical-rl } #timeline form.suape-form input, #timeline form.suape-form textarea { position:absolute; width:20%; grid-area:input; writing-mode:vertical-rl } #timeline .suape-snippet > * { grid-area:input; writing-mode:vertical-rl } #timeline .suape-tab { display:block; writing-mode:vertical-rl }';
    document.head.appendChild(hostileStyle);
    const api = loadProcessScript();
    await api.installToolkit();
    api.selectTab('shortcuts');

    const root = document.getElementById('siages-suap-toolkit')!;
    const form = root.querySelector('[data-panel="shortcuts"] form') as HTMLFormElement;
    const label = form.querySelector('label') as HTMLLabelElement;
    const textarea = form.querySelector('textarea') as HTMLTextAreaElement;
    const snippet = root.querySelector('.suape-snippet') as HTMLElement;
    const expansion = root.querySelector('.suape-expansion') as HTMLElement;
    const tab = root.querySelector('[data-tab="shortcuts"]') as HTMLButtonElement;

    expect(getComputedStyle(label).position).toBe('static');
    expect(getComputedStyle(label).gridArea).toBe('auto');
    expect(getComputedStyle(textarea).position).toBe('static');
    expect(getComputedStyle(textarea).gridArea).toBe('auto');
    expect(getComputedStyle(snippet).display).toBe('grid');
    expect(getComputedStyle(expansion).writingMode).toBe('horizontal-tb');
    expect(getComputedStyle(tab).display).toBe('flex');
    expect(getComputedStyle(tab).writingMode).toBe('horizontal-tb');
    hostileStyle.remove();
    toolkitStyle.remove();
  });

  it('autentica pelo formulario e persiste a sessao da extensao', async () => {
    delete localValues['siages-extension-session'];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ access_token: 'novo-access', refresh_token: 'novo-refresh', expires_in: 3600 }),
    }));
    const api = loadProcessScript();
    await api.installToolkit();
    api.selectTab('settings');

    const form = document.querySelector('.suape-auth-form') as HTMLFormElement;
    (form.elements.namedItem('email') as HTMLInputElement).value = 'usuario@ifrn.edu.br';
    (form.elements.namedItem('password') as HTMLInputElement).value = 'senha-segura';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => expect(localValues['siages-extension-session']).toMatchObject({
      accessToken: 'novo-access', refreshToken: 'novo-refresh',
    }));
    expect(form.querySelector('[data-auth-message]')).toHaveTextContent('Sessão ativa.');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/auth/v1/token?grant_type=password'), expect.objectContaining({ method: 'POST' }));
  });

  it('traduz 401 do Supabase em erro de credencial e nao cria sessao', async () => {
    delete localValues['siages-extension-session'];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ error: 'invalid_grant' }),
    }));
    const api = loadProcessScript();
    await api.installToolkit();
    api.selectTab('settings');

    const form = document.querySelector('.suape-auth-form') as HTMLFormElement;
    (form.querySelector('input[name="email"]') as HTMLInputElement).value = 'usuario@ifrn.edu.br';
    (form.querySelector('input[name="password"]') as HTMLInputElement).value = 'senha-segura';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => expect(form.querySelector('[data-auth-message]')).toHaveTextContent('E-mail ou senha do SIAGES inválidos'));
    expect(localValues['siages-extension-session']).toBeUndefined();
  });

  it('traduz 400 invalid_grant do Supabase em erro de credencial', async () => {
    delete localValues['siages-extension-session'];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
    }));
    const api = loadProcessScript();
    await api.installToolkit();
    api.selectTab('settings');

    const form = document.querySelector('.suape-auth-form') as HTMLFormElement;
    (form.querySelector('input[name="email"]') as HTMLInputElement).value = 'usuario@ifrn.edu.br';
    (form.querySelector('input[name="password"]') as HTMLInputElement).value = 'senha-segura';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => expect(form.querySelector('[data-auth-message]')).toHaveTextContent('E-mail ou senha do SIAGES inválidos'));
    expect(localValues['siages-extension-session']).toBeUndefined();
  });

  it('orienta recarregar a pagina quando o contexto da extensao foi invalidado', async () => {
    delete localValues['siages-extension-session'];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ access_token: 'novo-access', refresh_token: 'novo-refresh', expires_in: 3600 }),
    }));
    const api = loadProcessScript();
    await api.installToolkit();
    api.selectTab('settings');

    const chromeApi = (window as typeof window & { chrome?: any }).chrome;
    chromeApi.storage.local.set = vi.fn(() => { throw new Error('Extension context invalidated.'); });
    const form = document.querySelector('.suape-auth-form') as HTMLFormElement;
    (form.elements.namedItem('email') as HTMLInputElement).value = 'usuario@ifrn.edu.br';
    (form.elements.namedItem('password') as HTMLInputElement).value = 'senha-segura';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => expect(form.querySelector('[data-auth-message]')).toHaveTextContent('A extensão foi atualizada. Recarregue a página do SUAP e tente novamente.'));
    expect(localValues['siages-extension-session']).toBeUndefined();
  });
  it('explica que matricula do SUAP nao substitui o e-mail do SIAGES', async () => {
    delete localValues['siages-extension-session'];
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const api = loadProcessScript();
    await api.installToolkit();
    api.selectTab('settings');

    const form = document.querySelector('.suape-auth-form') as HTMLFormElement;
    (form.elements.namedItem('email') as HTMLInputElement).value = '1234567';
    (form.elements.namedItem('password') as HTMLInputElement).value = 'senha';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(form.querySelector('[data-auth-message]')).toHaveTextContent('A matrícula do SUAP não autentica neste campo.');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
