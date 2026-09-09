import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

import {
  getFaturaEmpenhos,
  getFaturaItens,
  mapContrato,
  mapEmpenho,
  mapFatura,
  mapFaturaEmpenho,
  mapFaturaItem,
  mapHistorico,
  mapItem,
  type ApiContrato,
  type ApiContratoHistorico,
  type ApiContratoItem,
  type ApiEmpenho,
  type ApiFatura,
} from '../../../src/services/contratosApiMappers.ts';
import {
  buildContratoApiDerivedFields,
  isContratoApiCampusEmpenho,
  isContratoApiCampusFatura,
  isContratoApiDisplayFatura,
} from '../../../src/utils/contratosApiStatus.ts';

const CONTRATOS_API_BASE = 'https://contratos.comprasnet.gov.br/api';
const DEFAULT_UASG = '158366';
const DEFAULT_SYNC_UASGS = [
  '152711', // Natal - Cidade Alta
  '152756', // Parnamirim
  '152757', // Nova Cruz
  '154582', // São Gonçalo do Amarante
  '154838', // Ceará-Mirim
  '154839', // Canguaretama
  '154840', // São Paulo do Potengi
  '158155', // Reitoria
  '158365', // Mossoró
  '158366', // Currais Novos
  '158367', // Ipanguaçu
  '158368', // Natal - Zona Norte
  '158369', // Natal - Central
  '158370', // Caicó
  '158371', // Apodi
  '158372', // Santa Cruz
  '158373', // João Câmara
  '158374', // Pau dos Ferros
  '158375', // Macau
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-contratos-sync-secret',
};

type SyncRequest = {
  unidadeCodigo?: string;
  unidadeCodigos?: string[];
  source?: string;
};

type ApiContratoArquivo = Record<string, unknown> & {
  id?: number | string;
  sequencial_documento?: number | string;
  tipo?: string;
  processo?: string;
  descricao?: string;
  path_arquivo?: string;
  origem?: string;
  link_sei?: string;
};

type ComplementoTipo =
  | 'cronograma'
  | 'garantias'
  | 'responsaveis'
  | 'prepostos'
  | 'ocorrencias'
  | 'despesas_acessorias'
  | 'terceirizados';

const COMPLEMENTO_ENDPOINTS: Array<{ tipo: ComplementoTipo; path: string }> = [
  { tipo: 'cronograma', path: 'cronograma' },
  { tipo: 'garantias', path: 'garantias' },
  { tipo: 'responsaveis', path: 'responsaveis' },
  { tipo: 'prepostos', path: 'prepostos' },
  { tipo: 'ocorrencias', path: 'ocorrencias' },
  { tipo: 'despesas_acessorias', path: 'despesas_acessorias' },
  { tipo: 'terceirizados', path: 'terceirizados' },
];

type SupabaseClient = ReturnType<typeof createClient>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isMissingSchemaError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: string; message?: string; details?: string; status?: number };
  const message = `${value.message ?? ''} ${value.details ?? ''}`.toLowerCase();
  return (
    value.status === 404 ||
    value.code === 'PGRST204' ||
    value.code === 'PGRST205' ||
    value.code === '42703' ||
    message.includes('could not find the table') ||
    (message.includes('column') && message.includes('does not exist'))
  );
}

function withoutFaturaComplementFields(row: Record<string, unknown>) {
  const {
    data_ateste: _dataAteste,
    data_protocolo: _dataProtocolo,
    processo: _processo,
    chave_nfe: _chaveNfe,
    justificativa: _justificativa,
    informacao_complementar: _informacaoComplementar,
    repactuacao: _repactuacao,
    juros: _juros,
    multa: _multa,
    glosa: _glosa,
    ...legacyRow
  } = row;
  return legacyRow;
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`A variavel ${name} precisa estar configurada no ambiente do Supabase.`);
  }
  return value;
}

