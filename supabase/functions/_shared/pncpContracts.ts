// Shared by the browser's read-only lookup and the server synchronizer.
export const PNCP_CNPJ = '10877412000168';
export const PNCP_API = 'https://pncp.gov.br/api/pncp/v1';
export const PNCP_CONSULTA = 'https://pncp.gov.br/api/consulta/v1';
export type JsonRow = Record<string, any>;
export type RequestJson = (url: string) => Promise<any>;
export const digits = (value: unknown) => String(value ?? '').replace(/\D/g, '');
const numberPart = (value: unknown) => String(value ?? '').split('/')[0].trim().replace(/^0+/, '');

export function parseContractControl(value: unknown) {
  const match = String(value ?? '').trim().match(/^(\d{14})-2-(\d+)\/(\d{4})$/);
  return match && Number(match[2]) > 0 ? {
    cnpj: match[1], ano: Number(match[3]), sequencial: String(Number(match[2])),
    numeroControlePNCP: String(value).trim(), hasPncpRecord: true,
  } : null;
}

export async function requestPncpJson(url: string, signal?: AbortSignal, deadline = Infinity) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  if (Date.now() >= deadline) throw new Error('Tempo do lote PNCP esgotado; consulta pendente para nova tentativa.');
  const timer = setTimeout(abort, Math.min(15000, deadline - Date.now()));
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (response.status === 204) return null;
    if (!response.ok) throw new Error(`PNCP respondeu com status ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export async function listContractPages(cnpj: string, year: number, uasg: string, request: RequestJson) {
  const items: JsonRow[] = [];
  const seen = new Set<string>();
  // Two half-year windows also cover leap years within the PNCP period limit.
  for (const [start, end] of [['0101', '0630'], ['0701', '1231']]) {
    for (let page = 1; ; page++) {
      if (page > 1000) throw new Error('Paginação PNCP excedeu o limite; resultado incompleto.');
      const url = `${PNCP_CONSULTA}/contratos?dataInicial=${year}${start}&dataFinal=${year}${end}&cnpjOrgao=${cnpj}&codigoUnidadeAdministrativa=${uasg}&pagina=${page}&tamanhoPagina=50`;
      const data = await request(url);
      if (data === null) break;
      if (!Array.isArray(data.data)) throw new Error('Formato inesperado na consulta de contratos PNCP.');
      const rows: JsonRow[] = data.data;
      if (!rows.length) {
        if (Number(data.totalPaginas) > page) throw new Error('Página vazia em consulta PNCP incompleta.');
        break;
      }
      // Detect APIs ignoring pagina, rather than silently accepting a truncated list.
      const fingerprint = JSON.stringify(rows);
      const pageKey = `${start}:${fingerprint}`;
      if (seen.has(pageKey)) throw new Error('PNCP repetiu uma página; consulta incompleta.');
      seen.add(pageKey);
      items.push(...rows);
      if (data.paginasRestantes === 0 || (Number(data.totalPaginas) > 0 && page >= Number(data.totalPaginas))) break;
      if (data.totalPaginas == null && data.paginasRestantes == null && rows.length < 50) break;
    }
  }
  return [...new Map(items.map((item) => [item.numeroControlePNCP || `${item.anoContrato}:${item.sequencialContrato}`, item])).values()];
}

export async function resolvePncpReference(contrato: JsonRow | null | undefined, request: RequestJson,
  cache = new Map<string, JsonRow[]>()) {
  if (!contrato) return null;
  const raw = contrato.raw_data || {};
  for (const value of [contrato.pncp_control_number, raw.numeroControlePncpContrato,
    raw.numeroControlePNCP, raw.numero_controle_pncp, raw.numero_controle_pncp_contrato]) {
    const ref = parseContractControl(value);
    if (ref) return ref;
  }
  // A renewal date must never replace the original contract's year.
  const year = Number(String(contrato.numero ?? '').match(/\/(\d{4})/)?.[1]);
  if (!year) throw new Error('Contrato sem ano identificável; referência PNCP necessária.');
  if (year < 2021) return null;
  const cnpjCandidate = digits(raw.contratante?.orgao_cnpj || raw.orgao?.cnpj);
  const cnpj = cnpjCandidate.length === 14 ? cnpjCandidate : PNCP_CNPJ;
  const uasgs = [...new Set([contrato.unidade_origem_codigo, contrato.unidade_codigo].filter(Boolean))];
  if (!uasgs.length) uasgs.push('158366');
  const target = numberPart(contrato.numero);
  const process = digits(contrato.processo);
  for (const uasg of uasgs) {
    const key = `${cnpj}:${year}:${uasg}`;
    let list = cache.get(key);
    if (!list) {
      list = await listContractPages(cnpj, year, uasg, request);
      cache.set(key, list); // only a complete successful result is cached
    }
    const candidates = list.filter((item) => Number(item.anoContrato) === year &&
      (!item.unidadeOrgao?.codigoUnidade || String(item.unidadeOrgao.codigoUnidade) === uasg) &&
      (!item.orgaoEntidade?.cnpj || digits(item.orgaoEntidade.cnpj) === cnpj) &&
      numberPart(item.numeroContratoEmpenho) === target);
    const matches = candidates.filter((item) => !process || !digits(item.processo ?? item.numeroProcesso) ||
      digits(item.processo ?? item.numeroProcesso) === process);
    if (matches.length > 1) throw new Error('Mais de um contrato PNCP corresponde ao número e ano; vínculo ambíguo.');
    if (matches.length === 1) {
      const item = matches[0];
      if (!Number(item.sequencialContrato)) throw new Error('Contrato PNCP sem sequencial válido.');
      return { cnpj: item.orgaoEntidade?.cnpj || cnpj, ano: year, sequencial: String(item.sequencialContrato),
        numeroControlePNCP: item.numeroControlePNCP, numeroContratoEmpenho: item.numeroContratoEmpenho,
        objeto: item.objetoContrato, fornecedorNome: item.nomeRazaoSocialFornecedor,
        unidadeCodigo: item.unidadeOrgao?.codigoUnidade, unidadeNome: item.unidadeOrgao?.nomeUnidade,
        hasPncpRecord: true };
    }
  }
  return null;
}

export function requireArray(data: unknown): JsonRow[] {
  if (data === null) return [];
  if (!Array.isArray(data)) throw new Error('Formato inesperado dos documentos/instrumentos PNCP.');
  return data;
}

export function parseMoney(value: unknown): number | null {
  if (value == null || value === '') return null;
  const str = String(value).trim();
  const number = Number(str.includes(',') ? str.replace(/\./g, '').replace(',', '.') : str);
  return Number.isFinite(number) ? number : null;
}
