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
const setorListOptions = () => Array.from(document.querySelectorAll('#forward-setor-options [role="option"]')).map((item) => item.textContent);
const rowShortcuts = (listId: string) => Array.from(document.querySelectorAll(`#${listId} .shortcut-row .snippet-trigger`)).map((item) => item.textContent);
const shortcuts = () => rowShortcuts('forward-list');
const rowMeta = (listId: string) => Array.from(document.querySelectorAll(`#${listId} .shortcut-row .shortcut-meta`)).map((item) => item.textContent);
const clickLabel = (label: string) => (document.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement).click();
const DOCUMENT_URL = 'https://suap.ifrn.edu.br/documento_eletronico/visualizar_documento/1026154/';
type StoredPreferences = {
  forwardShortcuts: Array<{ shortcut: string; title: string; despacho: string; campus: { id: string; text: string } | null; setor: { id: string; text: string } | null; papel: string }>;
  uploadShortcuts: Array<{ shortcut: string; title: string; tipoConferencia: string; tipoDocumento: string; assunto: string }>;
  documentShortcuts: Array<{ shortcut: string; title: string; templateId: string; assunto: string; texto: string }>;
  upload: Record<string, string>;
  despacho: Record<string, string>;
  despachoModelos: Record<string, Record<string, string>>;
  hiddenSummaryBlocks: string[];
};

const SUAP_CAMPUSES_PAGE_1 = [
  { id: 3, html: '<div>CN</div>', text: 'CN' },
  { id: 1, html: '<div>RE</div>', text: 'RE' },
  { id: 9, html: '<div>MO</div>', text: 'MO' },
  { id: 16, html: '<div>PF</div>', text: 'PF' },
];
const PF_SECTORS = Array.from({ length: 47 }, (_, index) => ({
  id: 3000 + index,
  text: `SET${String(index + 1).padStart(2, '0')}/PF`,
  html: `<span class="admin-setor" title="Setor ${index + 1}">SET${index + 1}/PF</span>`,
}));
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
  '9': [
    {
      id: 1500,
      text: 'DG/MO',
      html: '<span class="admin-setor" title="Direção-Geral">DG/MO (Direção-Geral)</span>',
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
      if (filterPks.uo_id === '16') {
        const page = Number(url.searchParams.get('page') || '1');
        const items = PF_SECTORS.slice((page - 1) * 10, page * 10);
        return {
          ok: true,
          status: 200,
          redirected: false,
          url: url.href,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ items }),
        };
      }
      // Setor que só aparece quando se pesquisa (como o SUAP pode fazer com listas longas).
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const searchOnly = filterPks.uo_id === '3' && q
        ? [{ id: 950, text: 'DIAD/CN', html: '<span class="admin-setor" title="Diretoria Acadêmica">DIAD/CN</span>' }]
        : [];
      const items = [...(SUAP_SECTORS_BY_CAMPUS[filterPks.uo_id || ''] || []), ...searchOnly]
        .filter((item) => !q || item.text.toLowerCase().includes(q) || item.html.toLowerCase().includes(q));
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

