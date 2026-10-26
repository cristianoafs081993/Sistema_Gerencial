/**
 * Compartilha os atalhos de texto (/cn, /ifrn...) entre perfis do Chrome pelo SIAGES.
 * chrome.storage.sync continua sendo a cópia local lida pelo expansor e pelo painel;
 * este módulo reconcilia essa cópia com a linha do usuário em extension_snippets.
 */
(function (scope) {
  const TABLE = 'extension_snippets';
  const SNIPPETS_KEY = 'siages-snippets';
  const STATE_KEY = 'siages-snippets-sync-state';
  const PULL_INTERVAL_MS = 5 * 60 * 1000;
  const MAX_SNIPPETS_BYTES = 200000;

  function cleanSnippets(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const result = {};
    for (const [key, text] of Object.entries(value)) {
      if (typeof key === 'string' && key && typeof text === 'string' && text) result[key] = text;
    }
    return result;
  }

  function signature(snippets) {
    const clean = cleanSnippets(snippets);
    return JSON.stringify(Object.keys(clean).sort().map((key) => [key, clean[key]]));
  }

  function createSnippetsSync({ syncStorage, localStorage, getAccessToken, fetchRest, defaults = {}, now = () => Date.now() }) {
    const defaultsSignature = signature(defaults);
    let running = null;
    let rerun = false;

    async function readState() {
      const stored = await localStorage.get(STATE_KEY).catch(() => ({}));
      return stored?.[STATE_KEY] || {};
    }

    async function writeState(state) {
      await localStorage.set({ [STATE_KEY]: state });
    }

    async function readLocal() {
      const stored = await syncStorage.get(SNIPPETS_KEY);
      return cleanSnippets(stored?.[SNIPPETS_KEY]);
    }

    async function readToken() {
      try {
        return (await getAccessToken()) || null;
      } catch {
        return null;
      }
    }

    async function readRemote(token) {
      const rows = await fetchRest(`${TABLE}?select=snippets,updated_at&limit=1`, token);
      const row = Array.isArray(rows) ? rows[0] : null;
      return row ? cleanSnippets(row.snippets) : null;
    }

    async function pushRemote(token, snippets) {
      if (new TextEncoder().encode(JSON.stringify(snippets)).length > MAX_SNIPPETS_BYTES) {
        throw new Error('Os atalhos excedem o limite de sincronização do SIAGES.');
      }
      await fetchRest(`${TABLE}?on_conflict=tenant_id`, token, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ snippets }),
      });
    }

    async function applyLocal(snippets) {
      await syncStorage.set({ [SNIPPETS_KEY]: snippets });
    }

    // Primeira sincronização do perfil: une as duas cópias para nunca perder atalhos criados em nenhum lado.
    // Uma cópia que ainda é só o conjunto padrão não deve sobrescrever atalhos personalizados do outro lado.
    function firstMerge(local, remote) {
      if (signature(local) === defaultsSignature) return remote;
      if (signature(remote) === defaultsSignature) return local;
      return { ...local, ...remote };
    }

    async function run() {
      const token = await readToken();
      if (!token) return { ok: false, skipped: 'sem-sessao' };
      const state = await readState();
      const local = await readLocal();
      const localSignature = signature(local);
      const remote = await readRemote(token);

      if (!remote) {
        if (!Object.keys(local).length) return { ok: true, skipped: 'sem-atalhos' };
        await pushRemote(token, local);
        await writeState({ signature: localSignature, syncedAt: now() });
        return { ok: true, pushed: true };
      }

      const remoteSignature = signature(remote);
      if (remoteSignature === localSignature) {
        await writeState({ signature: localSignature, syncedAt: now() });
        return { ok: true, skipped: 'sem-alteracao' };
      }

      let next;
      if (!state.signature) next = firstMerge(local, remote);
      else if (localSignature !== state.signature) next = local;
      else next = remote;

      const nextSignature = signature(next);
      // Marca o estado antes de gravar para que o ouvinte de storage.onChanged não reenvie o que acabou de chegar.
      await writeState({ signature: nextSignature, syncedAt: now() });
      if (nextSignature !== localSignature) await applyLocal(next);
      if (nextSignature !== remoteSignature) await pushRemote(token, next);
      return { ok: true, pushed: nextSignature !== remoteSignature, pulled: nextSignature !== localSignature };
    }

    // Uma execução por vez; pedidos feitos durante a execução geram uma nova passada ao final.
    function reconcile() {
      if (running) {
        rerun = true;
        return running;
      }
      running = (async () => {
        try {
          let result = await run();
          while (rerun) {
            rerun = false;
            result = await run();
          }
          return result;
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) };
        } finally {
          running = null;
          rerun = false;
        }
      })();
      return running;
    }

    // Chamado pelas páginas ao carregar: evita consultar o servidor a cada navegação.
    async function reconcileIfStale() {
      const state = await readState();
      if (state.syncedAt && now() - state.syncedAt < PULL_INTERVAL_MS) return { ok: true, skipped: 'recente' };
      return reconcile();
    }

    return { reconcile, reconcileIfStale };
  }

  scope.SiagesSnippetsSync = {
    TABLE,
    SNIPPETS_KEY,
    STATE_KEY,
    PULL_INTERVAL_MS,
    cleanSnippets,
    signature,
    createSnippetsSync,
  };
})(globalThis);