function assertOptionalSharedSecret(request: Request) {
  const expectedSecret = Deno.env.get('CONTRATOS_SYNC_SECRET');
  if (!expectedSecret) return;

  const providedSecret = request.headers.get('x-contratos-sync-secret');
  if (!providedSecret || providedSecret !== expectedSecret) {
    throw new Response(
      JSON.stringify({ error: 'Segredo de sincronizacao ausente ou invalido.' }),
      {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
}

async function fetchJson<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API ${res.status} em ${url}`);
  }
  return res.json() as Promise<T>;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency = 6,
): Promise<R[]> {
  const results: R[] = [];
  const queue = [...items];

  const runners = Array.from({ length: Math.min(concurrency, items.length) }).map(async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      const result = await worker(item);
      results.push(result);
    }
  });

  await Promise.all(runners);
  return results;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function isDefined<T>(value: T | null): value is T {
  return value !== null;
}

function normalizeUnidadeCodigos(body: SyncRequest) {
  const requested = body.unidadeCodigos?.length ? body.unidadeCodigos : body.unidadeCodigo ? [body.unidadeCodigo] : DEFAULT_SYNC_UASGS;
  return Array.from(new Set(requested.map((value) => String(value ?? '').trim()).filter(Boolean)));
}

async function insertInChunks(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  selectColumns?: string,
) {
  const inserted: Record<string, unknown>[] = [];
  for (const rowChunk of chunk(rows, 500)) {
    if (rowChunk.length === 0) continue;
    let query = supabase.from(table).insert(rowChunk);
    if (selectColumns) {
      query = query.select(selectColumns);
    }
    let { data, error } = await query;
    if (error && table === 'contratos_api_faturas' && isMissingSchemaError(error)) {
      let legacyQuery = supabase.from(table).insert(rowChunk.map(withoutFaturaComplementFields));
      if (selectColumns) {
        legacyQuery = legacyQuery.select(selectColumns);
      }
      ({ data, error } = await legacyQuery);
    }
    if (error) throw error;
    if (Array.isArray(data)) inserted.push(...(data as Record<string, unknown>[]));
  }
  return inserted;
}

async function deleteChildrenForContracts(supabase: SupabaseClient, contratoApiIds: string[]) {
  for (const idChunk of chunk(contratoApiIds, 200)) {
    const { error: delEmpError } = await supabase
      .from('contratos_api_empenhos')
      .delete()
      .in('contrato_api_id', idChunk);
    if (delEmpError) throw delEmpError;

    const { error: delFatError } = await supabase
      .from('contratos_api_faturas')
      .delete()
      .in('contrato_api_id', idChunk);
    if (delFatError) throw delFatError;

    const { error: delItemError } = await supabase
      .from('contratos_api_itens')
      .delete()
      .in('contrato_api_id', idChunk);
    if (delItemError) throw delItemError;

    const { error: delHistError } = await supabase
      .from('contratos_api_historico')
      .delete()
      .in('contrato_api_id', idChunk);
    if (delHistError) throw delHistError;

  }
}

function mapArquivoCompras(contratoApiId: string, raw: ApiContratoArquivo) {
  const apiArquivoId = Number(raw.id ?? raw.sequencial_documento);
  const url = String(raw.path_arquivo ?? '').trim();
  if (!Number.isFinite(apiArquivoId) || apiArquivoId <= 0 || !url) return null;
  return {
    contrato_api_id: contratoApiId,
    api_arquivo_id: apiArquivoId,
    tipo: raw.tipo == null ? null : String(raw.tipo),
    processo: raw.processo == null ? null : String(raw.processo),
    descricao: raw.descricao == null ? null : String(raw.descricao),
    url,
    origem: raw.origem == null ? null : String(raw.origem),
    link_sei: raw.link_sei == null ? null : String(raw.link_sei),
    raw_data: raw,
  };
}

function apiDate(value: unknown) {
  const normalized = String(value ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function apiMoney(value: unknown) {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  const parsed = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizePessoa(value: unknown) {
  return String(value ?? '').replace(
    /^\s*(?:\*{3}|\d{3})\.?(?:\*{3}|\d{3})\.?(?:\*{3}|\d{3})-?(?:\*{2}|\d{2})\s*/,
    '',
  ).trim();
}

function mapComplemento(contratoApiId: string, tipo: ComplementoTipo, raw: Record<string, unknown>) {
  const apiRegistroId = Number(raw.id);
  if (!Number.isFinite(apiRegistroId) || apiRegistroId <= 0) return null;
  const tituloPorTipo: Record<ComplementoTipo, unknown> = {
    cronograma: [raw.tipo, raw.numero].filter(Boolean).join(' '),
    garantias: raw.tipo,
    responsaveis: [raw.funcao_id, sanitizePessoa(raw.usuario)].filter(Boolean).join(' — '),
    prepostos: sanitizePessoa(raw.usuario),
    ocorrencias: raw.numeroocorrencia ?? raw.numero,
    despesas_acessorias: raw.tipo_id,
    terceirizados: sanitizePessoa(raw.usuario),
  };
  const descricaoPorTipo: Record<ComplementoTipo, unknown> = {
    cronograma: raw.observacao,
    garantias: raw.tipo,
    responsaveis: raw.portaria,
    prepostos: raw.informacao_complementar,
    ocorrencias: raw.ocorrencia,
    despesas_acessorias: raw.descricao_complementar,
    terceirizados: raw.descricao_complementar ?? raw.funcao_id,
  };
  return {
    contrato_api_id: contratoApiId,
    tipo_recurso: tipo,
    api_registro_id: apiRegistroId,
    titulo: tituloPorTipo[tipo] == null ? null : String(tituloPorTipo[tipo]),
    descricao: descricaoPorTipo[tipo] == null ? null : String(descricaoPorTipo[tipo]),
    situacao: raw.situacao == null ? null : String(raw.situacao),
    data_inicio: apiDate(raw.data_inicio),
    data_fim: apiDate(raw.data_fim),
    vencimento: apiDate(raw.vencimento),
    valor: apiMoney(raw.valor ?? raw.custo ?? raw.salario),
    raw_data: raw.usuario == null ? raw : { ...raw, usuario: sanitizePessoa(raw.usuario) },
  };
}

async function fetchContractExtras(apiContratoId: number, contratoApiId: string) {
  const requests = [
    { tipo: 'arquivos' as const, path: 'arquivos' },
    ...COMPLEMENTO_ENDPOINTS,
  ];
  const settled = await Promise.allSettled(requests.map(({ path }) =>
    fetchJson<Record<string, unknown>[]>(`${CONTRATOS_API_BASE}/contrato/${apiContratoId}/${path}`),
  ));
  let arquivos: ReturnType<typeof mapArquivoCompras>[] | undefined;
  const recursos: Array<{
    tipo: ComplementoTipo;
    rows?: NonNullable<ReturnType<typeof mapComplemento>>[];
    error?: string;
  }> = [];
  const errors: string[] = [];

  settled.forEach((result, index) => {
    const request = requests[index];
    if (result.status === 'rejected') {
      const message = `${request.tipo}: ${errorToMessage(result.reason)}`;
      errors.push(message);
      if (request.tipo !== 'arquivos') recursos.push({ tipo: request.tipo, error: message });
      return;
    }
    const rows = Array.isArray(result.value) ? result.value : [];
    if (request.tipo === 'arquivos') {
      arquivos = rows.map((row) => mapArquivoCompras(contratoApiId, row)).filter(isDefined);
    } else {
      recursos.push({
        tipo: request.tipo,
        rows: rows.map((row) => mapComplemento(contratoApiId, request.tipo, row)).filter(isDefined),
      });
    }
  });
  return { arquivos, recursos, errors };
}

async function replaceComprasDocumentos(
  supabase: SupabaseClient,
  contratoApiId: string,
  rows: NonNullable<ReturnType<typeof mapArquivoCompras>>[],
): Promise<boolean> {
  try {
    if (rows.length > 0) {
      const { error } = await supabase.from('contratos_api_compras_documentos')
        .upsert(rows, { onConflict: 'contrato_api_id,api_arquivo_id' });
      if (error) throw error;
    }
    const { data: existing, error: selectError } = await supabase.from('contratos_api_compras_documentos')
      .select('id,api_arquivo_id').eq('contrato_api_id', contratoApiId);
    if (selectError) throw selectError;
    const current = new Set(rows.map((row) => row.api_arquivo_id));
    const staleIds = (existing ?? []).filter((row) => !current.has(Number(row.api_arquivo_id))).map((row) => row.id);
    if (staleIds.length > 0) {
      const { error } = await supabase.from('contratos_api_compras_documentos').delete().in('id', staleIds);
      if (error) throw error;
    }
    return true;
  } catch (error) {
    if (isMissingSchemaError(error)) return false;
    throw error;
  }
}

async function replaceComplemento(
  supabase: SupabaseClient,
  contratoApiId: string,
  tipo: ComplementoTipo,
  rows: NonNullable<ReturnType<typeof mapComplemento>>[],
): Promise<boolean> {
  try {
    if (rows.length > 0) {
      const { error } = await supabase.from('contratos_api_recursos')
        .upsert(rows, { onConflict: 'contrato_api_id,tipo_recurso,api_registro_id' });
      if (error) throw error;
    }
    const { data: existing, error: selectError } = await supabase.from('contratos_api_recursos')
      .select('id,api_registro_id').eq('contrato_api_id', contratoApiId).eq('tipo_recurso', tipo);
    if (selectError) throw selectError;
    const current = new Set(rows.map((row) => row.api_registro_id));
    const staleIds = (existing ?? []).filter((row) => !current.has(Number(row.api_registro_id))).map((row) => row.id);
    if (staleIds.length > 0) {
      const { error } = await supabase.from('contratos_api_recursos').delete().in('id', staleIds);
      if (error) throw error;
    }
    return true;
  } catch (error) {
    if (isMissingSchemaError(error)) return false;
    throw error;
  }
}

async function completeSyncRun(
  supabase: SupabaseClient,
  runId: string,
  payload: Record<string, unknown>,
) {
  let { error } = await supabase
    .from('contratos_api_sync_runs')
    .update(payload)
    .eq('id', runId);

  if (error && isMissingSchemaError(error)) {
    const {
      arquivos_compras_upserted: _arquivosComprasUpserted,
      recursos_complementares_upserted: _recursosComplementaresUpserted,
      ...legacyPayload
    } = payload;
    ({ error } = await supabase
      .from('contratos_api_sync_runs')
      .update(legacyPayload)
      .eq('id', runId));
  }

  if (error) throw error;
}

async function runSync(supabase: SupabaseClient, unidadeCodigo: string, source: string) {
  const { data: runInsert, error: runInsertError } = await supabase
    .from('contratos_api_sync_runs')
    .insert({
      unidade_codigo: unidadeCodigo,
      status: 'running',
      details: { source },
    })
    .select('id')
    .single();

  if (runInsertError) throw runInsertError;
  const runId = String(runInsert.id);

  try {
    const [ativos, inativos] = await Promise.all([
      fetchJson<ApiContrato[]>(`${CONTRATOS_API_BASE}/contrato/ug/${unidadeCodigo}`),
      fetchJson<ApiContrato[]>(`${CONTRATOS_API_BASE}/contrato/inativo/ug/${unidadeCodigo}`),
    ]);

    const mergedMap = new Map<number, ReturnType<typeof mapContrato>>();
    for (const contrato of inativos ?? []) {
      const mapped = mapContrato(contrato, false);
      if (mapped.api_contrato_id) mergedMap.set(mapped.api_contrato_id, mapped);
    }
    for (const contrato of ativos ?? []) {
      const mapped = mapContrato(contrato, true);
      if (mapped.api_contrato_id) mergedMap.set(mapped.api_contrato_id, mapped);
    }
    const contratosPayload = Array.from(mergedMap.values());

    const { data: upserted, error: upsertError } = await supabase
      .from('contratos_api')
      .upsert(contratosPayload, { onConflict: 'api_contrato_id' })
      .select('id, api_contrato_id');
    if (upsertError) throw upsertError;

    const mappedContratos = (upserted ?? []) as { id: string; api_contrato_id: number }[];
    const remoteByApiId = new Map(contratosPayload.map((contrato) => [contrato.api_contrato_id, contrato]));
    const contractWork = mappedContratos.filter((contrato) => remoteByApiId.has(contrato.api_contrato_id));

    const contractData = await mapWithConcurrency(
      contractWork,
      async (contractDb) => {
        const contrato = remoteByApiId.get(contractDb.api_contrato_id);
        if (!contrato) {
          return {
            contratoApiId: contractDb.id,
            apiContratoId: contractDb.api_contrato_id,
            rawFaturas: [],
            empenhos: [],
            faturas: [],
            itens: [],
            historico: [],
            arquivos: undefined,
            recursos: [],
            resourceErrors: [],
            derived: buildContratoApiDerivedFields({}, [], [], [], new Date(), unidadeCodigo),
          };
        }

        if (unidadeCodigo === '158155') {
          if (!contrato.situacao) {
            return {
              contratoApiId: contractDb.id,
              apiContratoId: contractDb.api_contrato_id,
              rawFaturas: [],
              empenhos: [],
              faturas: [],
              itens: [],
              historico: [],
              arquivos: undefined,
              recursos: [],
              resourceErrors: [],
              derived: {
                situacao_derivada: false,
                vigencia_inicio_derivada: contrato.vigencia_inicio ?? null,
                vigencia_fim_derivada: contrato.vigencia_fim ?? null,
                situacao_derivada_motivo: 'inativo_no_comprasnet',
                campus_scope_reason: 'reitoria_inativo',
              },
            };
          }

          // Nunca trate indisponibilidade da origem como uma lista vazia. A lista
          // vazia é um resultado válido e remove os filhos; já uma falha precisa
          // interromper a execução antes que dados previamente sincronizados sejam
          // apagados na etapa de substituição abaixo.
          const apiEmpenhos = await fetchJson<ApiEmpenho[]>(`${CONTRATOS_API_BASE}/contrato/${contractDb.api_contrato_id}/empenhos`);

          const empenhos = (apiEmpenhos ?? [])
            .map((empenho) => mapEmpenho(contractDb.id, empenho))
            .filter((empenho) => empenho.api_empenho_id);
          const campusEmpenhos = empenhos.filter((empenho) => isContratoApiCampusEmpenho(empenho, unidadeCodigo));
          const directCampusScope = contrato.unidade_codigo === unidadeCodigo || contrato.unidade_origem_codigo === unidadeCodigo;
          if (campusEmpenhos.length === 0 && !directCampusScope) {
            return {
              contratoApiId: contractDb.id,
              apiContratoId: contractDb.api_contrato_id,
              rawFaturas: [],
              empenhos: [],
              faturas: [],
              itens: [],
              historico: [],
              arquivos: undefined,
              recursos: [],
              resourceErrors: [],
              derived: buildContratoApiDerivedFields(contrato, [], campusEmpenhos, [], new Date(), unidadeCodigo),
            };
          }

          const apiHistorico = await fetchJson<ApiContratoHistorico[]>(`${CONTRATOS_API_BASE}/contrato/${contractDb.api_contrato_id}/historico`);
          const historico = (apiHistorico ?? [])
            .map((item) => mapHistorico(contractDb.id, item))
            .filter((item) => item.api_historico_id);

          let rawFaturas: ApiFatura[] = [];
          let faturas: ReturnType<typeof mapFatura>[] = [];
          let derived = buildContratoApiDerivedFields(contrato, historico, empenhos, faturas, new Date(), unidadeCodigo);
          const activeByVigencia =
            derived.situacao_derivada_motivo === 'historico_vigente' ||
            derived.situacao_derivada_motivo === 'fallback_sem_historico_vigente';

          if (campusEmpenhos.length === 0 && !derived.situacao_derivada && activeByVigencia && derived.campus_scope_reason === 'reitoria_sem_evidencia_operacional_campus') {
            rawFaturas = await fetchJson<ApiFatura[]>(`${CONTRATOS_API_BASE}/contrato/${contractDb.api_contrato_id}/faturas`);
            faturas = rawFaturas
              .map((fatura) => mapFatura(contractDb.id, fatura))
              .filter((fatura) => fatura.api_fatura_id);
            derived = buildContratoApiDerivedFields(contrato, historico, empenhos, faturas, new Date(), unidadeCodigo);
          }

          let apiItens: ApiContratoItem[] = [];
          if (derived.situacao_derivada) {
            if (rawFaturas.length === 0) {
              rawFaturas = await fetchJson<ApiFatura[]>(`${CONTRATOS_API_BASE}/contrato/${contractDb.api_contrato_id}/faturas`);
              faturas = rawFaturas
                .map((fatura) => mapFatura(contractDb.id, fatura))
                .filter((fatura) => fatura.api_fatura_id);
            }
            apiItens = await fetchJson<ApiContratoItem[]>(`${CONTRATOS_API_BASE}/contrato/${contractDb.api_contrato_id}/itens`);
          }
          const campusEmpenhoNumeros = new Set(campusEmpenhos.map((e) => String(e.numero || '').trim()));
          const campusEmpenhoIds = new Set(campusEmpenhos.map((e) => Number(e.api_empenho_id)));

          const isCampusFatura = (fatura: ApiFatura) => {
            if (isContratoApiCampusFatura(fatura, unidadeCodigo)) return true;
            const emps = Array.isArray(fatura.dados_empenho) ? fatura.dados_empenho : [];
            return emps.some((emp: Record<string, unknown>) => {
              const num = String(emp.numero_empenho || '').trim();
              const id = Number(emp.id_empenho);
              return campusEmpenhoNumeros.has(num) || campusEmpenhoIds.has(id);
            });
          };

          const campusRawFaturas = rawFaturas.filter(isCampusFatura);
          const campusFaturas = faturas.filter((f) => {
            const raw = rawFaturas.find((r) => Number(r.id) === Number(f.api_fatura_id));
            return raw ? isCampusFatura(raw) : isContratoApiCampusFatura(f, unidadeCodigo);
          });

          const extras = derived.situacao_derivada
            ? await fetchContractExtras(contractDb.api_contrato_id, contractDb.id)
            : { arquivos: undefined, recursos: [], errors: [] };

          return {
            contratoApiId: contractDb.id,
            apiContratoId: contractDb.api_contrato_id,
            rawFaturas: derived.situacao_derivada ? campusRawFaturas : [],
            empenhos: empenhos,
            faturas: derived.situacao_derivada ? campusFaturas : [],
            itens: derived.situacao_derivada
              ? apiItens.map((item) => mapItem(contractDb.id, item)).filter((item) => item.api_item_id)
              : [],
            historico,
            arquivos: extras.arquivos,
            recursos: extras.recursos,
            resourceErrors: extras.errors,
            derived,
          };
        }

        const [apiEmpenhos, apiFaturas, apiItens, apiHistorico] = await Promise.all([
          fetchJson<ApiEmpenho[]>(`${CONTRATOS_API_BASE}/contrato/${contractDb.api_contrato_id}/empenhos`),
          fetchJson<ApiFatura[]>(`${CONTRATOS_API_BASE}/contrato/${contractDb.api_contrato_id}/faturas`),
          fetchJson<ApiContratoItem[]>(`${CONTRATOS_API_BASE}/contrato/${contractDb.api_contrato_id}/itens`),
          fetchJson<ApiContratoHistorico[]>(`${CONTRATOS_API_BASE}/contrato/${contractDb.api_contrato_id}/historico`),
        ]);

        const empenhos = (apiEmpenhos ?? []).map((empenho) => mapEmpenho(contractDb.id, empenho)).filter((empenho) => empenho.api_empenho_id);
        const faturas = (apiFaturas ?? []).map((fatura) => mapFatura(contractDb.id, fatura)).filter((fatura) => fatura.api_fatura_id);
        const historico = (apiHistorico ?? []).map((item) => mapHistorico(contractDb.id, item)).filter((item) => item.api_historico_id);
        const derived = buildContratoApiDerivedFields(contrato, historico, empenhos, faturas, new Date(), unidadeCodigo);
        const extras = derived.situacao_derivada
          ? await fetchContractExtras(contractDb.api_contrato_id, contractDb.id)
          : { arquivos: undefined, recursos: [], errors: [] };

        return {
          contratoApiId: contractDb.id,
          apiContratoId: contractDb.api_contrato_id,
          rawFaturas: apiFaturas ?? [],
          empenhos,
          faturas,
          itens: (apiItens ?? []).map((item) => mapItem(contractDb.id, item)).filter((item) => item.api_item_id),
          historico,
          arquivos: extras.arquivos,
          recursos: extras.recursos,
          resourceErrors: extras.errors,
          derived,
        };
      },
      unidadeCodigo === '158155' ? 3 : 6,
    );

    const contractDataByApiId = new Map(contractData.map((item) => [item.apiContratoId, item]));
    const contratosPayloadWithDerived = contratosPayload.map((contrato) => {
      const data = contractDataByApiId.get(contrato.api_contrato_id);
      const derived = buildContratoApiDerivedFields(
        contrato,
        data?.historico ?? [],
        data?.empenhos ?? [],
        data?.faturas ?? [],
        new Date(),
        unidadeCodigo,
      );
      const derivedFields = data?.derived ?? derived;

      return {
        ...contrato,
        ...derivedFields,
      };
    });

    const { error: derivedUpsertError } = await supabase
      .from('contratos_api')
      .upsert(contratosPayloadWithDerived, { onConflict: 'api_contrato_id' });
    if (derivedUpsertError) throw derivedUpsertError;

    const contratoApiIds = contractWork.map((contrato) => contrato.id);
    const campusScopePayload = contractData
      .filter((item) => ['ug_campus', 'reitoria_com_empenho_campus', 'reitoria_com_fatura_campus'].includes(item.derived.campus_scope_reason))
      .map((item) => ({
        contrato_api_id: item.contratoApiId,
        campus_uasg: unidadeCodigo,
        scope_reason: item.derived.campus_scope_reason,
        updated_at: new Date().toISOString(),
      }));
    if (contratoApiIds.length > 0) {
      const { error: scopeDeleteError } = await supabase
        .from('contratos_api_campus_scope')
        .delete()
        .eq('campus_uasg', unidadeCodigo)
        .in('contrato_api_id', contratoApiIds);
      if (scopeDeleteError) throw scopeDeleteError;
    }
    if (campusScopePayload.length > 0) {
      const { error: scopeUpsertError } = await supabase
        .from('contratos_api_campus_scope')
        .upsert(campusScopePayload, { onConflict: 'contrato_api_id,campus_uasg' });
      if (scopeUpsertError) throw scopeUpsertError;
    }
    await deleteChildrenForContracts(supabase, contratoApiIds);

    const empenhosPayload = contractData.flatMap((item) => item.empenhos);
    const faturasPayload = contractData.flatMap((item) => item.faturas);
    const itensPayload = contractData.flatMap((item) => item.itens);
    const historicoPayload = contractData.flatMap((item) => item.historico);

    const insertedEmpenhos = await insertInChunks(
      supabase,
      'contratos_api_empenhos',
      empenhosPayload,
      'id, contrato_api_id, api_empenho_id',
    ) as Array<{ id: string; contrato_api_id: string; api_empenho_id: number }>;
    const insertedFaturas = await insertInChunks(
      supabase,
      'contratos_api_faturas',
      faturasPayload,
      'id, contrato_api_id, api_fatura_id',
    ) as Array<{ id: string; contrato_api_id: string; api_fatura_id: number }>;
    const insertedItens = await insertInChunks(
      supabase,
      'contratos_api_itens',
      itensPayload,
      'id, contrato_api_id, api_item_id',
    ) as Array<{ id: string; contrato_api_id: string; api_item_id: number }>;
    await insertInChunks(supabase, 'contratos_api_historico', historicoPayload);

    const empenhoByKey = new Map(insertedEmpenhos.map((row) => [`${row.contrato_api_id}:${row.api_empenho_id}`, row.id]));
    const faturaByKey = new Map(insertedFaturas.map((row) => [`${row.contrato_api_id}:${row.api_fatura_id}`, row.id]));
    const itemByKey = new Map(insertedItens.map((row) => [`${row.contrato_api_id}:${row.api_item_id}`, row.id]));

    const faturaItensPayload = contractData.flatMap((contract) =>
      contract.rawFaturas.flatMap((rawFatura) => {
        const faturaId = faturaByKey.get(`${contract.contratoApiId}:${Number(rawFatura.id)}`);
        if (!faturaId) return [];
        return getFaturaItens(rawFatura)
          .filter((rawItem) => Number(rawItem.id_item_contrato))
          .map((rawItem) =>
            mapFaturaItem(
              contract.contratoApiId,
              faturaId,
              itemByKey.get(`${contract.contratoApiId}:${Number(rawItem.id_item_contrato)}`) ?? null,
              rawItem,
            ),
          );
      }),
    );
    const faturaEmpenhosPayload = contractData.flatMap((contract) =>
      contract.rawFaturas.flatMap((rawFatura) => {
        const faturaId = faturaByKey.get(`${contract.contratoApiId}:${Number(rawFatura.id)}`);
        if (!faturaId) return [];
        return getFaturaEmpenhos(rawFatura)
          .filter((rawEmpenho) => Number(rawEmpenho.id_empenho))
          .flatMap((rawEmpenho) => {
            const empenhoId = empenhoByKey.get(`${contract.contratoApiId}:${Number(rawEmpenho.id_empenho)}`);
            if (!empenhoId) return [];
            return mapFaturaEmpenho(
              contract.contratoApiId,
              faturaId,
              empenhoId,
              rawEmpenho,
            );
          });
      }),
    );

    await insertInChunks(supabase, 'contratos_api_fatura_itens', faturaItensPayload);
    await insertInChunks(supabase, 'contratos_api_fatura_empenhos', faturaEmpenhosPayload);

    let comprasDocumentosDisponiveis = true;
    let recursosDisponiveis = true;
    for (const contract of contractData) {
      if (comprasDocumentosDisponiveis && contract.arquivos !== undefined) {
        comprasDocumentosDisponiveis = await replaceComprasDocumentos(supabase, contract.contratoApiId, contract.arquivos);
      }
      for (const recurso of contract.recursos) {
        if (recursosDisponiveis && recurso.rows !== undefined) {
          recursosDisponiveis = await replaceComplemento(supabase, contract.contratoApiId, recurso.tipo, recurso.rows);
        }
      }
    }

    const arquivosPayload = contractData.flatMap((item) => item.arquivos ?? []);
    const recursosPayload = contractData.flatMap((item) => item.recursos.flatMap((recurso) => recurso.rows ?? []));
    const resourceErrors = contractData.flatMap((item) => item.resourceErrors.map((error) => ({
      api_contrato_id: item.apiContratoId,
      error,
    })));

    const derivedActiveContracts = contratosPayloadWithDerived.filter((contrato) => contrato.situacao_derivada).length;
    const derivedInactiveContracts = contratosPayloadWithDerived.length - derivedActiveContracts;

    const result = {
      contratos_ativos: ativos?.length ?? 0,
      contratos_inativos: inativos?.length ?? 0,
      contratos_upserted: contratosPayload.length,
      empenhos_upserted: empenhosPayload.length,
      faturas_upserted: faturasPayload.length,
      itens_upserted: itensPayload.length,
      historicos_upserted: historicoPayload.length,
      fatura_itens_upserted: faturaItensPayload.length,
      fatura_empenhos_upserted: faturaEmpenhosPayload.length,
      arquivos_compras_upserted: comprasDocumentosDisponiveis ? arquivosPayload.length : 0,
      recursos_complementares_upserted: recursosDisponiveis ? recursosPayload.length : 0,
    };

    const schemaWarnings = [
      ...(comprasDocumentosDisponiveis ? [] : ['arquivos: migration pendente']),
      ...(recursosDisponiveis ? [] : ['recursos: migration pendente']),
    ];
    await completeSyncRun(supabase, runId, {
      finished_at: new Date().toISOString(),
      status: resourceErrors.length > 0 || schemaWarnings.length > 0 ? 'partial_success' : 'success',
      ...result,
      details: {
        unidade_codigo: unidadeCodigo,
        processed_contracts: contractWork.length,
        source,
        derived_active_contracts: derivedActiveContracts,
        derived_inactive_contracts: derivedInactiveContracts,
        resource_errors: resourceErrors,
        schema_warnings: schemaWarnings,
      },
    });

    return {
      runId,
      ...result,
      derived_active_contracts: derivedActiveContracts,
      derived_inactive_contracts: derivedInactiveContracts,
    };
  } catch (error) {
    const message = errorToMessage(error);
    await supabase
      .from('contratos_api_sync_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'error',
        error_message: message,
      })
      .eq('id', runId);
    throw error;
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Metodo nao suportado.' }, 405);
  }

  try {
    assertOptionalSharedSecret(request);
    const body = (await request.json().catch(() => ({}))) as SyncRequest;
    const unidadeCodigos = normalizeUnidadeCodigos(body);
    const unsupported = unidadeCodigos.filter((unidadeCodigo) => !DEFAULT_SYNC_UASGS.includes(unidadeCodigo));
    if (unsupported.length > 0) {
      return jsonResponse({ error: `UG(s) nao habilitada(s) nesta versao: ${unsupported.join(', ')}` }, 400);
    }

    const supabaseUrl = requireEnv('SUPABASE_URL');
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const results = [];
    const errors: Array<{ unidadeCodigo: string; error: string }> = [];

    for (const unidadeCodigo of unidadeCodigos) {
      try {
        results.push(await runSync(supabase, unidadeCodigo, body.source || 'manual'));
      } catch (err) {
        const errorMsg = errorToMessage(err);
        console.error(`Falha ao sincronizar UASG ${unidadeCodigo}:`, err);
        errors.push({ unidadeCodigo, error: errorMsg });
      }
    }

    const totals = results.reduce(
      (sum, item) => ({
        contratos_ativos: sum.contratos_ativos + item.contratos_ativos,
        contratos_inativos: sum.contratos_inativos + item.contratos_inativos,
        contratos_upserted: sum.contratos_upserted + item.contratos_upserted,
        empenhos_upserted: sum.empenhos_upserted + item.empenhos_upserted,
        faturas_upserted: sum.faturas_upserted + item.faturas_upserted,
        itens_upserted: sum.itens_upserted + item.itens_upserted,
        historicos_upserted: sum.historicos_upserted + item.historicos_upserted,
        fatura_itens_upserted: sum.fatura_itens_upserted + item.fatura_itens_upserted,
        fatura_empenhos_upserted: sum.fatura_empenhos_upserted + item.fatura_empenhos_upserted,
        arquivos_compras_upserted: sum.arquivos_compras_upserted + item.arquivos_compras_upserted,
        recursos_complementares_upserted: sum.recursos_complementares_upserted + item.recursos_complementares_upserted,
        derived_active_contracts: sum.derived_active_contracts + item.derived_active_contracts,
        derived_inactive_contracts: sum.derived_inactive_contracts + item.derived_inactive_contracts,
      }),
      {
        contratos_ativos: 0,
        contratos_inativos: 0,
        contratos_upserted: 0,
        empenhos_upserted: 0,
        faturas_upserted: 0,
        itens_upserted: 0,
        historicos_upserted: 0,
        fatura_itens_upserted: 0,
        fatura_empenhos_upserted: 0,
        arquivos_compras_upserted: 0,
        recursos_complementares_upserted: 0,
        derived_active_contracts: 0,
        derived_inactive_contracts: 0,
      },
    );

    return jsonResponse({
      status: errors.length === 0 ? 'processed' : results.length > 0 ? 'partial_success' : 'error',
      unidadeCodigos,
      results,
      errors: errors.length > 0 ? errors : undefined,
      totals,
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error('sync-contratos-comprasnet', error);
    return jsonResponse(
      {
        error: errorToMessage(error) || 'Falha inesperada ao sincronizar contratos do Comprasnet.',
      },
      500,
    );
  }
});
