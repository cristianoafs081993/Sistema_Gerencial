import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadProjectEnv } from './env.mjs';

loadProjectEnv();

const normalizeText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const parseDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const stringValue = String(value).trim();
  if (!stringValue) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(stringValue)) {
    return stringValue.slice(0, 10);
  }

  const brMatch = stringValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }

  const parsed = new Date(stringValue);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString().slice(0, 10);
};

const parseNumberValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const normalized = String(value)
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const inferStatusVigencia = (vigenciaFim) => {
  if (!vigenciaFim) return 'desconhecida';

  const today = new Date();
  const endDate = new Date(`${vigenciaFim}T00:00:00`);
  if (Number.isNaN(endDate.getTime())) return 'desconhecida';

  const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 'encerrada';
  if (diffDays <= 30) return 'a_vencer';
  return 'vigente';
};

const inferTipoItem = (rawItem, description) => {
  const directType =
    rawItem?.tipo_item ||
    rawItem?.tipoItem ||
    rawItem?.tipo ||
    rawItem?.natureza ||
    rawItem?.categoria;

  const normalizedDirect = normalizeText(directType);
  if (normalizedDirect.includes('servico')) return 'servico';
  if (normalizedDirect.includes('material')) return 'material';

  const normalizedDescription = normalizeText(description);
  const serviceHints = [
    'servico',
    'manutencao',
    'instalacao',
    'locacao',
    'assinatura',
    'consultoria',
    'suporte',
    'capacitação',
    'capacitacao',
  ];

  return serviceHints.some((hint) => normalizedDescription.includes(normalizeText(hint)))
    ? 'servico'
    : 'material';
};

const getFirstValue = (source, candidates, fallback = null) => {
  for (const candidate of candidates) {
    if (source?.[candidate] !== undefined && source?.[candidate] !== null && source?.[candidate] !== '') {
      return source[candidate];
    }
  }

  return fallback;
};

const extractNestedText = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;

  return (
    value.nome ||
    value.descricao ||
    value.razao_social ||
    value.razaoSocial ||
    value.orgao ||
    null
  );
};

export const createSupabaseAdminClient = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials. Configure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY.');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

export const hasSupabaseCredentials = () =>
  Boolean((process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY));

export const parseArgs = (argv) => {
  const options = {
    file: null,
    url: null,
    dryRun: false,
    stdin: false,
    limit: null,
    sourceType: process.env.ATAS_INGEST_SOURCE_TYPE || null,
    dataInicial: null,
    dataFinal: null,
    pageSize: null,
    maxPages: null,
    pncpCnpj: null,
  };

  for (const argument of argv) {
    if (argument === '--dry-run') options.dryRun = true;
    else if (argument === '--stdin') options.stdin = true;
    else if (argument.startsWith('--file=')) options.file = argument.slice('--file='.length);
    else if (argument.startsWith('--url=')) options.url = argument.slice('--url='.length);
    else if (argument.startsWith('--limit=')) options.limit = Number(argument.slice('--limit='.length));
    else if (argument.startsWith('--source=')) options.sourceType = argument.slice('--source='.length);
    else if (argument.startsWith('--data-inicial=')) options.dataInicial = argument.slice('--data-inicial='.length);
    else if (argument.startsWith('--data-final=')) options.dataFinal = argument.slice('--data-final='.length);
    else if (argument.startsWith('--page-size=')) options.pageSize = Number(argument.slice('--page-size='.length));
    else if (argument.startsWith('--max-pages=')) options.maxPages = Number(argument.slice('--max-pages='.length));
    else if (argument.startsWith('--cnpj-orgao=')) options.pncpCnpj = argument.slice('--cnpj-orgao='.length);
  }

  return options;
};

export const readJsonFromStdin = async () => {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    throw new Error('STDIN vazio. Envie um JSON valido quando usar --stdin.');
  }

  return JSON.parse(raw);
};

