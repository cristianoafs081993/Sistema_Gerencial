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
const shortcuts = () => Array.from(document.querySelectorAll('#forward-list .forward-item .snippet-trigger')).map((item) => item.textContent);
type StoredPreferences = {
  forwardShortcuts: Array<{ shortcut: string; title: string; despacho: string; campus: { id: string; text: string } | null; setor: { id: string; text: string } | null; papel: string }>;
  upload: Record<string, string>;
  despacho: Record<string, string>;
  hiddenSummaryBlocks: string[];
};

function openPopup({ stored, tabUrl = 'https://example.com', captured }: { stored?: unknown; tabUrl?: string; captured?: unknown } = {}) {
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)![1];
  const sync: Record<string, unknown> = stored ? { [KEY]: stored } : {};
  const executeScript = vi.fn(async () => [{ result: captured }]);
  vi.stubGlobal('chrome', {
    runtime: { sendMessage: vi.fn(async () => ({ ok: true })) },
    storage: {
      sync: {
        get: vi.fn(async (key: string) => (key in sync ? { [key]: sync[key] } : {})),
        set: vi.fn(async (value: Record<string, unknown>) => { Object.assign(sync, value); }),
      },
      local: { get: vi.fn(async () => ({})), set: vi.fn(), remove: vi.fn() },
      onChanged: { addListener: vi.fn() },
    },
    tabs: { query: vi.fn().mockResolvedValue([{ id: 5, url: tabUrl }]) },
    scripting: { executeScript },
  });
  vi.stubGlobal('SiagesExtensionAuth', { getSession: vi.fn().mockResolvedValue(null) });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
  window.eval(preferencesScript);
  new Function(script)();
  return { sync, stored: () => sync[KEY] as StoredPreferences, executeScript };
}

beforeEach(() => localStorage.clear());
afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

it('mostra o encdg padrão e os valores atuais do upload', async () => {
  openPopup();
  (document.querySelector('.nav-item[data-section="templates"]') as HTMLButtonElement).click();
  expect(element('templates-panel').classList.contains('is-active')).toBe(true);
  await waitFor(() => expect(shortcuts()).toEqual(['encdg']));
  expect(document.querySelector('#forward-list .forward-meta')?.textContent).toBe('Para DG/CN · campus CN · perfil ASSISTENTE EM ADMINISTRACAO');
  expect(input('upload-tipo-conferencia').value).toBe('Cópia Simples');
  expect(input('upload-tipo-documento').value).toBe('Liquidação');
  expect(input('despacho-destinatario').value).toBe('');
  expect(input('despacho-destinatario').placeholder).toBe('À Coordenação de Finanças e Contratos do Campus {campus}');
});

it('cria um atalho copiando o destino da tela Encaminhar aberta no SUAP', async () => {
  const { stored, executeScript } = openPopup({
    tabUrl: FORWARD_URL,
    captured: { campus: { id: '3', text: 'CN' }, setor: { id: '900', text: 'COFIN/CN' }, papel: 'CONTADOR', despacho: 'Para pagamento.' },
  });
  await waitFor(() => expect(shortcuts()).toEqual(['encdg']));
  element('btn-forward-new').click();
  expect(element('forward-editor').hidden).toBe(false);
  // Campus e perfil partem do primeiro atalho.
  expect(input('forward-campus-id').value).toBe('3');
  expect(input('forward-papel').value).toBe('ASSISTENTE EM ADMINISTRACAO');

  element('btn-forward-capture').click();
  await waitFor(() => expect(input('forward-setor-id').value).toBe('900'));
  expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({ target: { tabId: 5 } }));
  expect(input('forward-setor-text').value).toBe('COFIN/CN');
  expect(input('forward-papel').value).toBe('CONTADOR');
  expect(element<HTMLTextAreaElement>('forward-despacho').value).toBe('Para pagamento.');

  input('forward-shortcut').value = ' EncFin ';
  fireEvent.submit(element('forward-form'));
  await waitFor(() => expect(shortcuts()).toEqual(['encdg', 'encfin']));
  expect(element('forward-editor').hidden).toBe(true);
  expect(stored().forwardShortcuts[1]).toEqual({
    shortcut: 'encfin', title: '', despacho: 'Para pagamento.', campus: { id: '3', text: 'CN' }, setor: { id: '900', text: 'COFIN/CN' }, papel: 'CONTADOR',
  });
  expect(element('forward-message').textContent).toContain('encfin <número do processo>');
});

it('recusa atalho reservado ou sem setor e pede a tela Encaminhar para copiar o destino', async () => {
  const { sync } = openPopup();
  await waitFor(() => expect(shortcuts()).toEqual(['encdg']));
  element('btn-forward-new').click();
  element('btn-forward-capture').click();
  await waitFor(() => expect(element('forward-form-message').textContent).toContain('Abra a tela “Encaminhar”'));

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
  await waitFor(() => expect(document.querySelectorAll('#summary-blocks input[type="checkbox"]')).toHaveLength(9));
  expect(Array.from(document.querySelectorAll<HTMLInputElement>('#summary-blocks input')).every((input) => input.checked)).toBe(true);

  checkbox('dados-bancarios').click();
  checkbox('lista-credores').click();
  await waitFor(() => expect(stored().hiddenSummaryBlocks).toEqual(['dados-bancarios', 'lista-credores']));
  await waitFor(() => expect(element('summary-blocks-message').textContent).toBe('Resumo atualizado: 7 de 9 blocos visíveis.'));
  expect(document.querySelector('[data-nav-badge="process-panel"]')?.textContent).toBe('7/9');
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
  await waitFor(() => expect(element('nav-templates').hidden).toBe(true));
  expect(element('nav-process-panel').hidden).toBe(true);
  expect(element('templates-panel').classList.contains('is-active')).toBe(false);
});
