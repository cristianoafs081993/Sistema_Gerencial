import { supabase } from '@/lib/supabase';
import { IFRN_CNPJ } from '@/lib/licitacoesPncp';
import type { ContratoApiRow } from '@/services/contratosApi';

export const PNCP_API_BASE = 'https://pncp.gov.br/api/pncp/v1';
export const PNCP_CONSULTA_BASE = 'https://pncp.gov.br/api/consulta/v1';
export const PNCP_WEB_BASE = 'https://pncp.gov.br/app/contratos';
export const MIN_PNCP_YEAR = 2021;
const DEFAULT_UASG = '158366';
const FETCH_TIMEOUT_MS = 20000; // 20 segundos para suportar períodos de alta carga no PNCP

export interface PncpDocumentoContrato {
  sequencialDocumento: number;
  titulo: string;
  tipoDocumentoId?: number | null;
  tipoDocumentoNome: string;
  url: string;
  uri?: string;
  dataPublicacaoPncp?: string | null;
  tamanho?: number | null;
}

export interface PncpContratoRef {
  cnpj: string;
  ano: number;
  sequencial: string; // sequencialContrato oficial no PNCP
  numeroControlePNCP?: string | null;
  numeroContratoEmpenho?: string | null;
  objeto?: string | null;
  fornecedorNome?: string | null;
  unidadeCodigo?: string | null;
  unidadeNome?: string | null;
  hasPncpRecord?: boolean;
}

export interface PncpConsultaContratoItem {
  anoContrato: number;
  sequencialContrato: number;
  numeroControlePNCP: string;
  numeroContratoEmpenho: string;
  processo?: string | null;
  objetoContrato?: string | null;
  nomeRazaoSocialFornecedor?: string | null;
  niFornecedor?: string | null;
  dataAssinatura?: string | null;
  dataVigenciaInicio?: string | null;
  dataVigenciaFim?: string | null;
  orgaoEntidade?: {
    cnpj?: string | null;
    razaoSocial?: string | null;
  };
  unidadeOrgao?: {
    codigoUnidade?: string | null;
    nomeUnidade?: string | null;
    municipioNome?: string | null;
    ufSigla?: string | null;
  };
}

const pncpUasgAnoCache = new Map<string, { expiresAt: number; data: PncpConsultaContratoItem[] }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

export function clearPncpContratosCache() {
  pncpUasgAnoCache.clear();
}

/**
 * Normaliza CNPJ (remove caracteres não numéricos).
 */
function normalizeCnpj(raw?: unknown): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return digits.length === 14 ? digits : IFRN_CNPJ;
}

/**
 * Normaliza número de contrato para comparação (ex: "00174/2026" -> "174").
 */
function normalizeNumero(num?: unknown): string {
  const str = String(num ?? '').trim();
  const firstPart = str.split('/')[0].trim();
  return firstPart.replace(/^0+/, '');
}

/**
 * Normaliza número de processo (remove pontuação).
 */
function normalizeProcesso(proc?: unknown): string {
  return String(proc ?? '').replace(/\D/g, '');
}

/**
 * Calcula intervalo de datas focado a partir de data de vigência, publicação ou assinatura.
 */
function computeDateRange(ano: number, refDateStr?: string | null): { dataInicial: string; dataFinal: string } {
  if (!refDateStr) {
    return { dataInicial: `${ano}0101`, dataFinal: `${ano}1231` };
  }

  const date = new Date(refDateStr);
  if (Number.isNaN(date.getTime())) {
    return { dataInicial: `${ano}0101`, dataFinal: `${ano}1231` };
  }

  const start = new Date(date);
  start.setMonth(start.getMonth() - 4);
  const end = new Date(date);
  end.setMonth(end.getMonth() + 4);

  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

  return {
    dataInicial: fmt(start),
    dataFinal: fmt(end),
  };
}

/**
 * Helper para fetch com timeout embutido e suporte a AbortSignal externo.
 */
