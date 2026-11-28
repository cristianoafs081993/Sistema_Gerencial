import { env } from '@/lib/env';

export function getSuapRedirectUri(origin = window.location.origin) {
  const baseOrigin = env.appOrigin || origin;
  return `${baseOrigin}/suap-callback`;
}

export function buildSuapAuthorizeUrl({
  clientId = env.suapClientId,
  redirectUri = getSuapRedirectUri(),
  state,
}: {
  clientId?: string;
  redirectUri?: string;
  state: string;
}) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  });

  return `https://suap.ifrn.edu.br/o/authorize/?${params.toString()}`;
}

export const SUAP_LOGIN_STATE_STORAGE_KEY = 'suap_login_state';

/** Gera o `state` do login no app (prefixo `app:` + valor aleatório) e guarda para conferir no retorno. */
export function createSuapLoginState(storage: Pick<Storage, 'setItem'> = localStorage) {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '')
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  const state = `app:${random}`;
  storage.setItem(SUAP_LOGIN_STATE_STORAGE_KEY, state);
  return state;
}

/**
 * Confere o `state` devolvido pelo SUAP. Estados `app:<aleatório>` precisam ser os mesmos gerados
 * neste navegador; o formato antigo (`app`) continua aceito para não quebrar logins em andamento.
 */
export function isValidSuapLoginState(
  state: string | null,
  storage: Pick<Storage, 'getItem' | 'removeItem'> = localStorage,
) {
  if (!state || !state.startsWith('app:')) return true;
  const expected = storage.getItem(SUAP_LOGIN_STATE_STORAGE_KEY);
  storage.removeItem(SUAP_LOGIN_STATE_STORAGE_KEY);
  return Boolean(expected) && expected === state;
}

/** Prefixo do `state` usado pela extensão quando ela inicia o login SUAP pelo retorno do site. */
export const EXTENSION_SUAP_LOGIN_STATE_PREFIX = 'ext:';

/**
 * Login iniciado pela extensão: o código pertence à extensão, que o lê da URL desta aba e fecha a aba.
 * O site não pode trocar esse código, porque o SUAP aceita cada código uma única vez.
 */
export function isExtensionSuapLoginState(state: string | null | undefined) {
  return typeof state === 'string' && state.startsWith(EXTENSION_SUAP_LOGIN_STATE_PREFIX);
}
