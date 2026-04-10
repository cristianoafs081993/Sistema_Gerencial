import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

type JsonRecord = Record<string, unknown>;

interface IngestRequestBody {
  dataInicial?: string;
  dataFinal?: string;
  pageSize?: number;
  maxPages?: number;
  limit?: number;
  cnpjOrgao?: string;
  dryRun?: boolean;
  trigger?: string;
}

interface NormalizedItem {
  numero_item: string;
  descricao: string;
  tipo_item: 'material' | 'servico' | 'nao_classificado';
  unidade_fornecimento: string | null;
  quantidade: number | null;
  codigo_catmat_catser: string | null;
  valor_unitario: number | null;
  valor_total: number | null;
  quantidade_homologada_fornecedor: number | null;
  maximo_adesao: number | null;
  fornecedor_documento: string | null;
  fornecedor_nome: string | null;
  codigo_pdm: string | null;
  nome_pdm: string | null;
  metadata: JsonRecord;
}

interface NormalizedAtaRecord {
  ata: {
    identificador_fonte: string;
    numero_ata: string;
    ano_ata: number | null;
    objeto: string;
    orgao_gerenciador: string | null;
    vigencia_inicio: string | null;
    vigencia_fim: string | null;
    status_vigencia: 'vigente' | 'a_vencer' | 'encerrada' | 'desconhecida';
    fonte: string;
    raw_payload: JsonRecord;
  };
  items: NormalizedItem[];
  item_sync_mode: 'replace' | 'preserve';
}

const PNCP_BASE_URL = (Deno.env.get('ATAS_PNCP_BASE_URL') || 'https://pncp.gov.br/api/consulta').replace(/\/$/, '');
const COMPRAS_BASE_URL = (Deno.env.get('ATAS_COMPRAS_BASE_URL') || 'https://dadosabertos.compras.gov.br').replace(/\/$/, '');
const PNCP_EXCLUDED_MODALIDADE_IDS = new Set([8, 9]);
const PNCP_EXCLUDED_TERMS = ['dispensa', 'inexigibilidade', 'inaplicabilidade'];
const PNCP_HTTP_TIMEOUT_MS = Number(Deno.env.get('ATAS_PNCP_TIMEOUT_MS') || '45000');
const PNCP_HTTP_MAX_RETRIES = Math.max(Number(Deno.env.get('ATAS_PNCP_MAX_RETRIES') || '3'), 1);
const PNCP_ENRICH_CONCURRENCY = Math.max(Number(Deno.env.get('ATAS_PNCP_ENRICH_CONCURRENCY') || '4'), 1);
const COMPRAS_HTTP_TIMEOUT_MS = Number(Deno.env.get('ATAS_COMPRAS_TIMEOUT_MS') || '45000');
const COMPRAS_HTTP_MAX_RETRIES = Math.max(Number(Deno.env.get('ATAS_COMPRAS_MAX_RETRIES') || '3'), 1);
const COMPRAS_ARP_ITEM_PAGE_SIZE = Math.min(Math.max(Number(Deno.env.get('ATAS_COMPRAS_ARP_TAMANHO_PAGINA') || '100'), 10), 500);
const COMPRAS_ARP_ITEM_MAX_PAGES = Math.max(Number(Deno.env.get('ATAS_COMPRAS_ARP_MAX_PAGINAS') || '10'), 1);