async function fetchWithTimeout(url: string, options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<Response> {
  const timeoutMs = options?.timeoutMs ?? FETCH_TIMEOUT_MS;
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

  const combinedSignal = options?.signal
    ? (AbortSignal.any
        ? AbortSignal.any([options.signal, timeoutController.signal])
        : options.signal)
    : timeoutController.signal;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: combinedSignal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Constrói a URL para acessar a página oficial do contrato no portal PNCP.
 */
export function buildPncpContratoWebUrl(ref: PncpContratoRef): string {
  const cleanCnpj = normalizeCnpj(ref.cnpj);
  const cleanYear = Number(ref.ano);
  const cleanSeq = String(ref.sequencial).trim();
  return `${PNCP_WEB_BASE}/${cleanCnpj}/${cleanYear}/${cleanSeq}`;
}

/**
 * Constrói a URL da API do PNCP para consulta de arquivos de um contrato.
 */
export function buildPncpContratoArquivosApiUrl(ref: PncpContratoRef): string {
  const cleanCnpj = normalizeCnpj(ref.cnpj);
  const cleanYear = Number(ref.ano);
  const seq = String(ref.sequencial).trim();
  return `${PNCP_API_BASE}/orgaos/${cleanCnpj}/contratos/${cleanYear}/${seq}/arquivos`;
}

/**
 * Consulta a lista de contratos de uma UASG/Ano na API de Consulta do PNCP.
 */
export async function fetchPncpContratosConsulta(
  cnpj: string,
  ano: number,
  uasgCodigo: string,
  dateRange?: { dataInicial: string; dataFinal: string },
  options?: { signal?: AbortSignal },
): Promise<PncpConsultaContratoItem[]> {
  if (ano < MIN_PNCP_YEAR) {
    return [];
  }

  const range = dateRange ?? { dataInicial: `${ano}0101`, dataFinal: `${ano}1231` };
  const cacheKey = `${cnpj}:${uasgCodigo}:${range.dataInicial}-${range.dataFinal}`;
  const cached = pncpUasgAnoCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const url = `${PNCP_CONSULTA_BASE}/contratos?dataInicial=${range.dataInicial}&dataFinal=${range.dataFinal}&cnpjOrgao=${cnpj}&codigoUnidadeAdministrativa=${uasgCodigo}&pagina=1&tamanhoPagina=50`;

  try {
    const res = await fetchWithTimeout(url, {
      signal: options?.signal,
      timeoutMs: FETCH_TIMEOUT_MS,
    });

    if (res.status === 204) {
      pncpUasgAnoCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: [] });
      return [];
    }

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    const items: PncpConsultaContratoItem[] = Array.isArray(data.data) ? data.data : [];

    pncpUasgAnoCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: items });
    return items;
  } catch (err) {
    if ((err as Error)?.name === 'AbortError' && options?.signal?.aborted) {
      throw err;
    }
    return [];
  }
}

/**
 * Resolve a referência exata do contrato no PNCP (encontra o sequencialContrato oficial).
 */
