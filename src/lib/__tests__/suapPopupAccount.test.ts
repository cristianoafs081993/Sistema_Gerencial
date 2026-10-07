import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/dom';
import { extensionFixturePath } from '@/test/extensionFixtures';
import { isSuperAdminUser } from '@/lib/authz';

const html = readFileSync(extensionFixturePath('popup.html'), 'utf8');
const script = readFileSync(extensionFixturePath('popup.js'), 'utf8');
const connected = { accessToken: 'test-token', user: { email: 'usuario@example.com' } };
type Session = { accessToken: string; user?: { email?: string; app_metadata?: { role?: string; is_superadmin?: boolean }; user_metadata?: { role?: string; is_superadmin?: boolean } } } | null;
const element = (id: string) => document.getElementById(id)!;

function setup(session: Session = null) {
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)![1];
  const listeners: Array<(changes: Record<string, unknown>, area: string) => void> = [];
  const auth = {
    getSession: vi.fn().mockResolvedValue(session),
    signIn: vi.fn().mockImplementation(async () => { auth.getSession.mockResolvedValue(connected); return connected; }),
    signOut: vi.fn().mockImplementation(async () => { auth.getSession.mockResolvedValue(null); }),
  };
  vi.stubGlobal('SiagesExtensionAuth', auth);
  const sendMessage = vi.fn((_message, callback) => {
    const response = { ok: true, status: { nextRunAt: '2026-10-07T16:00:00Z' } };
    callback?.(response);
    return Promise.resolve(response);
  });
  const getStorage = vi.fn().mockResolvedValue({});
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal('chrome', {
    runtime: { sendMessage },
    storage: {
      local: { get: getStorage },
      onChanged: { addListener: (listener: typeof listeners[number]) => listeners.push(listener) },
    },
    tabs: { query: vi.fn().mockResolvedValue([{ id: 1, url: 'https://example.com' }]) },
  });
  new Function(script)();
  return {
    auth, sendMessage, getStorage, fetcher,
    change: (changes: Record<string, unknown>) => listeners.forEach(listener => listener(changes, 'local')),
    changeSession: () => listeners.forEach(listener => listener({ 'siages-extension-session': {} }, 'local')),
  };
}