const normalizeText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const parseDateValue = (value: unknown) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const stringValue = String(value).trim();
  if (!stringValue) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(stringValue)) return stringValue.slice(0, 10);

  const brMatch = stringValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;

  const parsed = new Date(stringValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const parseNumberValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const normalized = String(value)
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const inferStatusVigencia = (vigenciaFim: string | null) => {
  if (!vigenciaFim) return 'desconhecida' as const;

  const today = new Date();
  const endDate = new Date(`${vigenciaFim}T00:00:00`);
  if (Number.isNaN(endDate.getTime())) return 'desconhecida' as const;

  const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 'encerrada' as const;
  if (diffDays <= 30) return 'a_vencer' as const;
  return 'vigente' as const;
};

const inferTipoItem = (rawItem: JsonRecord, description: string) => {
  const directType = rawItem.tipo_item || rawItem.tipoItem || rawItem.tipo || rawItem.natureza || rawItem.categoria;
  const normalizedDirect = normalizeText(directType);
  if (normalizedDirect.includes('servico')) return 'servico' as const;
  if (normalizedDirect.includes('material')) return 'material' as const;

  const normalizedDescription = normalizeText(description);
  const serviceHints = ['servico', 'manutencao', 'instalacao', 'locacao', 'assinatura', 'consultoria', 'suporte', 'capacitacao'];
  return serviceHints.some((hint) => normalizedDescription.includes(hint)) ? ('servico' as const) : ('material' as const);
};

const getFirstValue = (source: JsonRecord | null | undefined, candidates: string[], fallback: unknown = null) => {
  for (const candidate of candidates) {
    const value = source?.[candidate];
    if (value !== undefined && value !== null && value !== '') return value;
  }

  return fallback;
};

const extractNestedText = (value: unknown) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  const record = value as JsonRecord;
  return String(record.nome || record.descricao || record.razao_social || record.razaoSocial || record.orgao || '').trim() || null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const formatPncpDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const normalizePncpDateValue = (value: unknown) => {
  if (!value) return null;
  const normalized = String(value).trim().replace(/[^\d]/g, '');
  if (normalized.length === 8) return normalized;
  const parsed = parseDateValue(value);
  return parsed ? parsed.replace(/-/g, '') : null;
};

const resolvePncpDateRange = (body: IngestRequestBody) => {
  const lookbackDays = Math.max(Number(Deno.env.get('ATAS_SCHEDULE_LOOKBACK_DAYS') || '2'), 1);
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(defaultStart.getDate() - lookbackDays);

  const dataInicial = normalizePncpDateValue(body.dataInicial || Deno.env.get('ATAS_PNCP_DATA_INICIAL')) || formatPncpDate(defaultStart);
  const dataFinal = normalizePncpDateValue(body.dataFinal || Deno.env.get('ATAS_PNCP_DATA_FINAL')) || formatPncpDate(today);
  return { dataInicial, dataFinal };
};

const buildPncpUrl = (pathname: string, params: Record<string, unknown>) => {
  const url = new URL(`${PNCP_BASE_URL}${pathname}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
};

const buildComprasUrl = (pathname: string, params: Record<string, unknown>) => {
  const url = new URL(`${COMPRAS_BASE_URL}${pathname}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
};

const fetchJsonWithRetries = async (url: string, acceptHeader: string, timeoutMs: number, maxRetries: number) => {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: acceptHeader },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const body = await response.text();
        const retriable = [408, 429, 500, 502, 503, 504].includes(response.status);

        if (retriable && attempt < maxRetries) {
          await sleep(750 * attempt);
          continue;
        }

        throw new Error(`Falha HTTP (${response.status} ${response.statusText}) em ${url}. Resposta: ${body.slice(0, 400)}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await sleep(750 * attempt);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Falha desconhecida ao consultar ${url}.`);
};

const fetchPncpJson = async (url: string) => fetchJsonWithRetries(url, 'application/json', PNCP_HTTP_TIMEOUT_MS, PNCP_HTTP_MAX_RETRIES);
const fetchComprasJson = async (url: string) => fetchJsonWithRetries(url, '*/*', COMPRAS_HTTP_TIMEOUT_MS, COMPRAS_HTTP_MAX_RETRIES);

const parsePncpControlNumber = (numeroControlePncpCompra: unknown) => {
  const match = String(numeroControlePncpCompra || '').match(/^(\d{14})-1-(\d+)\/(\d{4})$/);
  if (!match) return null;
  return { cnpj: match[1], sequencial: Number(match[2]), ano: Number(match[3]) };
};

const normalizeNumericCodeString = (value: unknown) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return null;
  const numeric = Number(digits);
  return Number.isFinite(numeric) ? String(numeric) : digits;
};

const normalizeModalidadeCode = (value: unknown) => {
  const numeric = normalizeNumericCodeString(value);
  if (!numeric) return null;
  return numeric.padStart(2, '0');
};

const parseComprasGovCompraId = (value: unknown) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length !== 17) return null;
  return {
    codigoUnidadeGerenciadora: digits.slice(0, 6),
    codigoModalidadeCompra: digits.slice(6, 8),
    numeroCompra: digits.slice(8, 13),
    anoCompra: digits.slice(13, 17),
  };
};

