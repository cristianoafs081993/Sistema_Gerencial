import { readFileSync } from 'node:fs';
import { fireEvent, waitFor } from '@testing-library/dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { extensionFixturePath } from '@/test/extensionFixtures';

const html = readFileSync(extensionFixturePath('popup.html'), 'utf8');
const script = readFileSync(extensionFixturePath('popup.js'), 'utf8');
const preferencesScript = readFileSync(extensionFixturePath('user-preferences.js'), 'utf8');
const KEY = 'siages-user-preferences';
const FORWARD_URL = 'https://suap.ifrn.edu.br/processo_eletronico/processo/encaminhar/498930/';

const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => element<HTMLInputElement>(id);
const select = (id: string) => element<HTMLSelectElement>(id);
const optionValues = (id: string) => Array.from(select(id).options).map((opt) => ({ value: opt.value, text: opt.textContent }));
const shortcuts = () => Array.from(document.querySelectorAll('#forward-list .forward-item .snippet-trigger')).map((item) => item.textContent);
type StoredPreferences = {
  forwardShortcuts: Array<{ shortcut: string; title: string; despacho: string; campus: { id: string; text: string } | null; setor: { id: string; text: string } | null; papel: string }>;
  upload: Record<string, string>;
  despacho: Record<string, string>;
  hiddenSummaryBlocks: string[];
};

const SUAP_CAMPUSES_PAGE_1 = [
  { id: 3, html: '<div>CN</div>', text: 'CN' },
  { id: 1, html: '<div>RE</div>', text: 'RE' },
];
const SUAP_SECTORS_BY_CAMPUS: Record<string, Array<{ id: number; text: string; html: string }>> = {
  '3': [
    {
      id: 841,
      text: 'DG/CN',
      html: '<span class="admin-setor" title="Direção-Geral">DG/CN (Direção-Geral)</span>',
    },
    {
      id: 900,
      text: 'COFIN/CN',
      html: '<span class="admin-setor" title="Coordenação de Finanças e Contratos">COFIN/CN (Coordenação de Finanças e Contratos)</span>',
    },
  ],
  '1': [
    {
      id: 1200,
      text: 'PROAD/RE',
      html: '<span class="admin-setor" title="Pró-Reitoria de Administração">PROAD/RE (Pró-Reitoria de Administração)</span>',
    },
  ],
};
const SUAP_FORWARD_HTML = `
  <form id="tramite_formencaminharparasetor">
    <select name="papel" id="id_papel">
      <option value="">---------</option>
      <option value="19532">ASSISTENTE EM ADMINISTRACAO</option>
      <option value="110853">DIRETOR(A) DE DIRETORIA - SUB-CHEFIA - DIAD/CN</option>
      <option value="22000">CONTADOR</option>
    </select>
  </form>`;

function createSuapFetch({ loginRequired = false }: { loginRequired?: boolean } = {}) {
  return vi.fn(async (rawUrl: string) => {
    const url = new URL(String(rawUrl));
    if (loginRequired) {
      return {
        ok: true,
        status: 200,
        redirected: true,
        url: 'https://suap.ifrn.edu.br/accounts/login/?next=/json/rh/unidadeorganizacional/',
        headers: new Headers({ 'content-type': 'text/html' }),
        json: async () => { throw new Error('html'); },
        text: async () => '<form><input name="username"><input name="password"></form>',
      };
    }
    if (url.pathname === '/json/rh/unidadeorganizacional/') {
      return {
        ok: true,
        status: 200,
        redirected: false,
        url: url.href,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ items: SUAP_CAMPUSES_PAGE_1, total: SUAP_CAMPUSES_PAGE_1.length }),
      };
    }
    if (url.pathname === '/json/rh/setor/') {
      const filterPks = JSON.parse(url.searchParams.get('filter_pks') || '{}') as { uo_id?: string };
      const items = SUAP_SECTORS_BY_CAMPUS[filterPks.uo_id || ''] || [];
      return {
        ok: true,
        status: 200,
        redirected: false,
        url: url.href,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ items, total: items.length }),
      };
    }
    if (url.pathname === '/processo_eletronico/caixa_processos/') {
      return {
        ok: true,
        status: 200,
        redirected: false,
        url: url.href,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => '<a href="/processo_eletronico/processo/encaminhar/498930/">Encaminhar</a>',
      };
    }
    if (url.pathname === '/processo_eletronico/processo/encaminhar/498930/') {
      return {
        ok: true,
        status: 200,
        redirected: false,
        url: url.href,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => SUAP_FORWARD_HTML,
      };
    }
    return { ok: false, status: 404, redirected: false, url: url.href, headers: new Headers(), json: async () => ({}), text: async () => '' };
  });
}

