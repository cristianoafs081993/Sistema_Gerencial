import { supabase } from '@/lib/supabase';
import type { ContratoApiRow } from '@/services/contratosApi';
import { parseInstrumentoCobranca, type PncpInstrumentoCobranca } from './pncpInstrumentosCobranca';
import { PNCP_API, PNCP_CONSULTA, PNCP_CNPJ, resolvePncpReference, requestPncpJson,
  requireArray, type JsonRow } from '../../supabase/functions/_shared/pncpContracts';

export const PNCP_API_BASE = PNCP_API;
export const PNCP_CONSULTA_BASE = PNCP_CONSULTA;
export const PNCP_WEB_BASE = 'https://pncp.gov.br/app/contratos';
export const MIN_PNCP_YEAR = 2021;

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


// A fresh cache per lookup avoids persisting negative results after transient failures.
export function clearPncpContratosCache() { /* retained for compatibility */ }
export async function resolveContratoPncp(contrato: JsonRow | null | undefined, options?: { signal?: AbortSignal }): Promise<PncpContratoRef | null> {
  return resolvePncpReference(contrato, (url) => requestPncpJson(url, options?.signal));
}
export function buildPncpContratoWebUrl(ref: PncpContratoRef): string {
  return `${PNCP_WEB_BASE}/${ref.cnpj || PNCP_CNPJ}/${ref.ano}/${ref.sequencial}`;
}
export function buildPncpContratoArquivosApiUrl(ref: PncpContratoRef): string {
  return `${PNCP_API_BASE}/orgaos/${ref.cnpj || PNCP_CNPJ}/contratos/${ref.ano}/${ref.sequencial}/arquivos`;
}
export function mapPncpDocument(item: JsonRow): PncpDocumentoContrato {
  return {
    sequencialDocumento: Number(item.sequencialDocumento ?? item.sequencial ?? 0),
    titulo: String(item.titulo ?? item.nomeDocumento ?? item.tipoDocumentoNome ?? 'Documento'),
    tipoDocumentoId: item.tipoDocumentoId != null ? Number(item.tipoDocumentoId) : null,
    tipoDocumentoNome: String(item.tipoDocumentoNome ?? item.tipoDocumento ?? 'Outros Documentos'),
    url: String(item.url ?? item.uri ?? ''), uri: item.uri ? String(item.uri) : undefined,
    dataPublicacaoPncp: item.dataPublicacaoPncp ? String(item.dataPublicacaoPncp) : null,
    tamanho: item.tamanho != null ? Number(item.tamanho) : null,
  };
}

/** Read-only public lookup. All persistence goes through the authenticated server. */
export async function buscarDocumentosContratoPncp(target: ContratoApiRow | PncpContratoRef | JsonRow | null | undefined,
  options?: { signal?: AbortSignal }): Promise<{ ref: PncpContratoRef | null; documentos: PncpDocumentoContrato[]; hasPncpRecord: boolean; error?: string }> {
  let ref: PncpContratoRef | null = null;
  try {
    if (!target) throw new Error('Contrato não informado para consulta no PNCP.');
    ref = 'cnpj' in target && 'ano' in target && 'sequencial' in target
      ? target as PncpContratoRef : await resolveContratoPncp(target, options);
    if (!ref) return { ref: null, documentos: [], hasPncpRecord: false, error: 'Contrato não localizado na base de consultas do PNCP.' };
    const data = requireArray(await requestPncpJson(buildPncpContratoArquivosApiUrl(ref), options?.signal));
    return { ref, documentos: data.map(mapPncpDocument), hasPncpRecord: true };
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    return { ref, documentos: [], hasPncpRecord: Boolean(ref), error: error instanceof Error ? error.message : String(error) };
  }
}

export interface PncpSyncResult {
  ref?: PncpContratoRef | null;
  documentos?: PncpDocumentoContrato[];
  instrumentos?: PncpInstrumentoCobranca[];
  errors: string[];
}
export async function sincronizarContratoPncp(contratoApiId: string): Promise<PncpSyncResult> {
  const { data, error } = await supabase.functions.invoke('sync-contratos-pncp-documentos', {
    body: { contratoApiId, forceRefresh: true, source: 'manual' },
  });
  if (error) throw new Error(`Não foi possível sincronizar o contrato: ${error.message}`);
  if (data?.error) throw new Error(data.error);
  const result = data?.resultados?.find((row: JsonRow) => row.id === contratoApiId);
  if (!result || !Array.isArray(result.errors)) throw new Error('Resposta incompleta da sincronização PNCP.');
  return { ref: result.ref,
    documentos: Array.isArray(result.documentos) ? result.documentos.map(mapPncpDocument) : undefined,
    instrumentos: Array.isArray(result.instrumentos) ? result.instrumentos.map(parseInstrumentoCobranca) : undefined,
    errors: result.errors,
  };
}