const extractCompraReferenceFromLink = (link: unknown) => {
  if (!link) return null;
  try {
    const parsed = new URL(String(link));
    return parseComprasGovCompraId(parsed.searchParams.get('compra'));
  } catch {
    return null;
  }
};

const inferArpModalidadeCode = (compra: JsonRecord) => {
  const fromLink = extractCompraReferenceFromLink(compra.linkSistemaOrigem);
  if (fromLink?.codigoModalidadeCompra) return fromLink.codigoModalidadeCompra;

  const modalidadeNome = normalizeText(compra.modalidadeNome);
  if (modalidadeNome.includes('pregao')) return '05';

  return normalizeModalidadeCode(compra.modalidadeId);
};

const buildArpItemQueryParams = (rawAta: JsonRecord, compra: JsonRecord) => {
  const compraReference = extractCompraReferenceFromLink(compra.linkSistemaOrigem) || parseComprasGovCompraId(compra.idCompra) || null;
  const unidadeOrgao = (compra.unidadeOrgao as JsonRecord | undefined) || {};
  const codigoUnidadeGerenciadora =
    compraReference?.codigoUnidadeGerenciadora ||
    normalizeNumericCodeString(rawAta.codigoUnidadeOrgao || unidadeOrgao.codigoUnidade);
  const numeroCompra = String(compraReference?.numeroCompra || compra.numeroCompra || '').trim();
  const codigoModalidadeCompra = compraReference?.codigoModalidadeCompra || inferArpModalidadeCode(compra);
  const dataVigenciaInicial = parseDateValue(rawAta.vigenciaInicio || rawAta.vigencia_inicio);
  const dataAssinatura = parseDateValue(rawAta.dataAssinatura || rawAta.data_assinatura);

  if (!codigoUnidadeGerenciadora || !numeroCompra || !codigoModalidadeCompra || !dataVigenciaInicial) {
    return null;
  }

  return {
    codigoUnidadeGerenciadora,
    codigoModalidadeCompra,
    numeroCompra,
    dataVigenciaInicialMin: dataVigenciaInicial,
    dataVigenciaInicialMax: dataVigenciaInicial,
    dataAssinaturaInicial: dataAssinatura,
    dataAssinaturaFinal: dataAssinatura,
  };
};

const filterArpItemsForAta = (rawAta: JsonRecord, items: JsonRecord[]) => {
  const ataControlNumber = String(rawAta.numeroControlePNCPAta || '');
  const compraControlNumber = String(rawAta.numeroControlePNCPCompra || '');
  const numeroAta = normalizeText(rawAta.numeroAtaRegistroPreco || rawAta.numeroAta || '');

  const byAtaControlNumber = items.filter((item) => String(item.numeroControlePncpAta || '') === ataControlNumber);
  if (byAtaControlNumber.length > 0) return byAtaControlNumber;

  return items.filter(
    (item) =>
      String(item.numeroControlePncpCompra || '') === compraControlNumber &&
      normalizeText(item.numeroAtaRegistroPreco || '') === numeroAta
  );
};

const isPncpFederalCompra = (compra: JsonRecord) => {
  const orgaoEntidade = (compra.orgaoEntidade as JsonRecord | undefined) || {};
  return normalizeText(orgaoEntidade.esferaId) === 'f';
};

const isPncpExcludedCompra = (compra: JsonRecord) => {
  const modalidadeId = Number(compra.modalidadeId);
  if (PNCP_EXCLUDED_MODALIDADE_IDS.has(modalidadeId)) return true;

  const amparoLegal = (compra.amparoLegal as JsonRecord | undefined) || {};
  const searchableText = normalizeText(
    [compra.modalidadeNome, amparoLegal.nome, amparoLegal.descricao, compra.tipoInstrumentoConvocatorioNome]
      .filter(Boolean)
      .join(' ')
  );

  return PNCP_EXCLUDED_TERMS.some((term) => searchableText.includes(term));
};