function openPopup({ stored, tabUrl = 'https://example.com', loginRequired = false }: { stored?: unknown; tabUrl?: string; loginRequired?: boolean } = {}) {
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)![1];
  const sync: Record<string, unknown> = stored ? { [KEY]: stored } : {};
  const local: Record<string, unknown> = {};
  const fetchMock = createSuapFetch({ loginRequired });
  vi.stubGlobal('chrome', {
    runtime: { sendMessage: vi.fn(async () => ({ ok: true })) },
    storage: {
      sync: {
        get: vi.fn(async (key: string) => (key in sync ? { [key]: sync[key] } : {})),
        set: vi.fn(async (value: Record<string, unknown>) => { Object.assign(sync, value); }),
      },
      local: {
        get: vi.fn(async (key: string) => (key in local ? { [key]: local[key] } : {})),
        set: vi.fn(async (value: Record<string, unknown>) => { Object.assign(local, value); }),
        remove: vi.fn(),
      },
      onChanged: { addListener: vi.fn() },
    },
    tabs: { query: vi.fn().mockResolvedValue([{ id: 5, url: tabUrl }]) },
  });
  vi.stubGlobal('SiagesExtensionAuth', { getSession: vi.fn().mockResolvedValue(null) });
  vi.stubGlobal('fetch', fetchMock);
  window.eval(preferencesScript);
  new Function(script)();
  return { sync, local, stored: () => sync[KEY] as StoredPreferences, fetchMock };
}

beforeEach(() => localStorage.clear());
afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

it('separa encaminhamentos, modelos de documentos e uploads em submenus e mostra os valores padrão', async () => {
  openPopup();
  const parent = element<HTMLButtonElement>('nav-templates');
  const submenu = element('nav-templates-submenu');
  expect(parent.getAttribute('aria-expanded')).toBe('false');
  expect(submenu.hidden).toBe(true);

  parent.click();
  expect(parent.getAttribute('aria-expanded')).toBe('true');
  expect(submenu.hidden).toBe(false);
  expect(Array.from(submenu.querySelectorAll('.nav-subitem .nav-text')).map((item) => item.textContent)).toEqual([
    'Encaminhamentos',
    'Modelos de documentos',
    'Uploads',
  ]);

  (document.querySelector('.nav-item[data-section="templates-forwards"]') as HTMLButtonElement).click();
  expect(element('templates-forwards-panel').classList.contains('is-active')).toBe(true);
  expect(element('templates-documents-panel').classList.contains('is-active')).toBe(false);
  expect(element('templates-uploads-panel').classList.contains('is-active')).toBe(false);
  await waitFor(() => expect(shortcuts()).toEqual(['encdg']));
  expect(document.querySelector('#forward-list .forward-meta')?.textContent).toBe('Para DG/CN · campus CN · perfil ASSISTENTE EM ADMINISTRACAO');

  (document.querySelector('.nav-item[data-section="templates-documents"]') as HTMLButtonElement).click();
  expect(element('templates-documents-panel').classList.contains('is-active')).toBe(true);
  expect(element('templates-forwards-panel').classList.contains('is-active')).toBe(false);
  expect(input('despacho-destinatario').value).toBe('');
  expect(input('despacho-destinatario').placeholder).toBe('À Coordenação de Finanças e Contratos do Campus {campus}');

  (document.querySelector('.nav-item[data-section="templates-uploads"]') as HTMLButtonElement).click();
  expect(element('templates-uploads-panel').classList.contains('is-active')).toBe(true);
  expect(element('templates-documents-panel').classList.contains('is-active')).toBe(false);
  expect(input('upload-tipo-conferencia').value).toBe('Cópia Simples');
  expect(input('upload-tipo-documento').value).toBe('Liquidação');
});