function openPopup({ stored, tabUrl = 'https://example.com', loginRequired = false, campusUasg }: { stored?: unknown; tabUrl?: string; loginRequired?: boolean; campusUasg?: string } = {}) {
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)![1];
  const sync: Record<string, unknown> = stored ? { [KEY]: stored } : {};
  const local: Record<string, unknown> = campusUasg ? { 'siages-user-campus-uasg': campusUasg } : {};
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
  // Cada atalho é uma linha: atalho, nome, resumo, Editar e Excluir.
  const row = document.querySelector('#forward-list .shortcut-row')!;
  expect(row.querySelector('.shortcut-name')?.textContent).toBe('Encaminhar à DG para Autorização de Pagamento');
  expect(rowMeta('forward-list')).toEqual(['Para DG/CN · campus CN · perfil ASSISTENTE EM ADMINISTRACAO']);
  expect(Array.from(row.querySelectorAll('.row-actions button')).map((button) => button.getAttribute('aria-label'))).toEqual(['Editar encdg', 'Excluir encdg']);

  (document.querySelector('.nav-item[data-section="templates-documents"]') as HTMLButtonElement).click();
  expect(element('templates-documents-panel').classList.contains('is-active')).toBe(true);
  expect(element('templates-forwards-panel').classList.contains('is-active')).toBe(false);
  // Um modelo de despacho do SIAGES por finalidade, cada um numa linha.
  expect(rowShortcuts('despacho-list')).toEqual(['servico', 'aquisicao', 'projeto', 'bolsa', 'transporte', 'pafe', 'moradia']);
  expect(rowMeta('despacho-list').every((meta) => meta?.startsWith('Padrão do SIAGES · Considerando'))).toBe(true);
  expect(element('despacho-editor').hidden).toBe(true);
  expect(rowShortcuts('document-list')).toEqual([]);
  expect(element('document-list').textContent).toContain('Nenhum atalho de documento');

  (document.querySelector('.nav-item[data-section="templates-uploads"]') as HTMLButtonElement).click();
  expect(element('templates-uploads-panel').classList.contains('is-active')).toBe(true);
  expect(element('templates-documents-panel').classList.contains('is-active')).toBe(false);
  expect(rowShortcuts('upload-list')).toEqual(['up']);
  expect(rowMeta('upload-list')).toEqual(['Padrão · Liquidação · Cópia Simples · assunto Liquidação']);
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
  await waitFor(() => expect(optionValues('forward-campus').map((opt) => opt.value)).toEqual(['', '3', '9', '16', '1']));
  await waitFor(() => expect(optionValues('forward-setor').map((opt) => opt.text)).toEqual([
    'Escolha o setor',
    'COFIN/CN — Coordenação de Finanças e Contratos',
    'DG/CN — Direção-Geral',
  ]));
  await waitFor(() => expect(optionValues('forward-papel').map((opt) => opt.value)).toContain('CONTADOR'));

  // A pesquisa acontece no próprio seletor: sem filtro separado, a lista abre abaixo do campo.
  expect(document.getElementById('forward-setor-filter')).toBeNull();
  const search = input('forward-setor-search');
  expect(search.value).toBe('');
  fireEvent.focus(search);
  expect(element('forward-setor-options').hidden).toBe(false);
  expect(setorListOptions()).toEqual(['COFIN/CN — Coordenação de Finanças e Contratos', 'DG/CN — Direção-Geral']);
  search.value = 'finanças';
  fireEvent.input(search);
  expect(setorListOptions()).toEqual(['COFIN/CN — Coordenação de Finanças e Contratos']);
  fireEvent.keyDown(search, { key: 'Enter' });
  expect(element('forward-setor-options').hidden).toBe(true);
  expect(select('forward-setor').value).toBe('900');
  expect(search.value).toBe('COFIN/CN — Coordenação de Finanças e Contratos');

  select('forward-papel').value = 'CONTADOR';
  element<HTMLTextAreaElement>('forward-despacho').value = 'Para pagamento.';
  input('forward-shortcut').value = ' EncFin ';
  fireEvent.submit(element('forward-form'));

  await waitFor(() => expect(shortcuts()).toEqual(['encdg', 'encfin']));
  expect(element('forward-editor').hidden).toBe(true);
  expect(stored().forwardShortcuts[1]).toEqual({
    shortcut: 'encfin', title: '', despacho: 'Para pagamento.', campus: { id: '3', text: 'CN' }, setor: { id: '900', text: 'COFIN/CN' }, papel: 'CONTADOR',
  });
  expect(element('forward-message').textContent).toContain('encfin <ID do processo>');
});