const fetchArpItemsForAta = async (
  rawAta: JsonRecord,
  compra: JsonRecord,
  cache: Map<string, Promise<{ items: JsonRecord[]; warning: string | null }>>
) => {
  const cacheKey = String(rawAta.numeroControlePNCPAta || rawAta.numeroControlePNCPCompra || '');
  if (!cacheKey) {
    return { items: [], warning: 'Ata sem chave suficiente para consulta de itens da ARP.' };
  }

  if (!cache.has(cacheKey)) {
    cache.set(
      cacheKey,
      (async () => {
        try {
          const queryParams = buildArpItemQueryParams(rawAta, compra);
          if (!queryParams) {
            return { items: [], warning: 'Metadados insuficientes para consultar itens da ARP no Compras.gov.br.' };
          }

          const collectedItems: JsonRecord[] = [];
          let page = 1;
          let totalPages = 1;

          while (page <= totalPages && page <= COMPRAS_ARP_ITEM_MAX_PAGES) {
            const url = buildComprasUrl('/modulo-arp/2_consultarARPItem', {
              pagina: page,
              tamanhoPagina: COMPRAS_ARP_ITEM_PAGE_SIZE,
              ...queryParams,
            });

            const payload = await fetchComprasJson(url);
            const pageItems = Array.isArray(payload?.resultado) ? (payload.resultado as JsonRecord[]) : [];
            totalPages = Number(payload?.totalPaginas || 1);
            collectedItems.push(...pageItems);
            page += 1;
          }

          return {
            items: filterArpItemsForAta(rawAta, collectedItems),
            warning: null,
          };
        } catch (error) {
          return {
            items: [],
            warning: error instanceof Error ? error.message : 'Falha desconhecida ao consultar itens da ARP.',
          };
        }
      })()
    );
  }

  return await cache.get(cacheKey)!;
};

const enrichAtaWithPncpCompra = async (
  rawAta: JsonRecord,
  cache: Map<string, Promise<{ include: boolean; reason: string | null; compra: JsonRecord | null }>>
) => {
  const key = String(rawAta.numeroControlePNCPCompra || '');
  if (!key) {
    return { include: false, reason: 'Ata sem numeroControlePNCPCompra para cruzamento com a contratacao.', compra: null };
  }

  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        const parsed = parsePncpControlNumber(key);
        if (!parsed) {
          return { include: false, reason: 'Numero de controle PNCP da compra em formato inesperado.', compra: null };
        }

        const url = buildPncpUrl(`/v1/orgaos/${parsed.cnpj}/compras/${parsed.ano}/${parsed.sequencial}`, {});

        try {
          const compra = (await fetchPncpJson(url)) as JsonRecord;
          if (!isPncpFederalCompra(compra)) {
            return { include: false, reason: 'Compra descartada por nao pertencer a esfera federal.', compra };
          }

          if (isPncpExcludedCompra(compra)) {
            return { include: false, reason: 'Compra descartada por modalidade/amparo legal excluido.', compra };
          }

          return { include: true, reason: null, compra };
        } catch (error) {
          return {
            include: false,
            reason: error instanceof Error ? error.message : 'Falha desconhecida ao consultar compra vinculada no PNCP.',
            compra: null,
          };
        }
      })()
    );
  }

  return await cache.get(key)!;
};

const enrichPncpAtasPage = async (
  pageItems: JsonRecord[],
  compraCache: Map<string, Promise<{ include: boolean; reason: string | null; compra: JsonRecord | null }>>,
  arpItemCache: Map<string, Promise<{ items: JsonRecord[]; warning: string | null }>>
) => {
  const results: Array<{
    rawAta: JsonRecord;
    enriched: { include: boolean; reason: string | null; compra: JsonRecord | null };
    itemResolution: { items: JsonRecord[]; warning: string | null };
  }> = [];

  for (let index = 0; index < pageItems.length; index += PNCP_ENRICH_CONCURRENCY) {
    const chunk = pageItems.slice(index, index + PNCP_ENRICH_CONCURRENCY);
    const enrichedChunk = await Promise.all(
      chunk.map(async (rawAta) => {
        const enriched = await enrichAtaWithPncpCompra(rawAta, compraCache);
        const itemResolution =
          enriched.include && enriched.compra
            ? await fetchArpItemsForAta(rawAta, enriched.compra, arpItemCache)
            : { items: [], warning: null };

        return { rawAta, enriched, itemResolution };
      })
    );

    results.push(...enrichedChunk);
  }

  return results;
};

