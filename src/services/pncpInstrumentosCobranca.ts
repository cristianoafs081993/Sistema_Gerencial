import { IFRN_CNPJ } from '@/lib/licitacoesPncp';
import type { PncpContratoRef } from '@/services/pncpContratos';
import { PNCP_API as PNCP_API_BASE, requestPncpJson, requireArray, parseMoney } from '../../supabase/functions/_shared/pncpContracts';

export interface PnfeItemDTO {
  numeroProduto: string;
  descricaoProdutoServico: string;
  codigoNcmSh?: string | null;
  ncmSh?: string | null;
  cfop?: string | null;
  quantidade: string | number;
  unidade: string;
  valorUnitario: string | number;
  valor: string | number;
}

export interface PnfeEventoDTO {
  codigoEvento?: string;
  descricaoEvento?: string;
  dataEvento?: string;
  sequencialEvento?: number;
}

export interface PnfeNotaFiscalDTO {
  id?: number;
  numero?: number | string;
  serie?: number | string;
  chaveNotaFiscal: string;
  valorNotaFiscal: string | number;
  dataEmissao?: string;
  nomeFornecedor?: string;
  cnpjFornecedor?: string;
  municipioFornecedor?: string;
  tipoEventoMaisRecente?: string;
  dataTipoEventoMaisRecente?: string;
  orgaoDestinatario?: string;
  codigoOrgaoDestinatario?: string;
}

export interface PncpInstrumentoCobranca {
  sequencialInstrumentoCobranca: number;
  tipoNome: string;
  tipoDescricao?: string | null;
  numeroInstrumentoCobranca: string;
  dataEmissaoDocumento: string;
  chaveNFe?: string | null;
  dataConsultaNFe?: string | null;
  statusResponseNFe?: string | null;
  notaFiscal?: PnfeNotaFiscalDTO | null;
  itens: PnfeItemDTO[];
  eventos: PnfeEventoDTO[];
  raw: Record<string, unknown>;
}

/**
 * Formata chave de acesso da NF-e de 44 dígitos em blocos de 4 dígitos.
 * Ex: "2426 0755 8066 8400 0105 5500 1000 0008 6412 5354 0068"
 */
export function formatChaveNfe(chave?: string | null): string {
  if (!chave) return '';
  const clean = chave.replace(/\D/g, '');
  if (clean.length !== 44) return chave;
  return clean.replace(/(\d{4})/g, '$1 ').trim();
}

/**
 * Retorna URL de consulta pública da NF-e no Portal Nacional da SEFAZ / Receita Federal.
 */
export function buildNfePortalUrl(chave?: string | null): string {
  const clean = String(chave ?? '').replace(/\D/g, '');
  if (!clean) return 'https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=completa';
  return `https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=completa&tipoConteudo=XbSeqxE8YW8=&nfe=${clean}`;
}

export function parseInstrumentoCobranca(raw: Record<string, unknown>): PncpInstrumentoCobranca {
  let notaFiscal: PnfeNotaFiscalDTO | null = null;
  let itens: PnfeItemDTO[] = [];
  let eventos: PnfeEventoDTO[] = [];

  if (raw.jsonResponseNFe && typeof raw.jsonResponseNFe === 'string') {
    try {
      const parsed = JSON.parse(raw.jsonResponseNFe);
      if (parsed && typeof parsed === 'object') {
        if (parsed.notaFiscalDTO) {
          notaFiscal = parsed.notaFiscalDTO;

        }
        if (Array.isArray(parsed.itensNotaFiscal)) {
          itens = parsed.itensNotaFiscal;
        }
        if (Array.isArray(parsed.eventosNotaFiscal)) {
          eventos = parsed.eventosNotaFiscal;
        }
      }
    } catch {
      // JSON parsing fallback
    }
  }

  const tipoObj = raw.tipoInstrumentoCobranca as Record<string, unknown> | undefined;
  const tipoNome = String(tipoObj?.nome ?? raw.tipoInstrumentoCobrancaNome ?? 'Nota Fiscal');
  const tipoDescricao = tipoObj?.descricao ? String(tipoObj.descricao) : null;

  return {
    sequencialInstrumentoCobranca: Number(raw.sequencialInstrumentoCobranca ?? 0),
    tipoNome,
    tipoDescricao,
    numeroInstrumentoCobranca: String(raw.numeroInstrumentoCobranca ?? ''),
    dataEmissaoDocumento: String(raw.dataEmissaoDocumento ?? ''),
    chaveNFe: raw.chaveNFe ? String(raw.chaveNFe) : (notaFiscal?.chaveNotaFiscal || null),
    dataConsultaNFe: raw.dataConsultaNFe ? String(raw.dataConsultaNFe) : null,
    statusResponseNFe: raw.statusResponseNFe ? String(raw.statusResponseNFe) : null,
    notaFiscal,
    itens,
    eventos,
    raw,
  };
}

/** Read-only lookup; never attempts browser writes protected by RLS. */
export async function buscarInstrumentosCobrancaPncp(ref: PncpContratoRef, options?: { signal?: AbortSignal }) {
  try {
    if (!ref?.ano || !ref.sequencial) throw new Error('Referência PNCP ausente.');
    const url = `${PNCP_API_BASE}/orgaos/${ref.cnpj || IFRN_CNPJ}/contratos/${ref.ano}/${ref.sequencial}/instrumentocobranca`;
    const instrumentos = requireArray(await requestPncpJson(url, options?.signal)).map(parseInstrumentoCobranca);
    return { instrumentos, totalNfe: instrumentos.length,
      valorTotalFaturado: instrumentos.reduce((sum, item) => sum + (parseMoney(item.notaFiscal?.valorNotaFiscal) || 0), 0) };
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    return { instrumentos: [] as PncpInstrumentoCobranca[], totalNfe: 0, valorTotalFaturado: 0,
      error: error instanceof Error ? error.message : String(error) };
  }
}