it('carrega campi, setores e perfis direto do SUAP, filtra setores e salva o atalho sem IDs manuais', async () => {
  const { stored } = openPopup({ tabUrl: FORWARD_URL });
  await waitFor(() => expect(shortcuts()).toEqual(['encdg']));
  element('btn-forward-new').click();
  expect(element('forward-editor').hidden).toBe(false);
  expect(document.getElementById('forward-campus-id')).toBeNull();
  expect(document.getElementById('forward-setor-id')).toBeNull();

  // Campus e perfil partem do primeiro atalho e carregam as listas completas do SUAP.
  expect(select('forward-campus').value).toBe('3');
  expect(select('forward-papel').value).toBe('ASSISTENTE EM ADMINISTRACAO');
  await waitFor(() => expect(optionValues('forward-campus').map((opt) => opt.value)).toEqual(['', '3', '1']));
  await waitFor(() => expect(optionValues('forward-setor').map((opt) => opt.text)).toEqual([
    'Escolha o setor',
    'COFIN/CN — Coordenação de Finanças e Contratos',
    'DG/CN — Direção-Geral',
  ]));
  await waitFor(() => expect(optionValues('forward-papel').map((opt) => opt.value)).toContain('CONTADOR'));

  // Filtrar setor reduz a lista exibida sem perder o texto real do setor.
  input('forward-setor-filter').value = 'finanças';
  fireEvent.input(input('forward-setor-filter'));
  expect(optionValues('forward-setor').map((opt) => opt.value)).toEqual(['', '900']);

  select('forward-setor').value = '900';
  select('forward-papel').value = 'CONTADOR';
  element<HTMLTextAreaElement>('forward-despacho').value = 'Para pagamento.';
  input('forward-shortcut').value = ' EncFin ';
  fireEvent.submit(element('forward-form'));

  await waitFor(() => expect(shortcuts()).toEqual(['encdg', 'encfin']));
  expect(element('forward-editor').hidden).toBe(true);
  expect(stored().forwardShortcuts[1]).toEqual({
    shortcut: 'encfin', title: '', despacho: 'Para pagamento.', campus: { id: '3', text: 'CN' }, setor: { id: '900', text: 'COFIN/CN' }, papel: 'CONTADOR',
  });
  expect(element('forward-message').textContent).toContain('encfin <número do processo>');
});

it('atualiza a lista de setores ao trocar o campus selecionado', async () => {
  openPopup();
  await waitFor(() => expect(shortcuts()).toEqual(['encdg']));
  element('btn-forward-new').click();
  await waitFor(() => expect(optionValues('forward-campus').map((opt) => opt.value)).toContain('1'));

  select('forward-campus').value = '1';
  fireEvent.change(select('forward-campus'));
  await waitFor(() => expect(optionValues('forward-setor').map((opt) => opt.text)).toEqual([
    'Escolha o setor',
    'PROAD/RE — Pró-Reitoria de Administração',
  ]));
});

it('avisa quando o SUAP pede login e recusa atalho reservado ou sem setor', async () => {
  const { sync } = openPopup({ loginRequired: true });
  await waitFor(() => expect(shortcuts()).toEqual(['encdg']));
  element('btn-forward-new').click();
  await waitFor(() => expect(element('forward-catalog-status').textContent).toContain('Faça login no SUAP'));
  expect(element('forward-catalog-status').dataset.error).toBe('true');

  input('forward-shortcut').value = 'encs';
  fireEvent.submit(element('forward-form'));
  await waitFor(() => expect(element('forward-form-message').textContent).toContain('já é um comando da paleta'));
  input('forward-shortcut').value = 'encfin';
  fireEvent.submit(element('forward-form'));
  await waitFor(() => expect(element('forward-form-message').textContent).toContain('setor de destino'));
  expect(sync[KEY]).toBeUndefined();
});

it('edita, remove e desfaz a remoção de um atalho', async () => {
  const { stored } = openPopup();
  await waitFor(() => expect(shortcuts()).toEqual(['encdg']));
  (document.querySelector('[aria-label="Editar encdg"]') as HTMLButtonElement).click();
  expect(element('forward-editor-title').textContent).toBe('Editar atalho encdg');
  input('forward-shortcut').value = 'encdir';
  input('forward-title').value = 'Encaminhar à Direção-Geral';
  fireEvent.submit(element('forward-form'));
  await waitFor(() => expect(shortcuts()).toEqual(['encdir']));
  expect(stored().forwardShortcuts[0]).toMatchObject({ shortcut: 'encdir', title: 'Encaminhar à Direção-Geral', setor: { id: '841', text: 'DG/CN' } });

  (document.querySelector('[aria-label="Remover encdir"]') as HTMLButtonElement).click();
  await waitFor(() => expect(shortcuts()).toEqual([]));
  expect(stored().forwardShortcuts).toEqual([]);
  expect(element('btn-forward-undo').hidden).toBe(false);
  element('btn-forward-undo').click();
  await waitFor(() => expect(shortcuts()).toEqual(['encdir']));
});