it('carrega todos os setores do campus mesmo com páginas curtas e sem total, e pesquisa por clique', async () => {
  openPopup();
  await waitFor(() => expect(shortcuts()).toEqual(['encdg']));
  element('btn-forward-new').click();
  await waitFor(() => expect(optionValues('forward-campus').map((opt) => opt.value)).toContain('16'));
  select('forward-campus').value = '16';
  fireEvent.change(select('forward-campus'));
  await waitFor(() => expect(optionValues('forward-setor')).toHaveLength(48));
  const search = input('forward-setor-search');
  fireEvent.focus(search);
  expect(setorListOptions()).toHaveLength(47);
  search.value = 'set47';
  fireEvent.input(search);
  expect(setorListOptions()).toEqual(['SET47/PF — Setor 47']);
  fireEvent.click(element('forward-setor-options').querySelector('[role="option"]')!);
  expect(select('forward-setor').value).toBe('3046');
  expect(search.value).toBe('SET47/PF — Setor 47');
  // Esc fecha e devolve o setor escolhido ao campo.
  fireEvent.focus(search);
  search.value = 'xyz';
  fireEvent.input(search);
  // Primeiro consulta o SUAP; sem resultado, avisa que nada foi encontrado.
  await waitFor(() => expect(element('forward-setor-options').textContent).toBe('Nenhum setor encontrado'));
  fireEvent.keyDown(search, { key: 'Escape' });
  expect(search.value).toBe('SET47/PF — Setor 47');
});

it('pesquisa o setor também no SUAP quando ele não está na lista carregada', async () => {
  const { fetchMock } = openPopup();
  await waitFor(() => expect(shortcuts()).toEqual(['encdg']));
  element('btn-forward-new').click();
  await waitFor(() => expect(optionValues('forward-setor')).toHaveLength(3));
  const search = input('forward-setor-search');
  fireEvent.focus(search);
  search.value = 'diad';
  fireEvent.input(search);
  expect(element('forward-setor-options').textContent).toBe('Pesquisando no SUAP…');
  await waitFor(() => expect(setorListOptions()).toEqual(['DIAD/CN — Diretoria Acadêmica']));
  expect(fetchMock.mock.calls.some(([rawUrl]) => new URL(String(rawUrl)).searchParams.get('q') === 'diad')).toBe(true);
  fireEvent.keyDown(search, { key: 'Enter' });
  expect(select('forward-setor').value).toBe('950');
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

  clickLabel('Excluir encdir');
  await waitFor(() => expect(shortcuts()).toEqual([]));
  expect(stored().forwardShortcuts).toEqual([]);
  expect(element('btn-forward-undo').hidden).toBe(false);
  element('btn-forward-undo').click();
  await waitFor(() => expect(shortcuts()).toEqual(['encdir']));
});

it('oferece restaurar encdg e up quando as listas foram esvaziadas', async () => {
  const { stored } = openPopup({ stored: { forwardShortcuts: [], uploadShortcuts: [] } });
  await waitFor(() => expect(element('forward-list').textContent).toContain('Nenhum atalho de encaminhamento'));
  const restoreForward = Array.from(element('forward-list').querySelectorAll('button')).find((button) => button.textContent === 'Restaurar o atalho padrão encdg')!;
  restoreForward.click();
  await waitFor(() => expect(shortcuts()).toEqual(['encdg']));
  expect(stored().forwardShortcuts[0]).toMatchObject({ shortcut: 'encdg', setor: { id: '841', text: 'DG/CN' } });
  expect(element('forward-message').textContent).toBe('Atalho encdg restaurado.');

  const restoreUpload = Array.from(element('upload-list').querySelectorAll('button')).find((button) => button.textContent === 'Restaurar o atalho padrão up')!;
  restoreUpload.click();
  await waitFor(() => expect(rowShortcuts('upload-list')).toEqual(['up']));
  // Documentos não têm atalho padrão.
  expect(element('document-list').querySelector('button')).toBeNull();
});

