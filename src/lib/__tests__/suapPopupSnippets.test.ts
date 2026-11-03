import { readFileSync } from 'node:fs';
import { fireEvent, waitFor } from '@testing-library/dom';
import { afterEach, expect, it, vi } from 'vitest';
import { extensionFixturePath } from '@/test/extensionFixtures';

const popupHtml = readFileSync(extensionFixturePath('popup.html'), 'utf8');
const popupScript = readFileSync(extensionFixturePath('popup.js'), 'utf8');
const KEY = 'siages-snippets';

type Listener = (changes: Record<string, { newValue?: unknown }>, area: string) => void;

function openPopup(initial?: Record<string, string>) {
  document.body.innerHTML = popupHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)![1];
  const sync: Record<string, unknown> = initial ? { [KEY]: initial } : {};
  const listeners: Listener[] = [];
  const local: Record<string, unknown> = {};
  vi.stubGlobal('chrome', {
    runtime: { sendMessage: vi.fn(async () => ({ ok: true })) },
    storage: {
      sync: {
        get: vi.fn(async (key: string) => (key in sync ? { [key]: sync[key] } : {})),
        set: vi.fn(async (value: Record<string, unknown>) => { Object.assign(sync, value); }),
      },
      local: {
        get: vi.fn(async () => ({ ...local })),
        set: vi.fn(async (value: Record<string, unknown>) => { Object.assign(local, value); }),
        remove: vi.fn(async () => undefined),
      },
      onChanged: { addListener: vi.fn((listener: Listener) => { listeners.push(listener); }) },
    },
    tabs: { query: vi.fn().mockResolvedValue([]) },
  });
  vi.stubGlobal('SiagesExtensionAuth', { getSession: vi.fn().mockResolvedValue(null) });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
  new Function(popupScript)();
  return { sync, listeners };
}

const field = (id: string) => document.getElementById(id) as HTMLInputElement;
const items = () => Array.from(document.querySelectorAll('#snippet-list .snippet-item'));
const triggers = () => items().map((item) => item.querySelector('.snippet-trigger')!.textContent);
const submit = () => fireEvent.submit(document.getElementById('snippet-form')!);

afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

it('lista os atalhos salvos e filtra pela busca, sem exigir login', async () => {
  openPopup({ '/cn': 'Currais Novos', '/liq': 'Liquidação de despesa' });
  await waitFor(() => expect(triggers()).toEqual(['/cn', '/liq']));
  field('snippet-search').value = 'despesa';
  fireEvent.input(field('snippet-search'));
  expect(triggers()).toEqual(['/liq']);
});

it('mostra os atalhos padrão quando o perfil ainda não tem atalhos salvos', async () => {
  openPopup();
  await waitFor(() => expect(triggers()).toContain('/ifrn'));
});

it('cria um atalho normalizando o gatilho e grava na mesma chave do expansor', async () => {
  const { sync } = openPopup({ '/cn': 'Currais Novos' });
  await waitFor(() => expect(items()).toHaveLength(1));
  field('snippet-trigger').value = ' LIQ ';
  field('snippet-expansion').value = '  Liquidação de despesa  ';
  submit();
  await waitFor(() => expect(sync[KEY]).toEqual({ '/cn': 'Currais Novos', '/liq': 'Liquidação de despesa' }));
  expect(triggers()).toEqual(['/cn', '/liq']);
  await waitFor(() => expect(field('snippet-trigger').value).toBe(''));
});

it('recusa atalho vazio, sem texto ou duplicado', async () => {
  const { sync } = openPopup({ '/cn': 'Currais Novos' });
  await waitFor(() => expect(items()).toHaveLength(1));
  const message = () => document.getElementById('snippet-message')!.textContent;
  field('snippet-trigger').value = '/'; field('snippet-expansion').value = 'x'; submit();
  await waitFor(() => expect(message()).toBe('Informe um atalho válido.'));
  field('snippet-trigger').value = '/novo'; field('snippet-expansion').value = ' '; submit();
  await waitFor(() => expect(message()).toBe('Informe o texto expandido.'));
  field('snippet-trigger').value = '/CN'; field('snippet-expansion').value = 'Outro'; submit();
  await waitFor(() => expect(message()).toBe('Este atalho já existe. Edite o item existente.'));
  expect(sync[KEY]).toEqual({ '/cn': 'Currais Novos' });
});

it('edita trocando o gatilho sem deixar o antigo e remove um atalho', async () => {
  const { sync } = openPopup({ '/cn': 'Currais Novos', '/liq': 'Liquidação' });
  await waitFor(() => expect(items()).toHaveLength(2));
  (document.querySelector('[aria-label="Editar /liq"]') as HTMLButtonElement).click();
  expect(field('snippet-trigger').value).toBe('/liq');
  expect(document.getElementById('btn-snippet-cancel')!.hidden).toBe(false);
  field('snippet-trigger').value = '/liquidacao'; field('snippet-expansion').value = 'Liquidação de despesa'; submit();
  await waitFor(() => expect(sync[KEY]).toEqual({ '/cn': 'Currais Novos', '/liquidacao': 'Liquidação de despesa' }));
  (document.querySelector('[aria-label="Remover /cn"]') as HTMLButtonElement).click();
  await waitFor(() => expect(sync[KEY]).toEqual({ '/liquidacao': 'Liquidação de despesa' }));
  expect(triggers()).toEqual(['/liquidacao']);
});

it('atualiza a lista quando os atalhos chegam de outro perfil pelo SIAGES', async () => {
  const { listeners } = openPopup({ '/cn': 'Currais Novos' });
  await waitFor(() => expect(items()).toHaveLength(1));
  listeners.forEach((listener) => listener({ [KEY]: { newValue: { '/cn': 'Currais Novos', '/siafi': 'Texto do SIAFI' } } }, 'sync'));
  expect(triggers()).toEqual(['/cn', '/siafi']);
});
