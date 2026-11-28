(function () {
  // Oferece à extensão a sessão do site do SIAGES aberto, para ela entrar sem pedir login de novo.
  // O background só usa o token para pedir ao servidor uma sessão própria da extensão, e só quando
  // ela ainda não tem sessão e o usuário não saiu dela de propósito. O token do site não é guardado.
  const SOURCE = 'siages-site-session';
  const SUPABASE_AUTH_STORAGE_KEY = 'sb-mnqhwyrzhgykjlyyqodd-auth-token';
  let lastOfferedToken = '';

  function readSiteAccessToken() {
    try {
      const raw = localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY);
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      const token = parsed?.access_token || parsed?.currentSession?.access_token || '';
      const expiresAt = Number(parsed?.expires_at || parsed?.currentSession?.expires_at || 0);
      if (typeof token !== 'string' || !token) return '';
      if (expiresAt && expiresAt <= Date.now() / 1000 + 30) return '';
      return token;
    } catch {
      return '';
    }
  }

  function offerSiteSession() {
    const accessToken = readSiteAccessToken();
    if (!accessToken || accessToken === lastOfferedToken) return;
    const runtime = globalThis.chrome?.runtime;
    if (!runtime?.sendMessage) return;
    lastOfferedToken = accessToken;
    try {
      runtime.sendMessage({ source: SOURCE, type: 'site-session', accessToken }, () => {
        void runtime.lastError; // contexto invalidado ou extensão recarregada: silencioso
      });
    } catch (_) {}
  }

  offerSiteSession();
  // O login no site acontece depois da carga da página (SUAP, e-mail ou renovação do token).
  window.addEventListener('storage', (event) => {
    if (event.key === SUPABASE_AUTH_STORAGE_KEY) offerSiteSession();
  });
  window.setInterval(offerSiteSession, 15000);
})();
