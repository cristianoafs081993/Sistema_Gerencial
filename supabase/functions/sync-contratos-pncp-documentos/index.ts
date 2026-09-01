import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const PNCP_CONSULTA_BASE = 'https://pncp.gov.br/api/consulta/v1';
const PNCP_API_BASE = 'https://pncp.gov.br/api/pncp/v1';
const IFRN_CNPJ = '10877412000168';
const DEFAULT_UASG = '158366';
const MIN_PNCP_YEAR = 2021;
const FETCH_TIMEOUT_MS = 25000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SyncRequest = {
  source?: string;
  unidadeCodigo?: string;
  limit?: number;
  forceRefresh?: boolean;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function normalizeNumero(num?: unknown): string {
  const str = String(num ?? '').trim();
  const firstPart = str.split('/')[0].trim();
  return firstPart.replace(/^0+/, '');
}

function normalizeProcesso(proc?: unknown): string {
  return String(proc ?? '').replace(/\D/g, '');
}

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: timeoutController.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// Cache em memória durante a execução do worker para evitar chamadas repetidas à API de consulta
const uasgContractsCache = new Map<string, Array<Record<string, unknown>>>();

async function getUasgYearContracts(cnpj: string, ano: number, uasg: string): Promise<Array<Record<string, unknown>>> {
  const cacheKey = `${cnpj}:${uasg}:${ano}`;
  if (uasgContractsCache.has(cacheKey)) {
    return uasgContractsCache.get(cacheKey)!;
  }

  const url = `${PNCP_CONSULTA_BASE}/contratos?dataInicial=${ano}0101&dataFinal=${ano}1231&cnpjOrgao=${cnpj}&codigoUnidadeAdministrativa=${uasg}&pagina=1&tamanhoPagina=50`;
  const res = await fetchWithTimeout(url).catch(() => null);
  if (!res || !res.ok || res.status === 204) {
    uasgContractsCache.set(cacheKey, []);
    return [];
  }

  const data = await res.json().catch(() => null);
  const items: Array<Record<string, unknown>> = Array.isArray(data?.data) ? data.data : [];
  uasgContractsCache.set(cacheKey, items);
  return items;
}

async function resolvePncpContract(
  contrato: {
    numero: string;
    processo?: string | null;
    vigencia_inicio?: string | null;
    unidade_codigo?: string | null;
    unidade_origem_codigo?: string | null;
    raw_data?: Record<string, unknown> | null;
  },
  cnpj = IFRN_CNPJ,
) {
  const numeroStr = String(contrato.numero ?? '').trim();
  const numMatch = numeroStr.match(/^0*(\d+)\/(\d{4})$/) || numeroStr.match(/(\d+)\D+(\d{4})/);

  let ano = numMatch ? Number(numMatch[2]) : null;
  if (!ano && contrato.vigencia_inicio) {
    const parsedYear = new Date(contrato.vigencia_inicio).getFullYear();
    if (!Number.isNaN(parsedYear)) ano = parsedYear;
  }
  if (!ano) ano = new Date().getFullYear();

  if (ano < MIN_PNCP_YEAR) return null;

  const targetNumeroNorm = normalizeNumero(contrato.numero);
  const targetProcessoNorm = normalizeProcesso(contrato.processo);

  const uasgsToTry = Array.from(
    new Set([
      contrato.unidade_origem_codigo,
      contrato.unidade_codigo,
      DEFAULT_UASG,
    ].filter((u): u is string => Boolean(u && u.trim()))),
  );

  for (const uasg of uasgsToTry) {
    const list = await getUasgYearContracts(cnpj, ano, uasg);
    if (!list || list.length === 0) continue;

    // 1. Tenta match exato por número do contrato
    const exactNumMatch = list.find((item) => {
      const itemNumNorm = normalizeNumero(item.numeroContratoEmpenho);
      return itemNumNorm && itemNumNorm === targetNumeroNorm;
    });

    if (exactNumMatch && exactNumMatch.sequencialContrato) {
      return {
        cnpj,
        ano: Number(exactNumMatch.anoContrato || ano),
        sequencial: String(exactNumMatch.sequencialContrato),
        numeroControlePNCP: String(exactNumMatch.numeroControlePNCP || ''),
      };
    }

    // 2. Tenta match por número do processo
    if (targetProcessoNorm) {
      const procMatch = list.find((item) => {
        const itemProcNorm = normalizeProcesso(item.numeroProcesso);
        return itemProcNorm && itemProcNorm === targetProcessoNorm;
      });

      if (procMatch && procMatch.sequencialContrato) {
        return {
          cnpj,
          ano: Number(procMatch.anoContrato || ano),
          sequencial: String(procMatch.sequencialContrato),
          numeroControlePNCP: String(procMatch.numeroControlePNCP || ''),
        };
      }
    }
  }

  // Fallback: tenta buscar diretamente pelo sequencial numérico caso número do contrato seja compatível
  const numInt = parseInt(targetNumeroNorm, 10);
  if (!Number.isNaN(numInt) && numInt > 0) {
    const directUrl = `${PNCP_API_BASE}/orgaos/${cnpj}/contratos/${ano}/${numInt}`;
    const directRes = await fetchWithTimeout(directUrl, 10000).catch(() => null);
    if (directRes && directRes.ok && directRes.status !== 204) {
      const directData = await directRes.json().catch(() => null);
      if (directData && directData.sequencialContrato) {
        const directNumNorm = normalizeNumero(directData.numeroContratoEmpenho);
        if (directNumNorm === targetNumeroNorm) {
          return {
            cnpj,
            ano,
            sequencial: String(directData.sequencialContrato),
            numeroControlePNCP: String(directData.numeroControlePNCP || ''),
          };
        }
      }
    }
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Configuração do Supabase ausente' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    let payload: SyncRequest = {};
    if (req.method === 'POST') {
      try {
        payload = await req.json();
      } catch {
        payload = {};
      }
    }

    const uasg = payload.unidadeCodigo || DEFAULT_UASG;
    const limit = Math.min(payload.limit || 50, 100);
    const forceRefresh = payload.forceRefresh ?? false;

    // Busca contratos do campus que precisam de checagem do PNCP
    let query = supabase
      .from('contratos_api')
      .select('id, numero, processo, vigencia_inicio, unidade_codigo, unidade_origem_codigo, raw_data, pncp_sequencial, pncp_ano, pncp_control_number, pncp_has_record, pncp_documentos_checked_at, pncp_instrumentos_checked_at')
      .or(`unidade_codigo.eq.${uasg},unidade_origem_codigo.eq.${uasg}`)
      .order('vigencia_inicio', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (!forceRefresh) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.or(`pncp_documentos_checked_at.is.null,pncp_documentos_checked_at.lt.${sevenDaysAgo}`);
    }

    const { data: contratos, error: dbError } = await query;
    if (dbError) {
      return jsonResponse({ error: 'Erro ao buscar contratos no banco: ' + dbError.message }, 500);
    }

    let contratosProcessados = 0;
    let contratosComPncp = 0;
    let totalDocumentosUpserted = 0;
    let totalInstrumentosUpserted = 0;
    const resultados: Array<Record<string, unknown>> = [];

    for (const c of contratos || []) {
      contratosProcessados++;
      let pncpSeq = c.pncp_sequencial;
      let pncpAno = c.pncp_ano;
      let pncpControl = c.pncp_control_number;
      let hasRecord = c.pncp_has_record;

      if (!pncpSeq || !pncpAno || !pncpControl) {
        const resolved = await resolvePncpContract(c);
        if (resolved) {
          pncpSeq = Number(resolved.sequencial);
          pncpAno = resolved.ano;
          pncpControl = resolved.numeroControlePNCP;
          hasRecord = true;
        } else {
          hasRecord = false;
        }
      }

      let docsCount = 0;
      let instCount = 0;

      if (hasRecord && pncpSeq && pncpAno) {
        contratosComPncp++;

        // 1. Sincronização de Documentos e PDFs
        const filesUrl = `${PNCP_API_BASE}/orgaos/${IFRN_CNPJ}/contratos/${pncpAno}/${pncpSeq}/arquivos`;
        const filesRes = await fetchWithTimeout(filesUrl).catch(() => null);

        if (filesRes && filesRes.ok && filesRes.status !== 204) {
          const files = await filesRes.json().catch(() => []);
          if (Array.isArray(files) && files.length > 0) {
            docsCount = files.length;
            const rowsToUpsert = files.map((f: Record<string, unknown>) => ({
              contrato_api_id: c.id,
              sequencial_documento: Number(f.sequencialDocumento ?? f.sequencial ?? 0),
              titulo: String(f.titulo ?? f.nomeDocumento ?? f.tipoDocumentoNome ?? 'Documento'),
              tipo_documento_id: f.tipoDocumentoId != null ? Number(f.tipoDocumentoId) : null,
              tipo_documento_nome: String(f.tipoDocumentoNome ?? f.tipoDocumento ?? 'Outros Documentos'),
              url: String(f.url ?? f.uri ?? ''),
              uri: f.uri ? String(f.uri) : null,
              data_publicacao_pncp: f.dataPublicacaoPncp ? String(f.dataPublicacaoPncp) : null,
              tamanho: f.tamanho != null ? Number(f.tamanho) : null,
              raw_data: f,
              updated_at: new Date().toISOString(),
            }));

            const { error: upsertError } = await supabase
              .from('contratos_api_documentos')
              .upsert(rowsToUpsert, { onConflict: 'contrato_api_id,sequencial_documento,url' });

            if (!upsertError) {
              totalDocumentosUpserted += rowsToUpsert.length;
            }
          }
        }

        // 2. Sincronização de Instrumentos de Cobrança / NF-e
        const instUrl = `${PNCP_API_BASE}/orgaos/${IFRN_CNPJ}/contratos/${pncpAno}/${pncpSeq}/instrumentocobranca`;
        const instRes = await fetchWithTimeout(instUrl).catch(() => null);

        if (instRes && instRes.ok && instRes.status !== 204) {
          const instData = await instRes.json().catch(() => []);
          if (Array.isArray(instData) && instData.length > 0) {
            instCount = instData.length;
            const instRowsToUpsert = instData.map((raw: Record<string, unknown>) => {
              let notaFiscal: Record<string, unknown> | null = null;
              let itens: Array<Record<string, unknown>> = [];
              let eventos: Array<Record<string, unknown>> = [];
              let valorNota: number | null = null;

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
                        if (!Number.isNaN(valNum)) valorNota = valNum;
                      }
                    }
                    if (Array.isArray(parsed.itensNotaFiscal)) itens = parsed.itensNotaFiscal;
                    if (Array.isArray(parsed.eventosNotaFiscal)) eventos = parsed.eventosNotaFiscal;
                  }
                } catch {
                  // ignore JSON parse fallback
                }
              }

              const tipoObj = raw.tipoInstrumentoCobranca as Record<string, unknown> | undefined;

              return {
                contrato_api_id: c.id,
                sequencial_instrumento_cobranca: Number(raw.sequencialInstrumentoCobranca ?? 0),
                tipo_id: tipoObj?.id != null ? Number(tipoObj.id) : null,
                tipo_nome: String(tipoObj?.nome ?? raw.tipoInstrumentoCobrancaNome ?? 'Nota Fiscal Eletrônica (NF-e)'),
                tipo_descricao: tipoObj?.descricao ? String(tipoObj.descricao) : null,
                numero_instrumento_cobranca: String(raw.numeroInstrumentoCobranca ?? ''),
                data_emissao: raw.dataEmissaoDocumento ? String(raw.dataEmissaoDocumento).slice(0, 10) : null,
                chave_nfe: raw.chaveNFe ? String(raw.chaveNFe) : (notaFiscal?.chaveNotaFiscal ? String(notaFiscal.chaveNotaFiscal) : null),
                data_consulta_nfe: raw.dataConsultaNFe ? String(raw.dataConsultaNFe) : null,
                status_response_nfe: raw.statusResponseNFe ? String(raw.statusResponseNFe) : null,
                valor_nota_fiscal: valorNota,
                serie: notaFiscal?.serie ? String(notaFiscal.serie) : null,
                tipo_evento_mais_recente: notaFiscal?.tipoEventoMaisRecente ? String(notaFiscal.tipoEventoMaisRecente) : null,
                data_tipo_evento_mais_recente: notaFiscal?.dataTipoEventoMaisRecente ? String(notaFiscal.dataTipoEventoMaisRecente) : null,
                nome_fornecedor: notaFiscal?.nomeFornecedor ? String(notaFiscal.nomeFornecedor) : null,
                cnpj_fornecedor: notaFiscal?.cnpjFornecedor ? String(notaFiscal.cnpjFornecedor) : null,
                municipio_fornecedor: notaFiscal?.municipioFornecedor ? String(notaFiscal.municipioFornecedor) : null,
                itens,
                eventos,
                raw_data: raw,
                updated_at: new Date().toISOString(),
              };
            });

            const { error: upsertInstError } = await supabase
              .from('contratos_api_instrumentos_cobranca')
              .upsert(instRowsToUpsert, { onConflict: 'contrato_api_id,sequencial_instrumento_cobranca,numero_instrumento_cobranca' });

            if (!upsertInstError) {
              totalInstrumentosUpserted += instRowsToUpsert.length;
            }
          }
        }
      }

      // Atualiza status do contrato
      await supabase
        .from('contratos_api')
        .update({
          pncp_sequencial: pncpSeq || null,
          pncp_ano: pncpAno || null,
          pncp_control_number: pncpControl || null,
          pncp_has_record: hasRecord,
          pncp_documentos_checked_at: new Date().toISOString(),
          pncp_documentos_count: docsCount,
          pncp_instrumentos_checked_at: new Date().toISOString(),
          pncp_instrumentos_count: instCount,
        })
        .eq('id', c.id);

      resultados.push({
        numero: c.numero,
        pncpControl,
        hasRecord,
        docsCount,
        instCount,
      });
    }

    return jsonResponse({
      status: 'success',
      source: payload.source || 'manual',
      uasg,
      contratosProcessados,
      contratosComPncp,
      totalDocumentosUpserted,
      totalInstrumentosUpserted,
      resultados,
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