const loadPncpPayload = async (body: IngestRequestBody) => {
  const { dataInicial, dataFinal } = resolvePncpDateRange(body);
  const pageSize = Number(body.pageSize || Deno.env.get('ATAS_SCHEDULE_PAGE_SIZE') || Deno.env.get('ATAS_PNCP_TAMANHO_PAGINA') || '100');
  const sanitizedPageSize = Math.min(Math.max(pageSize, 10), 500);
  const maxPages = Number(body.maxPages || Deno.env.get('ATAS_SCHEDULE_MAX_PAGES') || Deno.env.get('ATAS_PNCP_MAX_PAGINAS') || '5');
  const limit = Number(body.limit || Deno.env.get('ATAS_SCHEDULE_LIMIT') || '0') || null;
  const pncpCnpj = String(body.cnpjOrgao || Deno.env.get('ATAS_SCHEDULE_CNPJ_ORGAO') || Deno.env.get('ATAS_PNCP_CNPJ_ORGAO') || '').replace(/\D/g, '') || null;

  const compraCache = new Map<string, Promise<{ include: boolean; reason: string | null; compra: JsonRecord | null }>>();
  const arpItemCache = new Map<string, Promise<{ items: JsonRecord[]; warning: string | null }>>();
  const filteredReasons: JsonRecord[] = [];
  const itemWarnings: JsonRecord[] = [];
  const atas: JsonRecord[] = [];
  let atasWithItems = 0;
  let atasWithoutItems = 0;
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= maxPages) {
    const url = buildPncpUrl('/v1/atas', {
      dataInicial,
      dataFinal,
      pagina: page,
      tamanhoPagina: sanitizedPageSize,
      cnpj: pncpCnpj,
    });

    const payload = await fetchPncpJson(url);
    const pageItems = Array.isArray(payload?.data) ? (payload.data as JsonRecord[]) : [];
    totalPages = Number(payload?.totalPaginas || 1);
    const enrichedItems = await enrichPncpAtasPage(pageItems, compraCache, arpItemCache);

    for (const { rawAta, enriched, itemResolution } of enrichedItems) {
      if (!enriched.include) {
        filteredReasons.push({
          numeroControlePNCPAta: rawAta.numeroControlePNCPAta || null,
          numeroControlePNCPCompra: rawAta.numeroControlePNCPCompra || null,
          reason: enriched.reason || 'Ata filtrada por regra de negocio.',
        });
        continue;
      }

      const arpItems = Array.isArray(itemResolution.items) ? itemResolution.items : [];
      if (itemResolution.warning) {
        itemWarnings.push({
          numeroControlePNCPAta: rawAta.numeroControlePNCPAta || null,
          warning: itemResolution.warning,
        });
      }

      if (arpItems.length > 0) atasWithItems += 1;
      else atasWithoutItems += 1;

      atas.push({
        ...rawAta,
        itens: arpItems,
        __pncpCompra: enriched.compra,
      });

      if (limit && atas.length >= limit) break;
    }

    if (limit && atas.length >= limit) break;
    page += 1;
  }

  return {
    data: atas,
    meta: {
      source: 'pncp',
      dataInicial,
      dataFinal,
      pageSize: sanitizedPageSize,
      requestedMaxPages: maxPages,
      processedPages: Math.min(page - 1, totalPages),
      filteredOut: filteredReasons.length,
      filteredReasons,
      atasWithItems,
      atasWithoutItems,
      itemWarnings,
      itemIngestion: {
        strategy: 'compras_gov_modulo_arp',
        publicItemEndpointConfirmed: true,
        source: `${COMPRAS_BASE_URL}/modulo-arp/2_consultarARPItem`,
      },
    },
    sourceReference: `${PNCP_BASE_URL}/v1/atas?dataInicial=${dataInicial}&dataFinal=${dataFinal}${pncpCnpj ? `&cnpj=${pncpCnpj}` : ''}`,
  };
};

const extractAtasArray = (payload: JsonRecord) => {
  if (Array.isArray(payload)) return payload as JsonRecord[];
  if (Array.isArray(payload.atas)) return payload.atas as JsonRecord[];
  if (Array.isArray(payload.data)) return payload.data as JsonRecord[];
  if (Array.isArray(payload.items)) return payload.items as JsonRecord[];
  if (Array.isArray(payload.results)) return payload.results as JsonRecord[];
  throw new Error('Payload sem lista de atas reconhecivel.');
};