function submit() {
  (element('extension-auth-email') as HTMLInputElement).value = 'usuario@example.com';
  (element('extension-auth-password') as HTMLInputElement).value = 'test-password';
  element('extension-auth-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

afterEach(async () => {
  await new Promise(resolve => setTimeout(resolve, 0));
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

it('mostra somente o formulário sem sessão e separa a sincronização da conta', async () => {
  setup();
  await waitFor(() => expect(element('extension-auth-form').hidden).toBe(false));
  expect(element('extension-auth-user').hidden).toBe(true);
  expect(document.querySelector('h1')?.textContent).toBe('SIAGES');
  expect(document.querySelector('.brand-mark img')?.getAttribute('src')).toBe('logo-transparent.png');
  expect(document.body.textContent).not.toContain('Extensão para o navegador');
  expect(document.querySelector('.account-card')?.contains(element('process-box-sync-status'))).toBe(false);
  expect(document.querySelector('.sync-section')?.contains(element('process-box-sync-status'))).toBe(true);
  expect(document.body.textContent).not.toMatch(/Canivete|no banco|ao banco|Segredo de automação/);
  expect(element('automation-secret')).toBeNull();
  expect((element('plan-sync-panel') as HTMLDetailsElement).open).toBe(false);
  expect((element('rd-sync-panel') as HTMLDetailsElement).open).toBe(false);
});

it('oculta o formulário na sessão ativa e identifica a conta conectada', async () => {
  setup(connected);
  await waitFor(() => expect(element('extension-auth-user').hidden).toBe(false));
  expect(element('extension-auth-form').hidden).toBe(true);
  expect(element('extension-auth-user-email').textContent).toBe('usuario@example.com');
  expect(element('extension-auth-badge').textContent).toBe('Conectado');
});

it('entra pelo formulário, limpa a senha e volta ao login ao sair', async () => {
  const { auth } = setup();
  await waitFor(() => expect(element('extension-auth-form').hidden).toBe(false));
  submit();
  await waitFor(() => expect(element('extension-auth-user').hidden).toBe(false));
  expect(auth.signIn).toHaveBeenCalledWith('usuario@example.com', 'test-password');
  expect(element('extension-auth-form').hidden).toBe(true);
  expect((element('extension-auth-password') as HTMLInputElement).value).toBe('');
  element('btn-extension-sign-out').click();
  await waitFor(() => expect(element('extension-auth-form').hidden).toBe(false));
  expect(auth.signOut).toHaveBeenCalledOnce();
  expect(element('extension-auth-user').hidden).toBe(true);
  expect(element('extension-auth-user-email').textContent).toBe('');
  expect(document.activeElement).toBe(element('extension-auth-email'));
});

it('mantém falhas de login no bloco da conta sem alterar o progresso da sincronização', async () => {
  const { auth } = setup();
  auth.signIn.mockRejectedValue(new Error('E-mail ou senha inválidos.'));
  await waitFor(() => expect(element('extension-auth-form').hidden).toBe(false));
  const syncText = element('process-box-sync-status').textContent;
  submit();
  await waitFor(() => expect(element('extension-auth-status').textContent).toBe('E-mail ou senha inválidos.'));
  expect(element('extension-auth-status').dataset.error).toBe('true');
  expect(element('extension-auth-user').hidden).toBe(true);
  expect(element('process-box-sync-status').textContent).toBe(syncText);
  expect((element('btn-extension-sign-in') as HTMLButtonElement).disabled).toBe(false);
});

it('reage à renovação e ao encerramento de sessão em outro contexto da extensão', async () => {
  const { auth, changeSession } = setup(connected);
  await waitFor(() => expect(element('extension-auth-user').hidden).toBe(false));
  auth.getSession.mockResolvedValue(null);
  changeSession();
  await waitFor(() => expect(element('extension-auth-form').hidden).toBe(false));
  expect(element('extension-auth-user').hidden).toBe(true);
  auth.getSession.mockResolvedValue(connected);
  changeSession();
  await waitFor(() => expect(element('extension-auth-form').hidden).toBe(true));
});

it('oferece recuperação quando a verificação da sessão falha', async () => {
  const { auth, changeSession } = setup();
  await waitFor(() => expect(element('extension-auth-form').hidden).toBe(false));
  auth.getSession.mockRejectedValue(new Error('Não foi possível verificar a sessão.'));
  changeSession();
  await waitFor(() => expect(element('extension-auth-badge').textContent).toBe('Verificar acesso'));
  expect(element('extension-auth-form').hidden).toBe(false);
  expect(element('extension-auth-status').dataset.error).toBe('true');
});

it.each<Session>([
  null,
  connected,
  { accessToken: 'test-token' },
  { accessToken: 'test-token', user: { app_metadata: { role: 'admin' } } },
  { accessToken: 'test-token', user: { user_metadata: { role: 'superadmin', is_superadmin: true } } },
])('não mostra nem consulta sincronização sem permissão: %j', async (session) => {
  const { auth, sendMessage, getStorage, fetcher, change } = setup(session);
  expect(element('sync-section').hidden).toBe(true);
  await waitFor(() => expect(auth.getSession).toHaveBeenCalled());
  await new Promise(resolve => setTimeout(resolve, 0));
  change({ 'siages-process-box-sync-state': {}, 'siages-suap-rd-status:all': {} });
  for (const id of ['btn-extract-en', 'btn-extract-all', 'btn-apply-plan', 'btn-collect-all-rds', 'btn-apply-all-rds']) element(id).click();
  expect(element('sync-section').hidden).toBe(true);
  expect(sendMessage).not.toHaveBeenCalled();
  expect(getStorage).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});

it.each([
  { email: ' CRISTIANO.CNRN@GMAIL.COM ' },
  { email: 'gestor@example.com', app_metadata: { role: 'superadmin' } },
  { email: 'gestor@example.com', app_metadata: { is_superadmin: true } },
])('libera sincronização usando a mesma regra do SIAGES: %j', async (user) => {
  const { sendMessage, fetcher } = setup({ accessToken: 'test-token', user });
  expect(isSuperAdminUser(user)).toBe(true);
  expect(element('sync-section').hidden).toBe(true);
  await waitFor(() => expect(element('sync-section').hidden).toBe(false));
  expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'get-status' }), expect.any(Function));
  await waitFor(() => expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('sync-suap-plan'), expect.any(Object)));
});

it('esconde imediatamente a sincronização ao sair e ignora a resposta atrasada da agenda', async () => {
  const { sendMessage } = setup({ accessToken: 'test-token', user: { app_metadata: { role: 'superadmin' } } });
  await waitFor(() => expect(element('sync-section').hidden).toBe(false));
  const callback = sendMessage.mock.calls.find(([message]) => message.type === 'get-status')![1];
  element('btn-extension-sign-out').click();
  expect(element('sync-section').hidden).toBe(true);
  callback({ ok: true, status: { message: 'Informação administrativa atrasada', finishedAt: '2026-10-07T13:00:00Z' } });
  expect(element('process-box-sync-status').textContent).toBe('');
});

it('oculta a seção na troca de conta e não restaura acesso com uma consulta de sessão antiga', async () => {
  const admin = { accessToken: 'test-token', user: { app_metadata: { role: 'superadmin' } } };
  const { auth, changeSession } = setup(admin);
  await waitFor(() => expect(element('sync-section').hidden).toBe(false));
  let resolveOld!: (value: Session) => void;
  auth.getSession.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
  changeSession();
  expect(element('sync-section').hidden).toBe(true);
  auth.getSession.mockResolvedValue(connected);
  changeSession();
  await waitFor(() => expect(element('extension-auth-user-email').textContent).toBe(connected.user.email));
  resolveOld(admin);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(element('sync-section').hidden).toBe(true);
  expect(element('extension-auth-user-email').textContent).toBe(connected.user.email);
});

it('remove a área administrativa quando não consegue verificar a sessão', async () => {
  const { auth, changeSession } = setup({ accessToken: 'test-token', user: { app_metadata: { is_superadmin: true } } });
  await waitFor(() => expect(element('sync-section').hidden).toBe(false));
  auth.getSession.mockRejectedValue(new Error('Sessão indisponível.'));
  changeSession();
  await waitFor(() => expect(element('extension-auth-status').textContent).toBe('Sessão indisponível.'));
  expect(element('sync-section').hidden).toBe(true);
});