const PNCP_BASE_URL = (process.env.ATAS_PNCP_BASE_URL || 'https://pncp.gov.br/api/consulta').replace(/\/$/, '');
const PNCP_EXCLUDED_MODALIDADE_IDS = new Set([8, 9]);
const PNCP_EXCLUDED_TERMS = ['dispensa', 'inexigibilidade', 'inaplicabilidade'];
const PNCP_HTTP_TIMEOUT_MS = Number(process.env.ATAS_PNCP_TIMEOUT_MS) || 45000;
const PNCP_HTTP_MAX_RETRIES = Math.max(Number(process.env.ATAS_PNCP_MAX_RETRIES) || 3, 1);
const PNCP_ENRICH_CONCURRENCY = Math.max(Number(process.env.ATAS_PNCP_ENRICH_CONCURRENCY) || 4, 1);
const COMPRAS_BASE_URL = (process.env.ATAS_COMPRAS_BASE_URL || 'https://dadosabertos.compras.gov.br').replace(/\/$/, '');
const COMPRAS_HTTP_TIMEOUT_MS = Number(process.env.ATAS_COMPRAS_TIMEOUT_MS) || 45000;
const COMPRAS_HTTP_MAX_RETRIES = Math.max(Number(process.env.ATAS_COMPRAS_MAX_RETRIES) || 3, 1);
const COMPRAS_ARP_ITEM_PAGE_SIZE = Math.min(Math.max(Number(process.env.ATAS_COMPRAS_ARP_TAMANHO_PAGINA) || 100, 10), 500);
const COMPRAS_ARP_ITEM_MAX_PAGES = Math.max(Number(process.env.ATAS_COMPRAS_ARP_MAX_PAGINAS) || 10, 1);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatPncpDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const parsePncpControlNumber = (numeroControlePncpCompra) => {
  const match = String(numeroControlePncpCompra || '').match(/^(\d{14})-1-(\d+)\/(\d{4})$/);
  if (!match) return null;

  return {
    cnpj: match[1],
    sequencial: Number(match[2]),
    ano: Number(match[3]),
  };
};

const normalizePncpDateValue = (value) => {
  if (!value) return null;

  const normalized = String(value).trim().replace(/[^\d]/g, '');
  if (normalized.length === 8) {
    return normalized;
  }

  const parsed = parseDateValue(value);
  return parsed ? parsed.replace(/-/g, '') : null;
};

const resolvePncpDateRange = (options) => {
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(defaultStart.getDate() - 30);

  const dataInicial =
    normalizePncpDateValue(options.dataInicial || process.env.ATAS_PNCP_DATA_INICIAL) || formatPncpDate(defaultStart);

  const dataFinal =
    normalizePncpDateValue(options.dataFinal || process.env.ATAS_PNCP_DATA_FINAL) || formatPncpDate(today);

  return { dataInicial, dataFinal };
};

