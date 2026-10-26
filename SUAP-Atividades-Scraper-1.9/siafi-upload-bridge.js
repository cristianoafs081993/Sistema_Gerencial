/**
 * Leva a captura do comando printup (SIAFI) até o upload do mesmo processo no SUAP.
 * O PDF passa pelo Storage do SIAGES porque o SIAFI pode estar em outro perfil do Chrome;
 * qualquer perfil logado na mesma conta encontra a captura pelo número do processo.
 * O PDF é apagado ao salvar no SUAP; o que sobrar sai na limpeza diária do servidor (cleanup-siafi-capturas).
 */
(function (scope) {
  const BUCKET = 'siafi-capturas';
  const TABLE = 'extension_siafi_uploads';
  const MAX_BYTES = 40 * 1024 * 1024;
  const OPEN_WINDOW_MS = 10 * 60 * 1000;
  const ROW_FIELDS = 'id,process_key,document_key,document_label,file_name,storage_path,byte_size,updated_at';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // SUAP usa o NUP de 17 dígitos; o campo Processo do SIAFI é digitado e pode vir com / ou sem pontuação.
  function processKey(value) {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length === 17 ? digits : '';
  }

  function formatProcess(key) {
    const digits = processKey(key);
    return digits ? `${digits.slice(0, 5)}.${digits.slice(5, 11)}.${digits.slice(11, 15)}-${digits.slice(15)}` : '';
  }

  function processVariants(key) {
    const formatted = formatProcess(key);
    if (!formatted) return [];
    return [formatted, `${formatted.slice(0, 12)}/${formatted.slice(13)}`, processKey(key)];
  }

  function documentKey(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^0-9A-Za-z-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  }

  function pdfFileName(value) {
    const name = String(value || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim()
      .replace(/\.pdf$/i, '').slice(0, 190).replace(/[\s.]+$/, '');
    return `${name || 'captura-siafi'}.pdf`;
  }

  function toBase64(bytes) {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
  }

  function fromBase64(text) {
    const binary = atob(String(text || ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function isPdf(bytes) {
    return bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
  }

  function quoteList(values) {
    return `(${values.map((value) => `"${String(value).replace(/["\\]/g, '')}"`).join(',')})`;
  }

  function toCapture(row) {
    return {
      id: row.id,
      processKey: row.process_key,
      processNumber: formatProcess(row.process_key),
      documentKey: row.document_key,
      documentLabel: row.document_label || row.document_key,
      fileName: row.file_name,
      byteSize: row.byte_size,
      updatedAt: row.updated_at,
    };
  }

  function createSiafiUploadBridge({ supabaseUrl, apiKey, getSession, fetchImpl = (...args) => fetch(...args), now = () => Date.now() }) {
    async function readError(response, fallback) {
      const body = await response.text().catch(() => '');
      let detail = '';
      try { detail = JSON.parse(body)?.message || JSON.parse(body)?.error || ''; } catch { /* Resposta sem JSON. */ }
      return new Error(detail ? `${fallback}: ${detail}` : `${fallback} (HTTP ${response.status}).`);
    }

    async function auth(required = true) {
      const session = await getSession().catch(() => null);
      if (!session?.accessToken) {
        if (!required) return null;
        throw new Error('Entre no SIAGES pelo popup da extensão para enviar a captura ao SUAP.');
      }
      let userId = session.user?.id || '';
      if (!userId) {
        const response = await fetchImpl(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: apiKey, Authorization: `Bearer ${session.accessToken}` } });
        if (!response.ok) throw new Error('Entre novamente no SIAGES pelo popup da extensão.');
        userId = (await response.json())?.id || '';
      }
      if (!UUID.test(userId)) throw new Error('Não foi possível identificar o usuário do SIAGES.');
      return { token: session.accessToken, userId };
    }

    async function rest(path, token, options = {}) {
      const response = await fetchImpl(`${supabaseUrl}/rest/v1/${path}`, {
        ...options,
        headers: { apikey: apiKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
      });
      if (!response.ok) throw await readError(response, 'O SIAGES recusou a operação da captura');
      const body = await response.text().catch(() => '');
      return body ? JSON.parse(body) : null;
    }

    function storageUrl(path) {
      return `${supabaseUrl}/storage/v1/object/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
    }

    async function stage(input) {
      const key = processKey(input?.processNumber);
      if (!key) throw new Error('O DH não informa um processo SUAP válido (Dados Básicos → Processo).');
      const docKey = documentKey(input?.documentKey);
      if (!docKey) throw new Error('Não foi possível identificar o DH capturado.');
      const bytes = fromBase64(input?.pdfBase64);
      if (!isPdf(bytes)) throw new Error('O PDF da captura está vazio ou inválido.');
      if (bytes.length > MAX_BYTES) throw new Error('O PDF passa de 40 MB; anexe-o manualmente no SUAP.');
      const session = await auth();
      const path = `${session.userId}/${key}/${docKey}.pdf`;
      const upload = await fetchImpl(storageUrl(path), {
        method: 'POST',
        headers: { apikey: apiKey, Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/pdf', 'x-upsert': 'true' },
        body: bytes,
      });
      if (!upload.ok) throw await readError(upload, 'O SIAGES recusou o PDF da captura');
      const rows = await rest(`${TABLE}?on_conflict=tenant_id,process_key,document_key&select=${ROW_FIELDS}`, session.token, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
          process_key: key,
          document_key: docKey,
          document_label: String(input?.documentLabel || docKey).slice(0, 80),
          file_name: pdfFileName(input?.fileName),
          storage_path: path,
          byte_size: bytes.length,
          capture_id: String(input?.captureId || '').slice(0, 80),
          open_requested: Boolean(input?.openUp),
          opened_at: null,
        }),
      });
      if (!rows?.[0]) throw new Error('O SIAGES não confirmou o registro da captura.');
      return toCapture(rows[0]);
    }

    // Uma captura do printup fica disponível para abrir automaticamente por alguns minutos.
    async function pendingOpen() {
      const session = await auth(false);
      if (!session) return [];
      const since = new Date(now() - OPEN_WINDOW_MS).toISOString();
      const rows = await rest(`${TABLE}?select=${ROW_FIELDS}&open_requested=is.true&opened_at=is.null` +
        `&updated_at=gte.${encodeURIComponent(since)}&order=updated_at.desc&limit=5`, session.token);
      return (rows || []).map(toCapture);
    }

    // Só um perfil abre a aba: a atualização condicional falha para quem chegar depois.
    async function claim(id) {
      if (!UUID.test(String(id || ''))) return false;
      const session = await auth(false);
      if (!session) return false;
      const rows = await rest(`${TABLE}?id=eq.${id}&opened_at=is.null&select=id`, session.token, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ opened_at: new Date(now()).toISOString() }),
      });
      return Array.isArray(rows) && rows.length === 1;
    }

    async function resolveSuapId(key) {
      const variants = processVariants(key);
      if (!variants.length) return '';
      const session = await auth(false);
      if (!session) return '';
      const list = encodeURIComponent(quoteList(variants));
      const registry = await rest(`extension_process_registry?select=suap_id&process_number=in.${list}&suap_id=neq.&order=updated_at.desc&limit=1`, session.token).catch(() => []);
      if (/^\d+$/.test(registry?.[0]?.suap_id || '')) return registry[0].suap_id;
      const processos = await rest(`processos?select=suap_id&num_processo=in.${list}&suap_id=not.is.null&limit=1`, session.token).catch(() => []);
      return /^\d+$/.test(String(processos?.[0]?.suap_id || '')) ? String(processos[0].suap_id) : '';
    }

    async function processKeysForSuapId(suapId) {
      if (!/^\d{1,20}$/.test(String(suapId || ''))) return [];
      const session = await auth(false);
      if (!session) return [];
      const [registry, processos] = await Promise.all([
        rest(`extension_process_registry?select=process_number&suap_id=eq.${suapId}&order=updated_at.desc&limit=5`, session.token).catch(() => []),
        rest(`processos?select=num_processo&suap_id=eq.${suapId}&limit=5`, session.token).catch(() => []),
      ]);
      return [...(registry || []).map((row) => row.process_number), ...(processos || []).map((row) => row.num_processo)]
        .map(processKey).filter(Boolean);
    }

    // Procura a captura ainda não enviada; recusa quando os candidatos apontam para processos diferentes.
    async function find({ uploadId, keys }) {
      const session = await auth(false);
      if (!session) return { capture: null, reason: 'sem-sessao' };
      const filters = '&order=updated_at.desc&limit=10';
      if (UUID.test(String(uploadId || ''))) {
        const rows = await rest(`${TABLE}?select=${ROW_FIELDS}&id=eq.${uploadId}${filters}`, session.token);
        if (rows?.[0]) return { capture: toCapture(rows[0]), others: 0 };
      }
      const unique = [...new Set((keys || []).map(processKey).filter(Boolean))];
      if (!unique.length) return { capture: null, reason: 'sem-processo' };
      const rows = (await rest(`${TABLE}?select=${ROW_FIELDS}&process_key=in.${encodeURIComponent(quoteList(unique))}${filters}`, session.token)) || [];
      const processes = [...new Set(rows.map((row) => row.process_key))];
      if (processes.length > 1) return { capture: null, reason: 'ambiguo', processes: processes.map(formatProcess) };
      return rows[0] ? { capture: toCapture(rows[0]), others: rows.length - 1 } : { capture: null, reason: 'sem-captura' };
    }

    async function download(id) {
      if (!UUID.test(String(id || ''))) throw new Error('Captura inválida.');
      const session = await auth();
      const rows = await rest(`${TABLE}?select=${ROW_FIELDS}&id=eq.${id}&limit=1`, session.token);
      const row = rows?.[0];
      if (!row) throw new Error('A captura SIAFI não está mais disponível. Gere um novo printup.');
      const response = await fetchImpl(`${supabaseUrl}/storage/v1/object/authenticated/${BUCKET}/${row.storage_path.split('/').map(encodeURIComponent).join('/')}`, {
        headers: { apikey: apiKey, Authorization: `Bearer ${session.token}` },
      });
      if (!response.ok) throw await readError(response, 'Não foi possível baixar a captura SIAFI');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!isPdf(bytes) || bytes.length > MAX_BYTES) throw new Error('A captura SIAFI salva está inválida. Gere um novo printup.');
      return { ...toCapture(row), pdfBase64: toBase64(bytes) };
    }

    // Ao salvar no SUAP o PDF já foi enviado e há cópia local: apaga linha e arquivo na hora.
    // Se a exclusão do arquivo falhar, a limpeza diária do servidor remove o que sobrar.
    async function consume(id) {
      if (!UUID.test(String(id || ''))) return false;
      const session = await auth(false);
      if (!session) return false;
      const rows = await rest(`${TABLE}?id=eq.${id}&select=storage_path`, session.token, {
        method: 'DELETE',
        headers: { Prefer: 'return=representation' },
      });
      const paths = (rows || []).map((row) => row.storage_path).filter(Boolean);
      if (!paths.length) return false;
      const response = await fetchImpl(`${supabaseUrl}/storage/v1/object/${BUCKET}`, {
        method: 'DELETE',
        headers: { apikey: apiKey, Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: paths }),
      });
      return response.ok;
    }

    return { stage, pendingOpen, claim, resolveSuapId, processKeysForSuapId, find, download, consume };
  }

  function buildUploadUrl(capture, suapId) {
    const processNumber = formatProcess(capture?.processKey);
    if (!/^\d{1,20}$/.test(String(suapId || ''))) {
      return `https://suap.ifrn.edu.br/admin/processo_eletronico/processo/?q=${encodeURIComponent(processNumber)}`;
    }
    const payload = {
      source: 'siages',
      version: 1,
      action: 'suap_upload_document',
      suapId: String(suapId),
      processNumber,
      siafiUploadId: capture.id,
      tipoConferencia: 'Cópia Simples',
      tipoDocumento: 'Liquidação',
      assunto: 'Liquidação',
    };
    return `https://suap.ifrn.edu.br/processo_eletronico/documento_upload/${suapId}/#siagesUpload=${encodeURIComponent(JSON.stringify(payload))}`;
  }

  scope.SiagesSiafiUploadBridge = {
    BUCKET,
    TABLE,
    MAX_BYTES,
    OPEN_WINDOW_MS,
    processKey,
    formatProcess,
    processVariants,
    documentKey,
    pdfFileName,
    toBase64,
    fromBase64,
    buildUploadUrl,
    createSiafiUploadBridge,
  };
})(globalThis);