const normalizeAtaRecord = (rawAta: JsonRecord, sourceReference: string): NormalizedAtaRecord => {
  const numeroAta = String(getFirstValue(rawAta, ['numero_ata', 'numeroAta', 'numeroAtaRegistroPreco', 'numero', 'ata', 'codigo'], '')).trim();
  const objeto = String(getFirstValue(rawAta, ['objeto', 'descricao', 'objetoContratacao', 'objetoCompra', 'titulo'], '')).trim();
  if (!numeroAta || !objeto) {
    throw new Error('Ata sem numero ou objeto suficiente para importacao.');
  }

  const anoAtaRaw = getFirstValue(rawAta, ['ano_ata', 'anoAta', 'ano'], null);
  const anoAta = anoAtaRaw !== null && anoAtaRaw !== undefined ? Number(anoAtaRaw) : null;
  const pncpCompra = (rawAta.__pncpCompra as JsonRecord | undefined) || null;
  const orgaoEntidade = (pncpCompra?.orgaoEntidade as JsonRecord | undefined) || {};
  const orgao = extractNestedText(
    getFirstValue(rawAta, ['orgao_gerenciador', 'orgaoGerenciador', 'nomeOrgao', 'orgao', 'unidade'], orgaoEntidade.razaoSocial || null)
  );
  const vigenciaInicio = parseDateValue(getFirstValue(rawAta, ['vigencia_inicio', 'vigenciaInicio', 'data_inicio_vigencia', 'dataInicioVigencia'], null));
  const vigenciaFim = parseDateValue(getFirstValue(rawAta, ['vigencia_fim', 'vigenciaFim', 'data_fim_vigencia', 'dataFimVigencia'], null));
  const fonte = String(getFirstValue(rawAta, ['fonte'], pncpCompra ? 'PNCP' : 'fonte_manual')).trim();

  const identifierSource =
    getFirstValue(rawAta, ['identificador_fonte', 'identificadorFonte', 'numeroControlePNCPAta', 'id', 'uuid', 'codigoAta'], null) ||
    `${fonte}:${numeroAta}:${anoAta ?? 'sem-ano'}:${normalizeText(orgao || sourceReference || 'sem-orgao')}`;

  const rawItemsValue = getFirstValue(rawAta, ['itens', 'items', 'listaItens'], undefined);
  const hasStructuredItemsPayload = rawItemsValue !== undefined && rawItemsValue !== null;
  const items = Array.isArray(rawItemsValue) ? (rawItemsValue as JsonRecord[]) : [];

  const normalizedItems = items
    .map((rawItem, index) => {
      const descricao = String(getFirstValue(rawItem, ['descricao', 'descricao_item', 'descricaoItem', 'objeto', 'nome'], '')).trim();
      if (!descricao) return null;

      return {
        numero_item: String(getFirstValue(rawItem, ['numero_item', 'numeroItem', 'item', 'sequencial'], index + 1)),
        descricao,
        tipo_item: inferTipoItem(rawItem, descricao),
        unidade_fornecimento: (getFirstValue(rawItem, ['unidade_fornecimento', 'unidadeFornecimento', 'unidade', 'sigla_unidade'], null) as string | null),
        quantidade: parseNumberValue(getFirstValue(rawItem, ['quantidade', 'qtd', 'quantidade_registrada', 'quantidadeHomologadaItem'], null)),
        codigo_catmat_catser:
          String(getFirstValue(rawItem, ['codigo_catmat_catser', 'codigoCatmatCatser', 'catmat', 'catser', 'codigoCatalogo', 'codigoItem'], '') || '').trim() ||
          null,
        valor_unitario: parseNumberValue(getFirstValue(rawItem, ['valor_unitario', 'valorUnitario', 'valorUnitarioResultado'], null)),
        valor_total: parseNumberValue(getFirstValue(rawItem, ['valor_total', 'valorTotal', 'valorTotalResultado'], null)),
        quantidade_homologada_fornecedor: parseNumberValue(getFirstValue(rawItem, ['quantidade_homologada_fornecedor', 'quantidadeHomologadaVencedor'], null)),
        maximo_adesao: parseNumberValue(getFirstValue(rawItem, ['maximo_adesao', 'maximoAdesao'], null)),
        fornecedor_documento: String(getFirstValue(rawItem, ['fornecedor_documento', 'niFornecedor', 'codFornecedor'], '') || '').trim() || null,
        fornecedor_nome: String(getFirstValue(rawItem, ['fornecedor_nome', 'nomeRazaoSocialFornecedor', 'nomeFornecedor'], '') || '').trim() || null,
        codigo_pdm: String(getFirstValue(rawItem, ['codigo_pdm', 'codigoPdm'], '') || '').trim() || null,
        nome_pdm: String(getFirstValue(rawItem, ['nome_pdm', 'nomePdm'], '') || '').trim() || null,
        metadata: rawItem,
      };
    })
    .filter(Boolean) as NormalizedItem[];

  return {
    ata: {
      identificador_fonte: String(identifierSource),
      numero_ata: numeroAta,
      ano_ata: Number.isFinite(anoAta) ? anoAta : null,
      objeto,
      orgao_gerenciador: orgao,
      vigencia_inicio: vigenciaInicio,
      vigencia_fim: vigenciaFim,
      status_vigencia: inferStatusVigencia(vigenciaFim),
      fonte,
      raw_payload: {
        ...rawAta,
        cnpjOrgao: String(rawAta.cnpjOrgao || orgaoEntidade.cnpj || '').replace(/\D/g, '') || null,
        nomeOrgao: String(rawAta.nomeOrgao || orgaoEntidade.razaoSocial || orgao || '').trim() || null,
        pncpCompra,
      },
    },
    items: normalizedItems,
    item_sync_mode: hasStructuredItemsPayload ? 'replace' : 'preserve',
  };
};