export async function resolveContratoPncp(
  contrato: ContratoApiRow | {
    numero?: string | null;
    unidade_codigo?: string | null;
    unidade_origem_codigo?: string | null;
    processo?: string | null;
    vigencia_inicio?: string | null;
    raw_data?: Record<string, unknown> | null;
  } | null | undefined,
  options?: { signal?: AbortSignal },
): Promise<PncpContratoRef | null> {
  if (!contrato) return null;

  const rawData = (contrato.raw_data && typeof contrato.raw_data === 'object' ? contrato.raw_data : {}) as Record<string, unknown>;

  // 1. Se o raw_data já contiver o numeroControlePncpContrato oficial
  const pncpControl =
    (rawData.numeroControlePncpContrato as string) ||
    (rawData.numeroControlePNCP as string) ||
    (rawData.numero_controle_pncp as string) ||
    (rawData.numero_controle_pncp_contrato as string);

  if (pncpControl && typeof pncpControl === 'string') {
    const match = pncpControl.trim().match(/^(\d{14})-(?:\d+-)?(\d+)\/(\d{4})$/);
    if (match) {
      return {
        cnpj: match[1],
        sequencial: String(Number(match[2])),
        ano: Number(match[3]),
        numeroControlePNCP: pncpControl.trim(),
        hasPncpRecord: true,
      };
    }
  }

  // 2. Extrair ano e número do contrato
  const numeroStr = String(contrato.numero ?? '').trim();
  const numMatch = numeroStr.match(/^0*(\d+)\/(\d{4})$/) || numeroStr.match(/(\d+)\D+(\d{4})/);

  let ano = numMatch ? Number(numMatch[2]) : null;
  if (!ano && contrato.vigencia_inicio) {
    const parsedYear = new Date(contrato.vigencia_inicio).getFullYear();
    if (!Number.isNaN(parsedYear)) ano = parsedYear;
  }
  if (!ano) ano = new Date().getFullYear();

  // Contratos anteriores à vigência do PNCP (Lei 14.133/2021) não existem na base do PNCP
  if (ano < MIN_PNCP_YEAR) {
    return null;
  }

  const targetNumeroClean = normalizeNumero(numeroStr);
  const targetProcessoClean = normalizeProcesso(contrato.processo);

  const rawCnpj =
    rawData.cnpj ||
    (rawData.contratante as Record<string, unknown>)?.orgao_cnpj ||
    (rawData.orgao as Record<string, unknown>)?.cnpj;
  const cnpj = normalizeCnpj(rawCnpj);

  // UGs candidatas para busca (UG primária do contrato, e UG de origem caso Reitoria)
  const primaryUasg = contrato.unidade_origem_codigo || contrato.unidade_codigo || DEFAULT_UASG;
  const candidateUasgs = [primaryUasg];

  if (primaryUasg === DEFAULT_UASG && contrato.unidade_origem_codigo === '158155') {
    candidateUasgs.push('158155');
  } else if (primaryUasg === '158155' && contrato.unidade_codigo === DEFAULT_UASG) {
    candidateUasgs.push(DEFAULT_UASG);
  }

  const refDateStr =
    (rawData.data_publicacao as string) ||
    (rawData.data_assinatura as string) ||
    contrato.vigencia_inicio ||
    null;

  const dateRange = computeDateRange(ano, refDateStr);

  for (const uasg of candidateUasgs) {
    // 1. Tenta buscar no intervalo focado
    let items = await fetchPncpContratosConsulta(cnpj, ano, uasg, dateRange, options);

    // 2. Se não encontrar no intervalo focado e a janela não era o ano inteiro, busca no ano completo
    if (items.length === 0 && (dateRange.dataInicial !== `${ano}0101` || dateRange.dataFinal !== `${ano}1231`)) {
      items = await fetchPncpContratosConsulta(cnpj, ano, uasg, { dataInicial: `${ano}0101`, dataFinal: `${ano}1231` }, options);
    }

    if (items.length === 0) continue;

    // Match por número do contrato (ex: "00174" ou "174")
    const matchByNum = items.find((item) => {
      const itemNumClean = normalizeNumero(item.numeroContratoEmpenho);
      return itemNumClean && itemNumClean === targetNumeroClean;
    });

    if (matchByNum) {
      return {
        cnpj: matchByNum.orgaoEntidade?.cnpj || cnpj,
        ano: matchByNum.anoContrato,
        sequencial: String(matchByNum.sequencialContrato),
        numeroControlePNCP: matchByNum.numeroControlePNCP,
        numeroContratoEmpenho: matchByNum.numeroContratoEmpenho,
        objeto: matchByNum.objetoContrato,
        fornecedorNome: matchByNum.nomeRazaoSocialFornecedor,
        unidadeCodigo: matchByNum.unidadeOrgao?.codigoUnidade,
        unidadeNome: matchByNum.unidadeOrgao?.nomeUnidade,
        hasPncpRecord: true,
      };
    }

    // Match por processo
    if (targetProcessoClean && targetProcessoClean.length >= 8) {
      const matchByProc = items.find((item) => {
        const itemProcClean = normalizeProcesso(item.processo);
        return itemProcClean && itemProcClean === targetProcessoClean;
      });

      if (matchByProc) {
        return {
          cnpj: matchByProc.orgaoEntidade?.cnpj || cnpj,
          ano: matchByProc.anoContrato,
          sequencial: String(matchByProc.sequencialContrato),
          numeroControlePNCP: matchByProc.numeroControlePNCP,
          numeroContratoEmpenho: matchByProc.numeroContratoEmpenho,
          objeto: matchByProc.objetoContrato,
          fornecedorNome: matchByProc.nomeRazaoSocialFornecedor,
          unidadeCodigo: matchByProc.unidadeOrgao?.codigoUnidade,
          unidadeNome: matchByProc.unidadeOrgao?.nomeUnidade,
          hasPncpRecord: true,
        };
      }
    }
  }

  return null;
}

/**
 * Salva documentos e metadados do PNCP no banco de dados Supabase.
 */
export async function salvarDocumentosPncpNoBanco(
  contratoApiId: string,
  ref: PncpContratoRef | null,
  documentos: PncpDocumentoContrato[],
): Promise<void> {
  if (!contratoApiId) return;

  try {
    if (ref) {
      await supabase
        .from('contratos_api')
        .update({
          pncp_sequencial: ref.sequencial ? Number(ref.sequencial) : null,
          pncp_ano: ref.ano || null,
          pncp_control_number: ref.numeroControlePNCP || null,
          pncp_has_record: ref.hasPncpRecord ?? true,
          pncp_documentos_checked_at: new Date().toISOString(),
          pncp_documentos_count: documentos.length,
        })
        .eq('id', contratoApiId);
    } else {
      await supabase
        .from('contratos_api')
        .update({
          pncp_has_record: false,
          pncp_documentos_checked_at: new Date().toISOString(),
          pncp_documentos_count: 0,
        })
        .eq('id', contratoApiId);
    }

    if (documentos.length > 0) {
      const rows = documentos.map((d) => ({
        contrato_api_id: contratoApiId,
        sequencial_documento: d.sequencialDocumento,
        titulo: d.titulo,
        tipo_documento_id: d.tipoDocumentoId,
        tipo_documento_nome: d.tipoDocumentoNome,
        url: d.url,
        uri: d.uri || null,
        data_publicacao_pncp: d.dataPublicacaoPncp || null,
        tamanho: d.tamanho || null,
        raw_data: d as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      }));

      await supabase
        .from('contratos_api_documentos')
        .upsert(rows, { onConflict: 'contrato_api_id,sequencial_documento,url' });
    }
  } catch (err) {
    console.warn('Erro ao salvar documentos do PNCP no banco:', err);
  }
}

