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