it('aponta o encdg de fábrica para a Direção-Geral do campus configurado em Sua conta', async () => {
  const { stored } = openPopup({ campusUasg: '158365' });
  await waitFor(() => expect(stored()?.forwardShortcuts?.[0]).toMatchObject({
    shortcut: 'encdg',
    campus: { id: '9', text: 'MO' },
    setor: { id: '1500', text: 'DG/MO' },
    papel: 'ASSISTENTE EM ADMINISTRACAO',
  }));
  await waitFor(() => expect(rowMeta('forward-list')).toEqual(['Para DG/MO · campus MO · perfil ASSISTENTE EM ADMINISTRACAO']));
  expect(element('forward-message').textContent).toContain('DG/MO');
});

it('não altera um encdg editado pelo servidor ao trocar o campus', async () => {
  const edited = {
    forwardShortcuts: [{ shortcut: 'encdg', title: 'Encaminhar ao diretor', despacho: 'Ao DG.', campus: { id: '3', text: 'CN' }, setor: { id: '841', text: 'DG/CN' }, papel: 'CONTADOR' }],
  };
  const { sync } = openPopup({ stored: edited, campusUasg: '158365' });
  await waitFor(() => expect(shortcuts()).toEqual(['encdg']));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect((sync[KEY] as StoredPreferences).forwardShortcuts[0].setor).toEqual({ id: '841', text: 'DG/CN' });
});

it('restaura o encdg com a Direção-Geral do campus configurado', async () => {
  const { stored } = openPopup({ stored: { forwardShortcuts: [] }, campusUasg: '158365' });
  await waitFor(() => expect(element('forward-list').textContent).toContain('Nenhum atalho de encaminhamento'));
  (Array.from(element('forward-list').querySelectorAll('button')).find((button) => button.textContent === 'Restaurar o atalho padrão encdg') as HTMLButtonElement).click();
  await waitFor(() => expect(shortcuts()).toEqual(['encdg']));
  expect(stored().forwardShortcuts[0]).toMatchObject({ campus: { id: '9', text: 'MO' }, setor: { id: '1500', text: 'DG/MO' } });
});

it('não cria encdg automático para a Reitoria, que não tem Direção-Geral', async () => {
  openPopup({ stored: { forwardShortcuts: [] }, campusUasg: '158155' });
  await waitFor(() => expect(element('forward-list').textContent).toContain('Nenhum atalho de encaminhamento'));
  (Array.from(element('forward-list').querySelectorAll('button')).find((button) => button.textContent === 'Restaurar o atalho padrão encdg') as HTMLButtonElement).click();
  await waitFor(() => expect(element('forward-message').textContent).toContain('não tem Direção-Geral própria'));
  expect(shortcuts()).toEqual([]);
});