const normalizePayload = (payload: JsonRecord, sourceReference: string, limit: number | null) => {
  const rawAtas = extractAtasArray(payload);
  const sliced = limit && Number.isFinite(limit) ? rawAtas.slice(0, limit) : rawAtas;
  const errors: JsonRecord[] = [];
  const records: NormalizedAtaRecord[] = [];

  sliced.forEach((rawAta, index) => {
    try {
      records.push(normalizeAtaRecord(rawAta, sourceReference));
    } catch (error) {
      errors.push({
        index,
        message: error instanceof Error ? error.message : 'Erro desconhecido ao normalizar ata.',
      });
    }
  });

  return { records, errors };
};

const createExecutionRecord = async (supabase: ReturnType<typeof createClient>, executionInput: JsonRecord) => {
  const { data, error } = await supabase.from('atas_ingestao_execucoes').insert(executionInput).select('id').single();
  if (error) throw error;
  return data.id as string;
};

const finishExecutionRecord = async (supabase: ReturnType<typeof createClient>, id: string, update: JsonRecord) => {
  const { error } = await supabase
    .from('atas_ingestao_execucoes')
    .update({
      ...update,
      finished_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
};

const upsertAtas = async (supabase: ReturnType<typeof createClient>, records: NormalizedAtaRecord[]) => {
  const atasPayload = records.map((entry) => entry.ata);
  const { data, error } = await supabase
    .from('atas')
    .upsert(atasPayload, { onConflict: 'identificador_fonte' })
    .select('id, identificador_fonte');

  if (error) throw error;
  return new Map((data || []).map((row) => [row.identificador_fonte as string, row.id as string]));
};

const replaceItens = async (supabase: ReturnType<typeof createClient>, records: NormalizedAtaRecord[], idByIdentifier: Map<string, string>) => {
  const recordsWithReplaceMode = records.filter((entry) => entry.item_sync_mode === 'replace');
  const ataIds = recordsWithReplaceMode.map((entry) => idByIdentifier.get(entry.ata.identificador_fonte)).filter(Boolean) as string[];

  if (ataIds.length > 0) {
    const { error: deleteError } = await supabase.from('itens_ata').delete().in('ata_id', ataIds);
    if (deleteError) throw deleteError;
  }

  const itemsPayload = recordsWithReplaceMode.flatMap((entry) => {
    const ataId = idByIdentifier.get(entry.ata.identificador_fonte);
    if (!ataId) return [];

    return entry.items.map((item) => ({
      ata_id: ataId,
      numero_item: item.numero_item,
      descricao: item.descricao,
      tipo_item: item.tipo_item,
      unidade_fornecimento: item.unidade_fornecimento,
      quantidade: item.quantidade,
      codigo_catmat_catser: item.codigo_catmat_catser,
      valor_unitario: item.valor_unitario,
      valor_total: item.valor_total,
      quantidade_homologada_fornecedor: item.quantidade_homologada_fornecedor,
      maximo_adesao: item.maximo_adesao,
      fornecedor_documento: item.fornecedor_documento,
      fornecedor_nome: item.fornecedor_nome,
      codigo_pdm: item.codigo_pdm,
      nome_pdm: item.nome_pdm,
      metadata: item.metadata,
    }));
  });

  if (itemsPayload.length === 0) {
    return {
      insertedItems: 0,
      preservedAtas: records.filter((entry) => entry.item_sync_mode !== 'replace').length,
      replacedAtas: recordsWithReplaceMode.length,
    };
  }

  const { error: insertError } = await supabase.from('itens_ata').insert(itemsPayload);
  if (insertError) throw insertError;

  return {
    insertedItems: itemsPayload.length,
    preservedAtas: records.filter((entry) => entry.item_sync_mode !== 'replace').length,
    replacedAtas: recordsWithReplaceMode.length,
  };
};

const runIngestion = async (body: IngestRequestBody) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao configurados na Edge Function.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const dryRun = Boolean(body.dryRun);
  const payload = await loadPncpPayload(body);
  const limit = Number(body.limit || Deno.env.get('ATAS_SCHEDULE_LIMIT') || '0') || null;
  let executionId: string | null = null;

  try {
    executionId = await createExecutionRecord(supabase, {
      origem_tipo: 'pncp_cron',
      origem_referencia: payload.sourceReference,
      status: 'iniciada',
      mensagem: 'Carga automatica iniciada pela Edge Function.',
      dry_run: dryRun,
      detalhes: {
        trigger: body.trigger || 'manual_edge_function',
        params: body,
      },
    });
  } catch (error) {
    const isMissingAuditTable = typeof error === 'object' && error !== null && 'code' in error && error.code === 'PGRST205';
    if (!isMissingAuditTable) throw error;
  }

  try {
    const { records, errors } = normalizePayload({ data: payload.data }, payload.sourceReference, limit);
    const totalItens = records.reduce((sum, entry) => sum + entry.items.length, 0);
    const itemSyncSummary = {
      replace: records.filter((entry) => entry.item_sync_mode === 'replace').length,
      preserve: records.filter((entry) => entry.item_sync_mode !== 'replace').length,
    };

    if (dryRun) {
      if (executionId) {
        await finishExecutionRecord(supabase, executionId, {
          status: 'concluida',
          mensagem: 'Dry run automatico concluido sem persistencia.',
          total_atas: records.length,
          total_itens: totalItens,
          total_erros: errors.length,
          detalhes: {
            dryRun: true,
            itemSyncSummary,
            errors,
            meta: payload.meta,
          },
        });
      }

      return {
        executionId,
        dryRun: true,
        totalAtas: records.length,
        totalItens,
        totalErros: errors.length,
        itemSyncSummary,
        meta: payload.meta,
      };
    }

    const idByIdentifier = await upsertAtas(supabase, records);
    const itemWriteSummary = await replaceItens(supabase, records, idByIdentifier);

    if (executionId) {
      await finishExecutionRecord(supabase, executionId, {
        status: 'concluida',
        mensagem: 'Carga automatica concluida com sucesso.',
        total_atas: records.length,
        total_itens: itemWriteSummary.insertedItems,
        total_erros: errors.length,
        detalhes: {
          errors,
          itemSyncSummary,
          itemWriteSummary,
          meta: payload.meta,
        },
      });
    }

    return {
      executionId,
      dryRun: false,
      totalAtas: records.length,
      totalItens: itemWriteSummary.insertedItems,
      totalErros: errors.length,
      itemSyncSummary,
      itemWriteSummary,
      meta: payload.meta,
    };
  } catch (error) {
    if (executionId) {
      await finishExecutionRecord(supabase, executionId, {
        status: 'falha',
        mensagem: error instanceof Error ? error.message : 'Falha desconhecida na carga automatica.',
        total_erros: 1,
        detalhes: {
          stack: error instanceof Error ? error.stack : null,
        },
      });
    }

    throw error;
  }
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo nao suportado.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const cronSecret = Deno.env.get('ATAS_CRON_SECRET');
  const receivedSecret = request.headers.get('x-cron-secret');
  if (cronSecret && receivedSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Chave de cron invalida.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as IngestRequestBody;
    const result = await runIngestion(body);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro inesperado na ingestao automatica de atas.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
