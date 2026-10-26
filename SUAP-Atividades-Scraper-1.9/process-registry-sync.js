/**
 * Compartilha os processos abertos no SUAP entre perfis do Chrome pelo SIAGES.
 * Cada perfil publica os processos que abriu; o Alt+V de outro perfil do mesmo
 * usuário lê esses registros e os soma às abas locais.
 */
(function (scope) {
  const TABLE = 'extension_process_registry';
  const PROFILE_KEY = 'siages-extension-profile-id';
  const REMOTE_CACHE_KEY = 'suape_remote_processes';
  const READ_WINDOW_MS = 12 * 60 * 60 * 1000;
  const RETENTION_MS = 24 * 60 * 60 * 1000;
  const PRUNE_INTERVAL_MS = 60 * 60 * 1000;
  const PUSH_DEDUP_MS = 60 * 1000;
  const MAX_PAYLOAD_BYTES = 200000;
  const READ_LIMIT = 20;
  const DEFAULT_TIMEOUT_MS = 1800;

  function getProcessKey(record) {
    return String(record?.suapId || record?.processNumber || '').trim().slice(0, 80);
  }

  function byteLength(value) {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  }

  // Remove primeiro os dados completos do processo e depois os campos lidos da página,
  // para que um processo muito grande ainda apareça com a identificação básica.
  function buildPayload(record) {
    const payload = {
      process: record?.process || null,
      fields: Array.isArray(record?.fields) ? record.fields : [],
      title: String(record?.title || '').slice(0, 300),
      url: String(record?.url || '').slice(0, 500),
    };
    if (byteLength(payload) <= MAX_PAYLOAD_BYTES) return payload;
    if (payload.process && typeof payload.process === 'object') {
      const { dadosCompletos: _omitido, ...resumo } = payload.process;
      payload.process = resumo;
    }
    if (byteLength(payload) <= MAX_PAYLOAD_BYTES) return payload;
    payload.fields = [];
    return byteLength(payload) <= MAX_PAYLOAD_BYTES ? payload : { process: null, fields: [], title: '', url: '' };
  }

  function rowToProcess(row) {
    const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};
    const updatedAt = Date.parse(row?.updated_at || '') || 0;
    return {
      tabId: `remote_${row?.profile_id || ''}_${row?.process_key || ''}`,
      suapId: row?.suap_id || payload.process?.suapId || '',
      processNumber: row?.process_number || payload.process?.numProcesso || '',
      process: payload.process || null,
      fields: Array.isArray(payload.fields) ? payload.fields : [],
      url: payload.url || '',
      title: payload.title || '',
      updatedAt,
      activeAt: updatedAt,
      remote: true,
    };
  }

  function isSameProcess(a, b) {
    if (a?.suapId && b?.suapId) return String(a.suapId) === String(b.suapId);
    return Boolean(a?.processNumber && b?.processNumber && a.processNumber === b.processNumber);
  }

  // Processos locais vêm antes e prevalecem; os de outros perfis entram depois, do mais recente ao mais antigo.
  function mergeRemoteProcesses(localList, remoteList) {
    const merged = Array.isArray(localList) ? [...localList] : [];
    const remote = (Array.isArray(remoteList) ? remoteList : [])
      .slice()
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    for (const item of remote) {
      if (!merged.some((existing) => isSameProcess(existing, item))) merged.push(item);
    }
    return merged;
  }

  function withTimeout(promise, timeoutMs) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Tempo esgotado ao consultar o SIAGES.')), timeoutMs); }),
    ]).finally(() => clearTimeout(timer));
  }

  function createProcessRegistrySync({ storage, getAccessToken, fetchRest, now = () => Date.now(), timeoutMs = DEFAULT_TIMEOUT_MS }) {
    const lastPushed = new Map();
    let lastPruneAt = 0;
    let profileIdPromise = null;

    function getProfileId() {
      if (!profileIdPromise) {
        profileIdPromise = (async () => {
          const stored = await storage.get(PROFILE_KEY);
          const existing = stored?.[PROFILE_KEY];
          if (typeof existing === 'string' && /^[0-9a-f-]{36}$/.test(existing)) return existing;
          const created = scope.crypto.randomUUID();
          await storage.set({ [PROFILE_KEY]: created });
          return created;
        })().catch((error) => { profileIdPromise = null; throw error; });
      }
      return profileIdPromise;
    }

    async function readToken() {
      try {
        return (await getAccessToken()) || null;
      } catch {
        return null;
      }
    }

    async function prune(token, profileId) {
      if (now() - lastPruneAt < PRUNE_INTERVAL_MS) return;
      lastPruneAt = now();
      const cutoff = new Date(now() - RETENTION_MS).toISOString();
      await fetchRest(
        `${TABLE}?profile_id=eq.${encodeURIComponent(profileId)}&updated_at=lt.${encodeURIComponent(cutoff)}`,
        token,
        { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
      );
    }

    async function push(record) {
      const processKey = getProcessKey(record);
      if (!processKey) return { ok: false, skipped: 'sem-identificador' };
      const token = await readToken();
      if (!token) return { ok: false, skipped: 'sem-sessao' };

      const payload = buildPayload(record);
      const signature = JSON.stringify([record?.suapId || '', record?.processNumber || '', payload]);
      const previous = lastPushed.get(processKey);
      if (previous && previous.signature === signature && now() - previous.at < PUSH_DEDUP_MS) {
        return { ok: true, skipped: 'sem-alteracao' };
      }

      try {
        const profileId = await getProfileId();
        await fetchRest(`${TABLE}?on_conflict=tenant_id,profile_id,process_key`, token, {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({
            profile_id: profileId,
            process_key: processKey,
            suap_id: String(record?.suapId || '').slice(0, 20),
            process_number: String(record?.processNumber || '').slice(0, 80),
            payload,
          }),
        });
        lastPushed.set(processKey, { signature, at: now() });
        await prune(token, profileId).catch(() => {});
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }

    async function remove(record) {
      const processKey = getProcessKey(record);
      if (!processKey) return { ok: false, skipped: 'sem-identificador' };
      const token = await readToken();
      if (!token) return { ok: false, skipped: 'sem-sessao' };
      try {
        const profileId = await getProfileId();
        await fetchRest(
          `${TABLE}?profile_id=eq.${encodeURIComponent(profileId)}&process_key=eq.${encodeURIComponent(processKey)}`,
          token,
          { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
        );
        lastPushed.delete(processKey);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }

    async function readCache() {
      const stored = await storage.get(REMOTE_CACHE_KEY).catch(() => ({}));
      const cached = Array.isArray(stored?.[REMOTE_CACHE_KEY]?.processes) ? stored[REMOTE_CACHE_KEY].processes : [];
      return cached.filter((item) => now() - (item.updatedAt || 0) <= READ_WINDOW_MS);
    }

    // Sem sessão não há como saber de quem são os registros: não devolve o cache de outro login.
    async function fetchRemote() {
      const token = await readToken();
      if (!token) return [];
      try {
        const rows = await withTimeout((async () => {
          const profileId = await getProfileId();
          const since = new Date(now() - READ_WINDOW_MS).toISOString();
          return fetchRest(
            `${TABLE}?select=profile_id,process_key,suap_id,process_number,payload,updated_at` +
              `&profile_id=neq.${encodeURIComponent(profileId)}` +
              `&updated_at=gte.${encodeURIComponent(since)}` +
              `&order=updated_at.desc&limit=${READ_LIMIT}`,
            token,
          );
        })(), timeoutMs);
        const processes = (Array.isArray(rows) ? rows : []).map(rowToProcess);
        await storage.set({ [REMOTE_CACHE_KEY]: { fetchedAt: now(), processes } }).catch(() => {});
        return processes;
      } catch {
        return readCache();
      }
    }

    return { getProfileId, push, remove, fetchRemote };
  }

  scope.SiagesProcessRegistrySync = {
    TABLE,
    PROFILE_KEY,
    REMOTE_CACHE_KEY,
    READ_WINDOW_MS,
    MAX_PAYLOAD_BYTES,
    getProcessKey,
    buildPayload,
    rowToProcess,
    mergeRemoteProcesses,
    createProcessRegistrySync,
  };
})(globalThis);