it('cria, renomeia, exclui e desfaz atalhos de upload, sem repetir atalho de outra lista', async () => {
  const { stored } = openPopup({ stored: { upload: { tipoDocumento: 'Nota de Empenho' } } });
  // O upload único da versão anterior vira a linha "up".
  await waitFor(() => expect(rowShortcuts('upload-list')).toEqual(['up']));
  expect(rowMeta('upload-list')[0]).toBe('Padrão · Nota de Empenho · Cópia Simples · assunto Liquidação');

  clickLabel('Editar up');
  expect(element('upload-editor').hidden).toBe(false);
  expect(element('upload-editor-title').textContent).toBe('Editar atalho up');
  expect(document.querySelector('#upload-list .shortcut-row')?.classList.contains('is-editing')).toBe(true);
  input('upload-shortcut').value = 'upliq';
  input('upload-title').value = 'Upload da liquidação';
  fireEvent.submit(element('upload-form'));
  await waitFor(() => expect(rowShortcuts('upload-list')).toEqual(['upliq']));
  expect(stored().uploadShortcuts[0]).toEqual({ shortcut: 'upliq', title: 'Upload da liquidação', tipoConferencia: 'Cópia Simples', tipoDocumento: 'Nota de Empenho', assunto: 'Liquidação' });
  expect(stored().upload).toEqual({ tipoConferencia: 'Cópia Simples', tipoDocumento: 'Nota de Empenho', assunto: 'Liquidação' });

  element('btn-upload-new').click();
  expect(input('upload-tipo-conferencia').value).toBe('Cópia Simples');
  input('upload-shortcut').value = 'encdg';
  input('upload-tipo-documento').value = 'Nota Fiscal';
  fireEvent.submit(element('upload-form'));
  await waitFor(() => expect(element('upload-form-message').textContent).toBe('O atalho "encdg" já está em uso.'));
  input('upload-shortcut').value = 'upnf';
  fireEvent.submit(element('upload-form'));
  await waitFor(() => expect(rowShortcuts('upload-list')).toEqual(['upliq', 'upnf']));
  expect(element('upload-message').textContent).toContain('upnf <ID do processo>');

  clickLabel('Excluir upliq');
  await waitFor(() => expect(rowShortcuts('upload-list')).toEqual(['upnf']));
  // O primeiro restante passa a ser o upload padrão.
  expect(stored().upload.tipoDocumento).toBe('Nota Fiscal');
  element('btn-upload-undo').click();
  await waitFor(() => expect(rowShortcuts('upload-list')).toEqual(['upliq', 'upnf']));
});

it('cria atalhos de documento com o documento modelo da aba aberta, edita e exclui', async () => {
  const { stored } = openPopup({ tabUrl: DOCUMENT_URL });
  await waitFor(() => expect(element('document-list').textContent).toContain('Nenhum atalho de documento'));
  element('btn-document-new').click();
  expect(element('document-editor-title').textContent).toBe('Novo atalho de documento');
  input('document-shortcut').value = 'despliq';
  fireEvent.submit(element('document-form'));
  await waitFor(() => expect(element('document-form-message').textContent).toContain('ID do documento modelo'));

  element('btn-document-template-capture').click();
  await waitFor(() => expect(input('document-template-id').value).toBe('1026154'));
  expect(element('document-form-message').textContent).toBe('Documento #1026154 copiado da aba aberta.');
  input('document-title').value = 'Despacho de liquidação';
  input('document-assunto').value = 'Autorização para a Liquidação da Despesa';
  element<HTMLTextAreaElement>('document-texto').value = 'À Direção-Geral.\n\nAtenciosamente,';
  fireEvent.submit(element('document-form'));
  await waitFor(() => expect(rowShortcuts('document-list')).toEqual(['despliq']));
  expect(rowMeta('document-list')).toEqual(['Modelo #1026154 · Autorização para a Liquidação da Despesa']);
  expect(stored().documentShortcuts).toEqual([{ shortcut: 'despliq', title: 'Despacho de liquidação', templateId: '1026154', assunto: 'Autorização para a Liquidação da Despesa', texto: 'À Direção-Geral.\n\nAtenciosamente,' }]);

  clickLabel('Editar despliq');
  expect(input('document-texto').value).toBe('À Direção-Geral.\n\nAtenciosamente,');
  input('document-shortcut').value = 'desp';
  fireEvent.submit(element('document-form'));
  await waitFor(() => expect(element('document-form-message').textContent).toContain('já é um comando da paleta'));
  input('document-shortcut').value = 'despdg';
  fireEvent.submit(element('document-form'));
  await waitFor(() => expect(rowShortcuts('document-list')).toEqual(['despdg']));

  clickLabel('Excluir despdg');
  await waitFor(() => expect(rowShortcuts('document-list')).toEqual([]));
  expect(stored().documentShortcuts).toEqual([]);
});

it('avisa quando a aba aberta não é um documento do SUAP', async () => {
  openPopup({ tabUrl: FORWARD_URL });
  element('btn-document-new').click();
  element('btn-document-template-capture').click();
  await waitFor(() => expect(element('document-form-message').textContent).toContain('Abra no SUAP o documento'));
  expect(element('document-form-message').dataset.error).toBe('true');
  expect(input('document-template-id').value).toBe('');
});

