import { supabase } from '@/lib/supabase';
import { IFRN_CNPJ } from '@/lib/licitacoesPncp';
import { PNCP_API_BASE, type PncpContratoRef } from '@/services/pncpContratos';

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

/**
 * Consulta e processa os instrumentos de cobrança (NF-e) de um contrato no PNCP.
 */
export async function buscarInstrumentosCobrancaPncp(
  ref: PncpContratoRef,
  options?: { signal?: AbortSignal },
): Promise<{
  instrumentos: PncpInstrumentoCobranca[];
  totalNfe: number;
  valorTotalFaturado: number;
  error?: string;
}> {
  if (!ref || !ref.ano || !ref.sequencial) {
    return { instrumentos: [], totalNfe: 0, valorTotalFaturado: 0 };
  }

  const cnpj = ref.cnpj || IFRN_CNPJ;
  const url = `${PNCP_API_BASE}/orgaos/${cnpj}/contratos/${ref.ano}/${ref.sequencial}/instrumentocobranca`;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: options?.signal,
    });

    if (res.status === 204 || res.status === 404) {
      return { instrumentos: [], totalNfe: 0, valorTotalFaturado: 0 };
    }

    if (!res.ok) {
      return {
        instrumentos: [],
        totalNfe: 0,
        valorTotalFaturado: 0,
        error: `PNCP respondeu com status ${res.status}`,
      };
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      return { instrumentos: [], totalNfe: 0, valorTotalFaturado: 0 };
    }

    let valorTotalFaturado = 0;

    const instrumentos: PncpInstrumentoCobranca[] = data.map((raw: Record<string, unknown>) => {
      let notaFiscal: PnfeNotaFiscalDTO | null = null;
      let itens: PnfeItemDTO[] = [];
      let eventos: PnfeEventoDTO[] = [];

      if (raw.jsonResponseNFe && typeof raw.jsonResponseNFe === 'string') {
        try {
          const parsed = JSON.parse(raw.jsonResponseNFe);
          if (parsed && typeof parsed === 'object') {
            if (parsed.notaFiscalDTO) {
              notaFiscal = parsed.notaFiscalDTO;
              if (notaFiscal?.valorNotaFiscal) {
                const valNum =
                  typeof notaFiscal.valorNotaFiscal === 'number'
                    ? notaFiscal.valorNotaFiscal
                    : Number(String(notaFiscal.valorNotaFiscal).replace(/\./g, '').replace(',', '.'));
                if (!Number.isNaN(valNum)) {
                  valorTotalFaturado += valNum;
                }
              }
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
    });

    const result = {
      instrumentos,
      totalNfe: instrumentos.length,
      valorTotalFaturado,
    };

    if (options?.contratoApiId && instrumentos.length > 0) {
      salvarInstrumentosCobrancaNoBanco(options.contratoApiId, instrumentos).catch((err) => {
        console.warn('Erro ao salvar instrumentos de cobrança no banco:', err);
      });
    }

    return result;
  } catch (err) {
    if ((err as Error)?.name === 'AbortError' && options?.signal?.aborted) {
      throw err;
    }
    return {
      instrumentos: [],
      totalNfe: 0,
      valorTotalFaturado: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Persiste os instrumentos de cobrança (NF-e) de forma persistente na tabela contratos_api_instrumentos_cobranca.
 */
export async function salvarInstrumentosCobrancaNoBanco(
  contratoApiId: string,
  instrumentos: PncpInstrumentoCobranca[],
): Promise<void> {
  if (!contratoApiId || !instrumentos || instrumentos.length === 0) return;

  const rows = instrumentos.map((inst) => {
    const val = inst.notaFiscal?.valorNotaFiscal;
    let valorNum: number | null = null;
    if (typeof val === 'number') {
      valorNum = val;
    } else if (typeof val === 'string') {
      const parsed = Number(val.replace(/\./g, '').replace(',', '.'));
      if (!Number.isNaN(parsed)) valorNum = parsed;
    }

    return {
      contrato_api_id: contratoApiId,
      sequencial_instrumento_cobranca: inst.sequencialInstrumentoCobranca,
      tipo_id: Number(inst.raw?.tipoInstrumentoCobrancaId ?? inst.raw?.tipoId ?? 1),
      tipo_nome: inst.tipoNome || 'Nota Fiscal Eletrônica (NF-e)',
      tipo_descricao: inst.tipoDescricao || null,
      numero_instrumento_cobranca: inst.numeroInstrumentoCobranca,
      data_emissao: inst.dataEmissaoDocumento ? inst.dataEmissaoDocumento.slice(0, 10) : null,
      chave_nfe: inst.chaveNFe || inst.notaFiscal?.chaveNotaFiscal || null,
      data_consulta_nfe: inst.dataConsultaNFe || null,
      status_response_nfe: inst.statusResponseNFe || null,
      valor_nota_fiscal: valorNum,
      serie: inst.notaFiscal?.serie ? String(inst.notaFiscal.serie) : null,
      tipo_evento_mais_recente: inst.notaFiscal?.tipoEventoMaisRecente || null,
      data_tipo_evento_mais_recente: inst.notaFiscal?.dataTipoEventoMaisRecente || null,
      nome_fornecedor: inst.notaFiscal?.nomeFornecedor || null,
      cnpj_fornecedor: inst.notaFiscal?.cnpjFornecedor || null,
      municipio_fornecedor: inst.notaFiscal?.municipioFornecedor || null,
      itens: inst.itens || [],
      eventos: inst.eventos || [],
      raw_data: inst.raw || {},
      updated_at: new Date().toISOString(),
    };
  });

  try {
    await supabase
      .from('contratos_api_instrumentos_cobranca')
      .upsert(rows, { onConflict: 'contrato_api_id,sequencial_instrumento_cobranca,numero_instrumento_cobranca' });

    await supabase
      .from('contratos_api')
      .update({
        pncp_instrumentos_checked_at: new Date().toISOString(),
        pncp_instrumentos_count: instrumentos.length,
      })
      .eq('id', contratoApiId);
  } catch (err) {
    console.warn('salvarInstrumentosCobrancaNoBanco: erro ao persistir no Supabase', err);
  }
}