it('salva o upload e o modelo do despacho, e volta ao padrão', async () => {
  const { stored } = openPopup();
  await waitFor(() => expect(input('upload-tipo-documento').value).toBe('Liquidação'));
  input('upload-tipo-documento').value = 'Nota Fiscal';
  input('upload-assunto').value = '';
  fireEvent.submit(element('upload-form'));
  await waitFor(() => expect(stored().upload).toEqual({ tipoConferencia: 'Cópia Simples', tipoDocumento: 'Nota Fiscal', assunto: 'Liquidação' }));
  // Campo apagado volta a mostrar o padrão depois de salvar.
  await waitFor(() => expect(input('upload-assunto').value).toBe('Liquidação'));

  input('despacho-destinatario').value = 'À COFIN do Campus {campus}';
  element<HTMLTextAreaElement>('despacho-encaminhamento').value = 'Encaminhe-se à DG.\nCumpra-se.';
  fireEvent.submit(element('despacho-form'));
  await waitFor(() => expect(stored().despacho).toMatchObject({ destinatario: 'À COFIN do Campus {campus}', encaminhamento: 'Encaminhe-se à DG.\nCumpra-se.' }));

  element('btn-despacho-reset').click();
  await waitFor(() => expect(stored().despacho).toEqual({ destinatario: '', assunto: '', encaminhamento: '', fecho: '' }));
  await waitFor(() => expect(element('despacho-message').textContent).toContain('texto padrão'));
  expect(input('despacho-destinatario').value).toBe('');
});

it('marca e desmarca os blocos da aba Resumo do painel do processo', async () => {
  const { stored } = openPopup();
  (document.querySelector('.nav-item[data-section="process-panel"]') as HTMLButtonElement).click();
  expect(element('process-panel-view').classList.contains('is-active')).toBe(true);
  const checkbox = (id: string) => document.querySelector(`#summary-blocks input[data-block="${id}"]`) as HTMLInputElement;
  await waitFor(() => expect(document.querySelectorAll('#summary-blocks input[type="checkbox"]')).toHaveLength(8));
  expect(Array.from(document.querySelectorAll<HTMLInputElement>('#summary-blocks input')).every((input) => input.checked)).toBe(true);

  checkbox('dados-bancarios').click();
  checkbox('lista-credores').click();
  await waitFor(() => expect(stored().hiddenSummaryBlocks).toEqual(['dados-bancarios', 'lista-credores']));
  await waitFor(() => expect(element('summary-blocks-message').textContent).toBe('Resumo atualizado: 6 de 8 blocos visíveis.'));
  expect(document.querySelector('[data-nav-badge="process-panel"]')?.textContent).toBe('6/8');
  expect(checkbox('dados-bancarios').checked).toBe(false);

  element('btn-summary-blocks-all').click();
  await waitFor(() => expect(stored().hiddenSummaryBlocks).toEqual([]));
  await waitFor(() => expect(document.querySelector('[data-nav-badge="process-panel"]')?.hasAttribute('hidden')).toBe(true));
  expect(checkbox('dados-bancarios').checked).toBe(true);
});

it('não oferece a seção quando o módulo de preferências não está disponível', async () => {
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)![1];
  localStorage.setItem('siages-popup-section', 'templates');
  vi.stubGlobal('chrome', {
    runtime: { sendMessage: vi.fn(async () => ({ ok: true })) },
    storage: { local: { get: vi.fn(async () => ({})) }, onChanged: { addListener: vi.fn() } },
    tabs: { query: vi.fn().mockResolvedValue([]) },
  });
  vi.stubGlobal('SiagesExtensionAuth', { getSession: vi.fn().mockResolvedValue(null) });
  vi.stubGlobal('SiagesUserPreferences', undefined);
  new Function(script)();
  await waitFor(() => expect(element('nav-templates-group').hidden).toBe(true));
  expect(element('nav-templates').hidden).toBe(true);
  expect(element('nav-process-panel').hidden).toBe(true);
  expect(element('templates-forwards-panel').classList.contains('is-active')).toBe(false);
  expect(element('templates-documents-panel').classList.contains('is-active')).toBe(false);
  expect(element('templates-uploads-panel').classList.contains('is-active')).toBe(false);
});