it('edita o texto completo de um modelo de despacho com variáveis e volta ao padrão', async () => {
  const { stored } = openPopup();
  await waitFor(() => expect(rowShortcuts('despacho-list')).toHaveLength(7));
  clickLabel('Editar despacho PAFE');
  expect(element('despacho-editor').hidden).toBe(false);
  expect(element('despacho-editor-title').textContent).toBe('Despacho de liquidação — PAFE');
  expect(document.querySelector('#despacho-list .shortcut-row[data-shortcut="pafe"]')?.classList.contains('is-editing')).toBe(true);
  // O texto aparece inteiro, com as variáveis, e não como dica apagada.
  const corpo = element<HTMLTextAreaElement>('despacho-corpo');
  expect(corpo.value).toBe('Considerando a regularidade dos documentos apresentados e o acompanhamento do Programa de Apoio à Formação Estudantil (PAFE)[[ (Processo nº {processo})]], **AUTORIZO** a liquidação da despesa no valor de {valor}, referente ao empenho {empenho}.');
  expect(input('despacho-destinatario').value).toBe('À Coordenação de Finanças e Contratos do Campus {campus}');
  expect(Array.from(document.querySelectorAll('#despacho-variables .variable-chip')).map((chip) => chip.textContent)).toEqual([
    '{processo}', '{favorecido}', '{valor}', '{empenho}', '{objeto}', '{contrato}', '{projeto}', '{edital}', '{campus}',
  ]);

  // A variável entra onde está o cursor do campo em edição.
  corpo.value = 'Pague-se ao estudante  no valor de {valor}.';
  corpo.setSelectionRange(22, 22);
  fireEvent.focus(corpo);
  clickLabel('Inserir favorecido (em maiúsculas)');
  expect(corpo.value).toBe('Pague-se ao estudante {favorecido} no valor de {valor}.');
  fireEvent.submit(element('despacho-form'));
  await waitFor(() => expect(stored().despachoModelos).toEqual({ pafe: { corpo: 'Pague-se ao estudante {favorecido} no valor de {valor}.' } }));
  await waitFor(() => expect(element('despacho-editor').hidden).toBe(true));
  expect(element('despacho-message').textContent).toBe('Modelo PAFE salvo. Vale nos próximos despachos gerados no SIAGES.');
  const pafeMeta = () => document.querySelector('#despacho-list .shortcut-row[data-shortcut="pafe"] .shortcut-meta')?.textContent;
  expect(pafeMeta()).toBe('Personalizado · Pague-se ao estudante {favorecido} no valor de {valor}.');

  // Restaurar só fica ativo no modelo personalizado.
  const restoreServico = document.querySelector('[aria-label="Restaurar o padrão do despacho Serviço"]') as HTMLButtonElement;
  expect(restoreServico.disabled).toBe(true);
  clickLabel('Restaurar o padrão do despacho PAFE');
  await waitFor(() => expect(stored().despachoModelos).toEqual({}));
  await waitFor(() => expect(pafeMeta()?.startsWith('Padrão do SIAGES')).toBe(true));
});

it('mostra no editor os textos comuns salvos no formato anterior', async () => {
  openPopup({ stored: { despacho: { destinatario: 'À COFIN do Campus {campus}', fecho: 'Respeitosamente,' } } });
  await waitFor(() => expect(rowShortcuts('despacho-list')).toHaveLength(7));
  expect(rowMeta('despacho-list').every((meta) => meta?.startsWith('Personalizado'))).toBe(true);
  clickLabel('Editar despacho Serviço');
  expect(input('despacho-destinatario').value).toBe('À COFIN do Campus {campus}');
  expect(input('despacho-fecho').value).toBe('Respeitosamente,');
  expect(input('despacho-assunto').value).toBe('Autorização para a Liquidação da Despesa');
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
