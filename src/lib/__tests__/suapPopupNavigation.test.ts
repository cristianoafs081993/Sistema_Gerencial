import { readFileSync } from 'node:fs';
import { waitFor } from '@testing-library/dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { extensionFixturePath } from '@/test/extensionFixtures';

const html = readFileSync(extensionFixturePath('popup.html'), 'utf8');
const script = readFileSync(extensionFixturePath('popup.js'), 'utf8');
const SECTION_KEY = 'siages-popup-section';
const admin = { accessToken: 'test-token', user: { email: 'gestor@example.com', app_metadata: { role: 'superadmin' } } };
const user = { accessToken: 'test-token', user: { email: 'usuario@example.com' } };
type Session = typeof admin | typeof user | null;

const element = (id: string) => document.getElementById(id)!;
const navItem = (section: string) => document.querySelector(`.nav-item[data-section="${section}"]`) as HTMLButtonElement;
const activeViews = () => Array.from(document.querySelectorAll('.view.is-active')).map((view) => (view as HTMLElement).dataset.section);

function openPopup(session: Session, { tabUrl = 'https://example.com', rdRunning = false } = {}) {
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)![1];
  const listeners: Array<(changes: Record<string, unknown>, area: string) => void> = [];
  const auth = {
    getSession: vi.fn().mockResolvedValue(session),
    signOut: vi.fn().mockImplementation(async () => { auth.getSession.mockResolvedValue(null); }),
  };
  vi.stubGlobal('SiagesExtensionAuth', auth);
  const sendMessage = vi.fn((message: { type: string; scope?: string }, callback?: (response: unknown) => void) => {
    const response = message.type === 'get-status' && !message.scope && callback
      ? { ok: true, status: { nextRunAt: '2026-11-24T10:00:00Z', lastError: 'Faça login no SUAP.' } }
      : { ok: true, running: rdRunning, status: message.scope === 'all' ? { results: [], total: 44 } : null };
    callback?.(response);
    return Promise.resolve(response);
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
  vi.stubGlobal('chrome', {
    runtime: { sendMessage },
    storage: {
      sync: { get: vi.fn().mockResolvedValue({}), set: vi.fn() },
      local: { get: vi.fn().mockResolvedValue({}), set: vi.fn(), remove: vi.fn() },
      onChanged: { addListener: (listener: typeof listeners[number]) => listeners.push(listener) },
    },
    tabs: { query: vi.fn().mockResolvedValue([{ id: 1, url: tabUrl }]) },
    scripting: { executeScript: vi.fn().mockResolvedValue([{ result: { unit: '' } }]) },
  });
  new Function(script)();
  return { auth };
}

beforeEach(() => localStorage.clear());
afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

it('mostra uma seção por vez, começando pela conta', async () => {
  openPopup(user);
  await waitFor(() => expect(element('extension-auth-user').hidden).toBe(false));
  expect(activeViews()).toEqual(['account']);
  expect(navItem('account').getAttribute('aria-current')).toBe('page');
  expect(element('nav-account-presence').dataset.state).toBe('connected');
  expect(element('extension-auth-avatar').textContent).toBe('U');

  navItem('snippets').click();
  expect(activeViews()).toEqual(['snippets']);
  expect(navItem('snippets').getAttribute('aria-current')).toBe('page');
  expect(navItem('account').hasAttribute('aria-current')).toBe(false);
  await waitFor(() => expect(document.querySelector('[data-nav-badge="snippets"]')?.textContent).toBe('4'));
});

it('reabre a última seção escolhida', async () => {
  localStorage.setItem(SECTION_KEY, 'snippets');
  openPopup(null);
  expect(activeViews()).toEqual(['snippets']);
  await waitFor(() => expect(element('extension-auth-form').hidden).toBe(false));
  expect(element('nav-account-presence').dataset.state).toBe('disconnected');
  expect(activeViews()).toEqual(['snippets']);
});

it('esconde o menu de sincronização para quem não é superadmin e cai na conta', async () => {
  localStorage.setItem(SECTION_KEY, 'rds');
  openPopup(user);
  await waitFor(() => expect(element('extension-auth-user').hidden).toBe(false));
  expect(element('nav-sync-group').hidden).toBe(true);
  expect(activeViews()).toEqual(['account']);
});

it('restaura a seção de sincronização salva quando o superadmin é confirmado e sinaliza pendências no menu', async () => {
  localStorage.setItem(SECTION_KEY, 'rds');
  openPopup(admin, { rdRunning: true });
  await waitFor(() => expect(activeViews()).toEqual(['rds']));
  expect(element('nav-sync-group').hidden).toBe(false);
  expect(document.querySelector('[data-nav-badge="process-box"]')?.textContent).toBe('Aviso');
  await waitFor(() => expect(document.querySelector('[data-nav-badge="rds"]')?.textContent).toBe('Coletando'));
});

it('volta para a conta ao sair estando numa seção de sincronização', async () => {
  openPopup(admin);
  await waitFor(() => expect(element('nav-sync-group').hidden).toBe(false));
  navItem('plan').click();
  expect(activeViews()).toEqual(['plan']);
  element('btn-extension-sign-out').click();
  expect(element('nav-sync-group').hidden).toBe(true);
  expect(activeViews()).toEqual(['account']);
  expect(document.querySelector('[data-nav-badge="process-box"]')?.hasAttribute('hidden')).toBe(true);
});

it('abre direto no preenchimento de favorecidos quando a aba é do SIAFI, sem trocar a seção salva', async () => {
  localStorage.setItem(SECTION_KEY, 'snippets');
  openPopup(user, { tabUrl: 'https://siafi.tesouro.gov.br/siafi2026/' });
  await waitFor(() => expect(activeViews()).toEqual(['siafi']));
  expect(navItem('siafi').hidden).toBe(false);
  expect(localStorage.getItem(SECTION_KEY)).toBe('snippets');
});