const buildPncpUrl = (pathname, params) => {
  const url = new URL(`${PNCP_BASE_URL}${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
};

const buildComprasUrl = (pathname, params) => {
  const url = new URL(`${COMPRAS_BASE_URL}${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
};

const fetchJsonWithRetries = async (url, { acceptHeader, timeoutMs, maxRetries }) => {
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: acceptHeader,
        },
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

      return response.json();
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries) {
        break;
      }

      await sleep(750 * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Falha desconhecida ao consultar PNCP em ${url}.`);
};

const fetchPncpJson = async (url) =>
  fetchJsonWithRetries(url, {
    acceptHeader: 'application/json',
    timeoutMs: PNCP_HTTP_TIMEOUT_MS,
    maxRetries: PNCP_HTTP_MAX_RETRIES,
  });

const fetchComprasJson = async (url) =>
  fetchJsonWithRetries(url, {
    acceptHeader: '*/*',
    timeoutMs: COMPRAS_HTTP_TIMEOUT_MS,
    maxRetries: COMPRAS_HTTP_MAX_RETRIES,
  });

const isPncpFederalCompra = (compra) => normalizeText(compra?.orgaoEntidade?.esferaId) === 'f';

const isPncpExcludedCompra = (compra) => {
  const modalidadeId = Number(compra?.modalidadeId);
  if (PNCP_EXCLUDED_MODALIDADE_IDS.has(modalidadeId)) {
    return true;
  }

  const searchableText = normalizeText(
    [
      compra?.modalidadeNome,
      compra?.amparoLegal?.nome,
      compra?.amparoLegal?.descricao,
      compra?.tipoInstrumentoConvocatorioNome,
    ]
      .filter(Boolean)
      .join(' ')
  );

  return PNCP_EXCLUDED_TERMS.some((term) => searchableText.includes(term));
};

const normalizeNumericCodeString = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return null;

  const numeric = Number(digits);
  if (!Number.isFinite(numeric)) return digits;
  return String(numeric);
};

const normalizeModalidadeCode = (value) => {
  const numeric = normalizeNumericCodeString(value);
  if (!numeric) return null;
  return numeric.padStart(2, '0');
};

const parseComprasGovCompraId = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length !== 17) return null;

  return {
    codigoUnidadeGerenciadora: digits.slice(0, 6),
    codigoModalidadeCompra: digits.slice(6, 8),
    numeroCompra: digits.slice(8, 13),
    anoCompra: digits.slice(13, 17),
  };
};

const extractCompraReferenceFromLink = (link) => {
  if (!link) return null;

  try {
    const parsed = new URL(String(link));
    const compra = parsed.searchParams.get('compra');
    return parseComprasGovCompraId(compra);
  } catch (_error) {
    return null;
  }
};

const inferArpModalidadeCode = (compra) => {
  const fromLink = extractCompraReferenceFromLink(compra?.linkSistemaOrigem);
  if (fromLink?.codigoModalidadeCompra) {
    return fromLink.codigoModalidadeCompra;
  }

  const modalidadeNome = normalizeText(compra?.modalidadeNome);
  if (modalidadeNome.includes('pregao')) {
    return '05';
  }

  return normalizeModalidadeCode(compra?.modalidadeId);
};

const buildArpItemQueryParams = (rawAta, compra) => {
  const compraReference =
    extractCompraReferenceFromLink(compra?.linkSistemaOrigem) ||
    parseComprasGovCompraId(compra?.idCompra) ||
    null;
  const codigoUnidadeGerenciadora =
    compraReference?.codigoUnidadeGerenciadora ||
    normalizeNumericCodeString(rawAta?.codigoUnidadeOrgao || compra?.unidadeOrgao?.codigoUnidade);
  const numeroCompra = String(compraReference?.numeroCompra || compra?.numeroCompra || '').trim();
  const codigoModalidadeCompra = compraReference?.codigoModalidadeCompra || inferArpModalidadeCode(compra);
  const dataVigenciaInicial = parseDateValue(rawAta?.vigenciaInicio || rawAta?.vigencia_inicio);
  const dataAssinatura = parseDateValue(rawAta?.dataAssinatura || rawAta?.data_assinatura);

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

const filterArpItemsForAta = (rawAta, items) => {
  const ataControlNumber = String(rawAta?.numeroControlePNCPAta || '');
  const compraControlNumber = String(rawAta?.numeroControlePNCPCompra || '');
  const numeroAta = normalizeText(rawAta?.numeroAtaRegistroPreco || rawAta?.numeroAta || '');

  const byAtaControlNumber = items.filter(
    (item) => String(item?.numeroControlePncpAta || '') === ataControlNumber
  );
  if (byAtaControlNumber.length > 0) return byAtaControlNumber;

  return items.filter(
    (item) =>
      String(item?.numeroControlePncpCompra || '') === compraControlNumber &&
      normalizeText(item?.numeroAtaRegistroPreco || '') === numeroAta
  );
};

const fetchArpItemsForAta = async (rawAta, compra, cache) => {
  const cacheKey = String(rawAta?.numeroControlePNCPAta || rawAta?.numeroControlePNCPCompra || '');
  if (!cacheKey) {
    return {
      items: [],
      warning: 'Ata sem chave suficiente para consulta de itens da ARP.',
    };
  }

  if (!cache.has(cacheKey)) {
    cache.set(
      cacheKey,
      (async () => {
        try {
          const queryParams = buildArpItemQueryParams(rawAta, compra);
          if (!queryParams) {
            return {
              items: [],
              warning: 'Metadados insuficientes para consultar itens da ARP no Compras.gov.br.',
            };
          }

          const collectedItems = [];
          let page = 1;
          let totalPages = 1;

          while (page <= totalPages && page <= COMPRAS_ARP_ITEM_MAX_PAGES) {
            const url = buildComprasUrl('/modulo-arp/2_consultarARPItem', {
              pagina: page,
              tamanhoPagina: COMPRAS_ARP_ITEM_PAGE_SIZE,
              ...queryParams,
            });

            const payload = await fetchComprasJson(url);
            const pageItems = Array.isArray(payload?.resultado) ? payload.resultado : [];
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
            warning:
              error instanceof Error
                ? error.message
                : 'Falha desconhecida ao consultar itens da ARP no Compras.gov.br.',
          };
        }
      })()
    );
  }

  return cache.get(cacheKey);
};

const enrichAtaWithPncpCompra = async (rawAta, cache) => {
  const key = String(rawAta?.numeroControlePNCPCompra || '');
  if (!key) {
    return {
      include: false,
      reason: 'Ata sem numeroControlePNCPCompra para cruzamento com a contratacao.',
      compra: null,
    };
  }

  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        const parsed = parsePncpControlNumber(key);
        if (!parsed) {
          return {
            include: false,
            reason: 'Numero de controle PNCP da compra em formato inesperado.',
            compra: null,
          };
        }

        const url = buildPncpUrl(`/v1/orgaos/${parsed.cnpj}/compras/${parsed.ano}/${parsed.sequencial}`, {});

        try {
          const compra = await fetchPncpJson(url);

          if (!isPncpFederalCompra(compra)) {
            return {
              include: false,
              reason: 'Compra descartada por nao pertencer a esfera federal.',
              compra,
            };
          }

          if (isPncpExcludedCompra(compra)) {
            return {
              include: false,
              reason: 'Compra descartada por modalidade/amparo legal excluido.',
              compra,
            };
          }

          return {
            include: true,
            reason: null,
            compra,
          };
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

  return cache.get(key);
};

const enrichPncpAtasPage = async (pageItems, compraCache, arpItemCache) => {
  const results = [];

  for (let index = 0; index < pageItems.length; index += PNCP_ENRICH_CONCURRENCY) {
    const chunk = pageItems.slice(index, index + PNCP_ENRICH_CONCURRENCY);
    const enrichedChunk = await Promise.all(
      chunk.map(async (rawAta) => {
        const enriched = await enrichAtaWithPncpCompra(rawAta, compraCache);
        const itemResolution =
          enriched?.include && enriched.compra
            ? await fetchArpItemsForAta(rawAta, enriched.compra, arpItemCache)
            : { items: [], warning: null };

        return {
          rawAta,
          enriched,
          itemResolution,
        };
      })
    );

    results.push(...enrichedChunk);
  }

  return results;
};

const loadPncpPayload = async (options) => {
  const { dataInicial, dataFinal } = resolvePncpDateRange(options);
  const pageSize =
    Number(options.pageSize) ||
    Number(process.env.ATAS_PNCP_TAMANHO_PAGINA) ||
    100;
  const sanitizedPageSize = Math.min(Math.max(pageSize, 10), 500);
  const maxPages =
    Number(options.maxPages) ||
    Number(process.env.ATAS_PNCP_MAX_PAGINAS) ||
    Number.POSITIVE_INFINITY;
  const pncpCnpj = String(options.pncpCnpj || process.env.ATAS_PNCP_CNPJ_ORGAO || '').replace(/\D/g, '') || null;

  const compraCache = new Map();
  const arpItemCache = new Map();
  const filteredReasons = [];
  const itemWarnings = [];
  const atas = [];
  const limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : null;
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
    const pageItems = Array.isArray(payload?.data) ? payload.data : [];
    totalPages = Number(payload?.totalPaginas || 1);

    const enrichedItems = await enrichPncpAtasPage(pageItems, compraCache, arpItemCache);

    for (const { rawAta, enriched, itemResolution } of enrichedItems) {
      if (!enriched?.include) {
        filteredReasons.push({
          numeroControlePNCPAta: rawAta?.numeroControlePNCPAta || null,
          numeroControlePNCPCompra: rawAta?.numeroControlePNCPCompra || null,
          reason: enriched?.reason || 'Ata filtrada por regra de negocio.',
        });
        continue;
      }

      const arpItems = Array.isArray(itemResolution?.items) ? itemResolution.items : [];
      if (itemResolution?.warning) {
        itemWarnings.push({
          numeroControlePNCPAta: rawAta?.numeroControlePNCPAta || null,
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

      if (limit && atas.length >= limit) {
        break;
      }
    }

    if (limit && atas.length >= limit) {
      break;
    }

    page += 1;
  }

  return {
    payload: {
      data: atas,
      meta: {
        source: 'pncp',
        dataInicial,
        dataFinal,
        pageSize: sanitizedPageSize,
        processedPages: Math.min(totalPages, Number.isFinite(maxPages) ? maxPages : totalPages),
        filteredOut: filteredReasons.length,
        filteredReasons,
        atasWithItems,
        atasWithoutItems,
        itemWarnings,
        itemIngestion: {
          strategy: 'compras_gov_modulo_arp',
          publicItemEndpointConfirmed: true,
          source: `${COMPRAS_BASE_URL}/modulo-arp/2_consultarARPItem`,
          note: 'Os itens das atas federais sao enriquecidos via API aberta ARP do Compras.gov.br e filtrados pelo numero de controle PNCP da ata.',
        },
      },
    },
    sourceType: 'pncp',
    sourceReference: `${PNCP_BASE_URL}/v1/atas?dataInicial=${dataInicial}&dataFinal=${dataFinal}${pncpCnpj ? `&cnpj=${pncpCnpj}` : ''}`,
  };
};

export const loadPayload = async (options) => {
  const sourceType = options.sourceType || process.env.ATAS_INGEST_SOURCE_TYPE || null;
  if (sourceType === 'pncp') {
    return loadPncpPayload(options);
  }

  if (options.stdin) {
    return {
      payload: await readJsonFromStdin(),
      sourceType: 'stdin',
      sourceReference: 'stdin',
    };
  }

  const filePath = options.file || process.env.ATAS_INGEST_FILE_PATH;
  if (filePath) {
    const absolutePath = path.resolve(process.cwd(), filePath);
    const content = fs.readFileSync(absolutePath, 'utf8');
    return {
      payload: JSON.parse(content),
      sourceType: 'file',
      sourceReference: absolutePath,
    };
  }

  const targetUrl =
    options.url ||
    process.env.ATAS_INGEST_URL ||
    process.env.VITE_ATAS_SOURCE_BASE_URL ||
    null;

  if (targetUrl) {
    const headers = { accept: 'application/json' };
    if (process.env.ATAS_INGEST_AUTH_HEADER && process.env.ATAS_INGEST_AUTH_TOKEN) {
      headers[process.env.ATAS_INGEST_AUTH_HEADER] = process.env.ATAS_INGEST_AUTH_TOKEN;
    }

    const response = await fetch(targetUrl, { headers });
    if (!response.ok) {
      throw new Error(`Falha ao carregar fonte HTTP de atas: ${response.status} ${response.statusText}`);
    }

    return {
      payload: await response.json(),
      sourceType: 'http',
      sourceReference: targetUrl,
    };
  }

  throw new Error('Nenhuma fonte de ingestao foi configurada. Use --file, --url ou --stdin.');
};

const extractAtasArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.atas)) return payload.atas;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;

  throw new Error('Payload sem lista de atas reconhecivel. Esperado array, payload.atas, payload.data, payload.items ou payload.results.');
};

export const normalizeAtaRecord = (rawAta, sourceReference) => {
  const numeroAta = String(
    getFirstValue(rawAta, ['numero_ata', 'numeroAta', 'numeroAtaRegistroPreco', 'numero', 'ata', 'codigo'], '')
  ).trim();

  const objeto = String(
    getFirstValue(rawAta, ['objeto', 'descricao', 'objetoContratacao', 'objetoCompra', 'titulo'], '')
  ).trim();

  if (!numeroAta || !objeto) {
    throw new Error('Ata sem numero ou objeto suficiente para importacao.');
  }

  const anoAtaRaw = getFirstValue(rawAta, ['ano_ata', 'anoAta', 'ano'], null);
  const anoAta = anoAtaRaw !== null && anoAtaRaw !== undefined ? Number(anoAtaRaw) : null;

  const orgao = extractNestedText(
    getFirstValue(
      rawAta,
      ['orgao_gerenciador', 'orgaoGerenciador', 'nomeOrgao', 'orgao', 'unidade'],
      rawAta?.__pncpCompra?.orgaoEntidade?.razaoSocial || null
    )
  );

  const vigenciaInicio = parseDateValue(
    getFirstValue(rawAta, ['vigencia_inicio', 'vigenciaInicio', 'data_inicio_vigencia', 'dataInicioVigencia'], null)
  );

  const vigenciaFim = parseDateValue(
    getFirstValue(rawAta, ['vigencia_fim', 'vigenciaFim', 'data_fim_vigencia', 'dataFimVigencia'], null)
  );

  const fonte = String(
    getFirstValue(rawAta, ['fonte'], rawAta?.__pncpCompra ? 'PNCP' : process.env.VITE_ATAS_SOURCE_NAME || 'fonte_manual')
  ).trim();

  const identifierSource =
    getFirstValue(
      rawAta,
      ['identificador_fonte', 'identificadorFonte', 'numeroControlePNCPAta', 'id', 'uuid', 'codigoAta'],
      null
    ) ||
    `${fonte}:${numeroAta}:${anoAta ?? 'sem-ano'}:${normalizeText(orgao || sourceReference || 'sem-orgao')}`;

  const rawItemsValue = getFirstValue(rawAta, ['itens', 'items', 'listaItens'], undefined);
  const hasStructuredItemsPayload = rawItemsValue !== undefined && rawItemsValue !== null;
  const items = Array.isArray(rawItemsValue) ? rawItemsValue : [];

  const normalizedItems = items
    .map((rawItem, index) => {
      const descricao = String(
        getFirstValue(rawItem, ['descricao', 'descricao_item', 'descricaoItem', 'objeto', 'nome'], '')
      ).trim();

      if (!descricao) return null;

      return {
        numero_item: String(
          getFirstValue(rawItem, ['numero_item', 'numeroItem', 'item', 'sequencial'], index + 1)
        ),
        descricao,
        tipo_item: inferTipoItem(rawItem, descricao),
        unidade_fornecimento: getFirstValue(rawItem, ['unidade_fornecimento', 'unidadeFornecimento', 'unidade', 'sigla_unidade'], null),
        quantidade: parseNumberValue(
          getFirstValue(rawItem, ['quantidade', 'qtd', 'quantidade_registrada', 'quantidadeHomologadaItem'], null)
        ),
        codigo_catmat_catser: String(
          getFirstValue(
            rawItem,
            ['codigo_catmat_catser', 'codigoCatmatCatser', 'catmat', 'catser', 'codigoCatalogo', 'codigoItem'],
            ''
          ) || ''
        ).trim() || null,
        valor_unitario: parseNumberValue(getFirstValue(rawItem, ['valor_unitario', 'valorUnitario', 'valorUnitarioResultado'], null)),
        valor_total: parseNumberValue(getFirstValue(rawItem, ['valor_total', 'valorTotal', 'valorTotalResultado'], null)),
        quantidade_homologada_fornecedor: parseNumberValue(
          getFirstValue(rawItem, ['quantidade_homologada_fornecedor', 'quantidadeHomologadaVencedor'], null)
        ),
        maximo_adesao: parseNumberValue(getFirstValue(rawItem, ['maximo_adesao', 'maximoAdesao'], null)),
        fornecedor_documento: String(getFirstValue(rawItem, ['fornecedor_documento', 'niFornecedor', 'codFornecedor'], '') || '').trim() || null,
        fornecedor_nome: String(getFirstValue(rawItem, ['fornecedor_nome', 'nomeRazaoSocialFornecedor', 'nomeFornecedor'], '') || '').trim() || null,
        codigo_pdm: String(getFirstValue(rawItem, ['codigo_pdm', 'codigoPdm'], '') || '').trim() || null,
        nome_pdm: String(getFirstValue(rawItem, ['nome_pdm', 'nomePdm'], '') || '').trim() || null,
        metadata: rawItem,
      };
    })
    .filter(Boolean);

  const pncpCompra = rawAta?.__pncpCompra || null;

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
        pncpCompra,
      },
    },
    items: normalizedItems,
    item_sync_mode: hasStructuredItemsPayload ? 'replace' : 'preserve',
  };
};

export const normalizePayload = (payload, sourceReference, limit = null) => {
  const rawAtas = extractAtasArray(payload);
  const sliced = limit && Number.isFinite(limit) ? rawAtas.slice(0, limit) : rawAtas;

  const errors = [];
  const records = [];

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

export const createExecutionRecord = async (supabase, executionInput) => {
  const { data, error } = await supabase
    .from('atas_ingestao_execucoes')
    .insert(executionInput)
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
};

export const finishExecutionRecord = async (supabase, id, update) => {
  const { error } = await supabase
    .from('atas_ingestao_execucoes')
    .update({
      ...update,
      finished_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
};