/**
 * Busca a lista de documentos/arquivos PDF de um contrato publicados no PNCP.
 */
export async function buscarDocumentosContratoPncp(
  target: ContratoApiRow | PncpContratoRef | {
    id?: string;
    numero?: string | null;
    unidade_codigo?: string | null;
    unidade_origem_codigo?: string | null;
    processo?: string | null;
    vigencia_inicio?: string | null;
    raw_data?: Record<string, unknown> | null;
  } | null | undefined,
  options?: { signal?: AbortSignal },
): Promise<{
  ref: PncpContratoRef | null;
  documentos: PncpDocumentoContrato[];
  hasPncpRecord: boolean;
  error?: string;
}> {
  if (!target) {
    return {
      ref: null,
      documentos: [],
      hasPncpRecord: false,
      error: 'Contrato não informado para consulta no PNCP.',
    };
  }

  const contratoApiId = (typeof target === 'object' && target !== null && 'id' in target && typeof target.id === 'string')
    ? target.id
    : undefined;

  const isPreResolved =
    typeof target === 'object' &&
    target !== null &&
    'cnpj' in target &&
    'ano' in target &&
    'sequencial' in target;

  const ref = isPreResolved
    ? (target as PncpContratoRef)
    : await resolveContratoPncp(target, options);

  if (!ref) {
    if (contratoApiId) {
      void salvarDocumentosPncpNoBanco(contratoApiId, null, []);
    }
    return {
      ref: null,
      documentos: [],
      hasPncpRecord: false,
      error: 'Contrato não localizado na base de consultas do PNCP.',
    };
  }

  try {
    const url = buildPncpContratoArquivosApiUrl(ref);
    const res = await fetchWithTimeout(url, {
      signal: options?.signal,
      timeoutMs: FETCH_TIMEOUT_MS,
    });

    if (res.status === 204) {
      if (contratoApiId) {
        void salvarDocumentosPncpNoBanco(contratoApiId, ref, []);
      }
      return {
        ref,
        documentos: [],
        hasPncpRecord: true,
      };
    }

    if (!res.ok) {
      return {
        ref,
        documentos: [],
        hasPncpRecord: true,
        error: `PNCP respondeu com status ${res.status}`,
      };
    }

    const data = await res.json();
    if (Array.isArray(data)) {
      const documentos: PncpDocumentoContrato[] = data.map((item: Record<string, unknown>) => {
        const rawUrl = String(item.url ?? item.uri ?? '');
        return {
          sequencialDocumento: Number(item.sequencialDocumento ?? item.sequencial ?? 0),
          titulo: String(item.titulo ?? item.nomeDocumento ?? item.tipoDocumentoNome ?? 'Documento'),
          tipoDocumentoId: item.tipoDocumentoId != null ? Number(item.tipoDocumentoId) : null,
          tipoDocumentoNome: String(item.tipoDocumentoNome ?? item.tipoDocumento ?? 'Outros Documentos'),
          url: rawUrl,
          uri: item.uri ? String(item.uri) : undefined,
          dataPublicacaoPncp: item.dataPublicacaoPncp ? String(item.dataPublicacaoPncp) : null,
          tamanho: item.tamanho != null ? Number(item.tamanho) : null,
        };
      });

      if (contratoApiId) {
        void salvarDocumentosPncpNoBanco(contratoApiId, ref, documentos);
      }

      return {
        ref,
        documentos,
        hasPncpRecord: true,
      };
    }

    if (contratoApiId) {
      void salvarDocumentosPncpNoBanco(contratoApiId, ref, []);
    }

    return {
      ref,
      documentos: [],
      hasPncpRecord: true,
    };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError' && options?.signal?.aborted) {
      throw err;
    }
    return {
      ref,
      documentos: [],
      hasPncpRecord: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
