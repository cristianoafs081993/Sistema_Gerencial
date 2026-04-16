import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

import {
  decodeCsvBytes,
  extractEmailAddress,
  parseEmailCsvImport,
  type CreditoDisponivelImportRow,
  type DescentralizacaoImportRow,
  type EmailCsvPipelineHint,
  type FinanceiroRegistro,
  type LCRegistro,
  type OrdemBancariaImportItem,
  type ParsedEmailCsvImport,
  type RetencaoEfdReinfRegistro,
  type SiafiEmpenhoData,
} from '../../../src/lib/emailCsvIngestion.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-email-ingest-secret',
};

type EmailCsvAttachmentRequest = {
  fileName: string;
  mimeType?: string;
  contentBase64: string;
};

type EmailCsvIngestionRequest = {
  messageId: string;
  threadId?: string;
  subject?: string;
  from?: string;
  to?: string;
  receivedAt?: string;
  pipelineHint?: EmailCsvPipelineHint;
  gmailLabels?: string[];
  attachment: EmailCsvAttachmentRequest;
};

type IngestionRunStatus = 'processing' | 'succeeded' | 'failed' | 'skipped';

type ProcessingResult = {
  pipeline: ParsedEmailCsvImport['pipeline'];
  rowsDetected: number;
  rowsWritten: number;
  tableStats: Array<{ table: string; rows: number }>;
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`A variavel ${name} precisa estar configurada no ambiente do Supabase.`);
  }
  return value;
}

function chunkArray<T>(items: T[], size = 500) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function decodeBase64(base64: string) {
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function aggregateFinanceiroRows(rows: FinanceiroRegistro[]) {
  const map = new Map<string, FinanceiroRegistro>();

  rows.forEach((row) => {
    const key = `${row.ugCodigo}|${row.mesLancamento}|${row.fonteCodigo}|${row.vinculacaoCodigo}`;
    const current = map.get(key);
    if (current) {
      current.saldo += row.saldo;
      return;
    }
    map.set(key, { ...row });
  });

  return Array.from(map.values());
}

function dedupeRetencoesRows(rows: RetencaoEfdReinfRegistro[]) {
  const map = new Map<string, RetencaoEfdReinfRegistro>();

  rows.forEach((row) => {
    const key = [
      row.documentoHabil,
      row.dhProcesso,
      row.dhSituacao,
      row.dhCredorDocumento,
      row.dhDiaPagamento || '',
      row.valorRetencao,
    ].join('|');

    if (!map.has(key)) {
      map.set(key, row);
    }
  });

  return Array.from(map.values());
}

function createSiafiUploadTimestamp() {
  const date = new Date();
  date.setHours(3, 0, 0, 0);
  return date.toISOString();
}

async function upsertInChunks(
  supabase: ReturnType<typeof createClient>,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
) {
  for (const chunk of chunkArray(rows)) {
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) throw error;
  }
}

async function insertInChunks(
  supabase: ReturnType<typeof createClient>,
  table: string,
  rows: Record<string, unknown>[],
) {
  for (const chunk of chunkArray(rows)) {
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw error;
  }
}

async function deleteByColumnValues(
  supabase: ReturnType<typeof createClient>,
  table: string,
  column: string,
  values: string[],
) {
  for (const chunk of chunkArray(values)) {
    const { error } = await supabase.from(table).delete().in(column, chunk);
    if (error) throw error;
  }
}

async function selectRowsByColumnValues(
  supabase: ReturnType<typeof createClient>,
  table: string,
  columns: string,
  column: string,
  values: string[],
) {
  const allRows: Record<string, unknown>[] = [];

  for (const chunk of chunkArray(values)) {
    const { data, error } = await supabase.from(table).select(columns).in(column, chunk);
    if (error) throw error;
    allRows.push(...((data as Record<string, unknown>[] | null) || []));
  }

  return allRows;
}

async function updateRun(
  supabase: ReturnType<typeof createClient>,
  runId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await supabase
    .from('email_csv_ingestion_runs')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId);

  if (error) throw error;
}

async function applyFinanceiroImport(
  supabase: ReturnType<typeof createClient>,
  rows: FinanceiroRegistro[],
  sourceFile: string,
) {
  const importedAt = new Date().toISOString();
  const consolidated = aggregateFinanceiroRows(rows);
  const payload = consolidated.map((row) => ({
    ug_codigo: row.ugCodigo,
    ug_nome: row.ugNome || null,
    mes_lancamento: row.mesLancamento,
    fonte_codigo: row.fonteCodigo,
    fonte_descricao: row.fonteDescricao || null,
    vinculacao_codigo: row.vinculacaoCodigo,
    vinculacao_descricao: row.vinculacaoDescricao || null,
    saldo_disponivel: row.saldo,
    source_file: sourceFile,
    imported_at: importedAt,
    updated_at: importedAt,
  }));

  await upsertInChunks(
    supabase,
    'financeiro_fonte_vinculacao',
    payload,
    'ug_codigo,mes_lancamento,fonte_codigo,vinculacao_codigo',
  );

  return {
    pipeline: 'financeiro' as const,
    rowsDetected: rows.length,
    rowsWritten: payload.length,
    tableStats: [{ table: 'financeiro_fonte_vinculacao', rows: payload.length }],
  };
}

async function applyLcImport(
  supabase: ReturnType<typeof createClient>,
  rows: LCRegistro[],
  sourceFile: string,
) {
  const importedAt = new Date().toISOString();
  const payload = rows.map((row) => ({
    ob_lista_credores: row.obListaCredores,
    sequencial: row.sequencial,
    favorecido_documento: row.favorecidoDocumento,
    favorecido_nome: row.favorecidoNome || null,
    banco_codigo: row.bancoCodigo || null,
    banco_nome: row.bancoNome || null,
    agencia_codigo: row.agenciaCodigo || null,
    agencia_nome: row.agenciaNome || null,
    conta_bancaria: row.contaBancaria || null,
    source_file: sourceFile,
    imported_at: importedAt,
    updated_at: importedAt,
  }));

  await upsertInChunks(supabase, 'lc_credores', payload, 'ob_lista_credores,sequencial');

  return {
    pipeline: 'lc' as const,
    rowsDetected: rows.length,
    rowsWritten: payload.length,
    tableStats: [{ table: 'lc_credores', rows: payload.length }],
  };
}

async function applyRetencoesEfdReinfImport(
  supabase: ReturnType<typeof createClient>,
  rows: RetencaoEfdReinfRegistro[],
  sourceFile: string,
) {
  const importedAt = new Date().toISOString();
  const payload = dedupeRetencoesRows(rows).map((row) => ({
    source_index: row.sourceIndex,
    documento_habil: row.documentoHabil,
    dh_processo: row.dhProcesso || null,
    dh_estado: row.dhEstado || null,
    dh_ug_pagadora: row.dhUgPagadora || null,
    dh_item_ug_pagadora: row.dhItemUgPagadora || null,
    dh_credor_documento: row.dhCredorDocumento || null,
    dh_credor_nome: row.dhCredorNome || null,
    dh_situacao: row.dhSituacao || null,
    dh_data_emissao_doc_origem: row.dhDataEmissaoDocOrigem,
    dh_dia_pagamento: row.dhDiaPagamento,
    dh_item_dia_vencimento: row.dhItemDiaVencimento,
    dh_item_dia_pagamento: row.dhItemDiaPagamento,
    dh_item_liquidado: row.dhItemLiquidado,
    dh_valor_doc_origem: row.dhValorDocOrigem,
    metrica: row.metrica || null,
    valor_retencao: row.valorRetencao,
    source_file: sourceFile,
    imported_at: importedAt,
    updated_at: importedAt,
  }));

  await upsertInChunks(
    supabase,
    'retencoes_efd_reinf',
    payload,
    'documento_habil,dh_processo,dh_situacao,dh_credor_documento,dh_dia_pagamento,valor_retencao',
  );

  return {
    pipeline: 'retencoes_efd_reinf' as const,
    rowsDetected: rows.length,
    rowsWritten: payload.length,
    tableStats: [{ table: 'retencoes_efd_reinf', rows: payload.length }],
  };
}

async function applyDescentralizacoesImport(
  supabase: ReturnType<typeof createClient>,
  rows: DescentralizacaoImportRow[],
) {
  const existingRows = (await supabase
    .from('descentralizacoes')
    .select('data_emissao, plano_interno, origem_recurso, natureza_despesa, valor, nota_credito')
    .then(({ data, error }) => {
      if (error) throw error;
      return data || [];
    })) as Array<Record<string, unknown>>;

  const existingImportKeys = new Set(
    existingRows.flatMap((row) => {
      const dateKey = String(row.data_emissao || '');
      const planoInterno = String(row.plano_interno || '').trim().toUpperCase();
      const origemRecurso = String(row.origem_recurso || '').trim();
      const naturezaDespesa = String(row.natureza_despesa || '').trim();
      const valor = Number(row.valor || 0);
      const notaCredito = String(row.nota_credito || '').trim();
      const baseKey = `${dateKey}|${planoInterno}|${origemRecurso}|${naturezaDespesa}|${valor}`;
      const rowKey = notaCredito ? `${baseKey}|${notaCredito}` : baseKey;

      return rowKey === baseKey ? [baseKey] : [baseKey, rowKey];
    }),
  );

  const importedRowKeys = new Set<string>();
  const payload = rows
    .filter((row) => {
      if (
        existingImportKeys.has(row.baseKey) ||
        existingImportKeys.has(row.rowKey) ||
        importedRowKeys.has(row.rowKey)
      ) {
        return false;
      }
      importedRowKeys.add(row.rowKey);
      return true;
    })
    .map((row) => ({
      dimensao: row.dimensao,
      nota_credito: row.notaCredito || null,
      operacao_tipo: row.operacaoTipo || null,
      origem_recurso: row.origemRecurso,
      natureza_despesa: row.naturezaDespesa,
      plano_interno: row.planoInterno,
      data_emissao: row.dataEmissao,
      descricao: row.descricao,
      valor: row.valor,
    }));

  if (payload.length > 0) {
    await insertInChunks(supabase, 'descentralizacoes', payload);
  }

  return {
    pipeline: 'descentralizacoes' as const,
    rowsDetected: rows.length,
    rowsWritten: payload.length,
    tableStats: [{ table: 'descentralizacoes', rows: payload.length }],
  };
}

async function applyDocumentosHabeisImport(
  supabase: ReturnType<typeof createClient>,
  parsed: Extract<ParsedEmailCsvImport, { pipeline: 'documentos_habeis' }>,
) {
  const timestamp = new Date().toISOString();
  const documentos = parsed.documentos.map((row) => ({
    ...row,
    updated_at: timestamp,
  }));

  if (documentos.length > 0) {
    await upsertInChunks(supabase, 'documentos_habeis', documentos, 'id');
  }

  const documentoIds = documentos.map((row) => row.id);
  if (documentoIds.length > 0) {
    await deleteByColumnValues(supabase, 'documentos_habeis_situacoes', 'documento_habil_id', documentoIds);
    await deleteByColumnValues(supabase, 'documentos_habeis_itens', 'documento_habil_id', documentoIds);
  }

  if (parsed.situacoes.length > 0) {
    await insertInChunks(supabase, 'documentos_habeis_situacoes', parsed.situacoes);
  }

  if (parsed.itens.length > 0) {
    await insertInChunks(supabase, 'documentos_habeis_itens', parsed.itens);
  }

  return {
    pipeline: 'documentos_habeis' as const,
    rowsDetected: parsed.rowCount,
    rowsWritten: documentos.length + parsed.situacoes.length + parsed.itens.length,
    tableStats: [
      { table: 'documentos_habeis', rows: documentos.length },
      { table: 'documentos_habeis_situacoes', rows: parsed.situacoes.length },
      { table: 'documentos_habeis_itens', rows: parsed.itens.length },
    ],
  };
}

async function fetchEmpenhoFonteMap(
  supabase: ReturnType<typeof createClient>,
  empenhoNumbers: string[],
) {
  if (!empenhoNumbers.length) return new Map<string, string>();

  const rows = await selectRowsByColumnValues(
    supabase,
    'empenhos',
    'numero, origem_recurso',
    'numero',
    empenhoNumbers,
  );

  return new Map(
    rows.map((row) => [String(row.numero || ''), String(row.origem_recurso || '')]),
  );
}

async function applyLiquidacoesImport(
  supabase: ReturnType<typeof createClient>,
  parsed: Extract<ParsedEmailCsvImport, { pipeline: 'liquidacoes' }>,
) {
  const empenhoFonteMap = await fetchEmpenhoFonteMap(supabase, parsed.empenhoNumbers);
  const updates = parsed.updates
    .map((update) => {
      const payload: Record<string, unknown> = {};
      if (update.empenhoNumero) {
        payload.empenho_numero = update.empenhoNumero;
      }

      const fonte = update.fonteSof || (update.empenhoNumero ? empenhoFonteMap.get(update.empenhoNumero) : '');
      if (fonte) {
        payload.fonte_sof = fonte;
      }

      return { id: update.documentoHabilId, payload };
    })
    .filter((update) => Object.keys(update.payload).length > 0);

  for (const chunk of chunkArray(updates, 50)) {
    await Promise.all(
      chunk.map(async (update) => {
        const { error } = await supabase.from('documentos_habeis').update(update.payload).eq('id', update.id);
        if (error) throw error;
      }),
    );
  }

  return {
    pipeline: 'liquidacoes' as const,
    rowsDetected: parsed.rowCount,
    rowsWritten: updates.length,
    tableStats: [{ table: 'documentos_habeis', rows: updates.length }],
  };
}

async function applyOrdensBancariasImport(
  supabase: ReturnType<typeof createClient>,
  parsed: Extract<ParsedEmailCsvImport, { pipeline: 'ordens_bancarias' }>,
) {
  const uniqueDocIds = Array.from(new Set(parsed.items.map((item) => item.documento_habil_id)));
  const validDocuments = await selectRowsByColumnValues(
    supabase,
    'documentos_habeis',
    'id',
    'id',
    uniqueDocIds,
  );
  const validIds = new Set(validDocuments.map((row) => String(row.id || '')));
  const items = parsed.items.filter((item) => validIds.has(item.documento_habil_id));

  if (items.length > 0) {
    await upsertInChunks(supabase, 'documentos_habeis_itens', items as unknown as Record<string, unknown>[], 'id');
  }

  const empenhoFonteMap = await fetchEmpenhoFonteMap(supabase, parsed.empenhoNumbers);
  const parentUpdates = parsed.parentUpdates
    .map((update) => ({
      id: update.documentoHabilId,
      payload: {
        empenho_numero: update.empenhoNumero,
        fonte_sof: update.empenhoNumero ? empenhoFonteMap.get(update.empenhoNumero) || null : null,
      },
    }))
    .filter((update) => Boolean(update.payload.empenho_numero || update.payload.fonte_sof));

  for (const chunk of chunkArray(parentUpdates, 50)) {
    await Promise.all(
      chunk.map(async (update) => {
        const { error } = await supabase.from('documentos_habeis').update(update.payload).eq('id', update.id);
        if (error) throw error;
      }),
    );
  }

  return {
    pipeline: 'ordens_bancarias' as const,
    rowsDetected: parsed.rowCount,
    rowsWritten: items.length + parentUpdates.length,
    tableStats: [
      { table: 'documentos_habeis_itens', rows: items.length },
      { table: 'documentos_habeis', rows: parentUpdates.length },
    ],
  };
}

async function applySituacoesImport(
  supabase: ReturnType<typeof createClient>,
  rows: Extract<ParsedEmailCsvImport, { pipeline: 'situacoes_documentos' }>['rows'],
) {
  await upsertInChunks(
    supabase,
    'documentos_habeis_situacoes',
    rows as unknown as Record<string, unknown>[],
    'documento_habil_id,situacao_codigo,valor',
  );

  return {
    pipeline: 'situacoes_documentos' as const,
    rowsDetected: rows.length,
    rowsWritten: rows.length,
    tableStats: [{ table: 'documentos_habeis_situacoes', rows: rows.length }],
  };
}

async function applyCreditosDisponiveisImport(
  supabase: ReturnType<typeof createClient>,
  rows: CreditoDisponivelImportRow[],
) {
  const timestamp = new Date().toISOString();
  const payload = rows.map((row) => ({
    ptres: row.ptres,
    metrica: row.metrica,
    valor: row.valor,
    updated_at: timestamp,
  }));

  await upsertInChunks(supabase, 'creditos_disponiveis', payload, 'ptres');

  return {
    pipeline: 'creditos_disponiveis' as const,
    rowsDetected: rows.length,
    rowsWritten: payload.length,
    tableStats: [{ table: 'creditos_disponiveis', rows: payload.length }],
  };
}

async function fetchExistingEmpenhosMap(
  supabase: ReturnType<typeof createClient>,
  numeros: string[],
) {
  if (!numeros.length) return new Map<string, { id: string; tipo: string; status: string }>();

  const rows = await selectRowsByColumnValues(supabase, 'empenhos', 'id, numero, tipo, status', 'numero', numeros);
  return new Map(
    rows.map((row) => [
      String(row.numero || ''),
      { id: String(row.id || ''), tipo: String(row.tipo || ''), status: String(row.status || '') },
    ]),
  );
}

function getRapSaldoAjustado(rapAPagar: number, valorLiquidadoAPagar: number) {
  return Math.max(0, rapAPagar - valorLiquidadoAPagar);
}

function getImportedRapSaldo(item: Pick<SiafiEmpenhoData, 'saldoRapOficial' | 'rapAPagar' | 'valorLiquidadoAPagar'>) {
  return item.saldoRapOficial != null
    ? Math.max(0, item.saldoRapOficial)
    : getRapSaldoAjustado(item.rapAPagar, item.valorLiquidadoAPagar);
}

function getRapStatus(
  item: Pick<SiafiEmpenhoData, 'rapSaldoOnly' | 'saldoRapOficial' | 'rapAPagar' | 'rapPago' | 'valorLiquidadoAPagar'>,
  existingStatus?: string,
) {
  if (item.rapSaldoOnly) {
    const saldoAtual = getImportedRapSaldo(item);
    if (saldoAtual <= 0) return 'pago';
    if (existingStatus === 'liquidado') return 'liquidado';
    return 'pendente';
  }

  const saldoAjustado = getImportedRapSaldo(item);
  const houvePagamento = item.rapPago > 0;
  const houveLiquidacao = houvePagamento || item.valorLiquidadoAPagar > 0;

  if (saldoAjustado <= 0 && houvePagamento) return 'pago';
  if (houveLiquidacao) return 'liquidado';
  return 'pendente';
}

async function applySiafiEmpenhosImport(
  supabase: ReturnType<typeof createClient>,
  rows: SiafiEmpenhoData[],
) {
  const existingEmpenhos = await fetchExistingEmpenhosMap(
    supabase,
    rows.map((row) => row.numeroResumido),
  );

  const ultimaAtualizacaoSiafi = createSiafiUploadTimestamp();
  const updates: Array<{ id: string; payload: Record<string, unknown> }> = [];
  const inserts: Record<string, unknown>[] = [];

  rows.forEach((item) => {
    const existing = existingEmpenhos.get(item.numeroResumido);
    if (existing) {
      const payload: Record<string, unknown> = {
        ultima_atualizacao_siafi: ultimaAtualizacaoSiafi,
      };

      if (!item.rapSaldoOnly) {
        payload.valor_liquidado_oficial = item.valorLiquidadoOficial;
        payload.valor_pago_oficial = item.valorPagoOficial;
        payload.valor_liquidado_a_pagar = item.valorLiquidadoAPagar;
      }

      if (item.isRap) {
        payload.tipo = 'rap';
        payload.saldo_rap_oficial = getImportedRapSaldo(item);
        payload.status = getRapStatus(item, existing.status);

        if (!item.rapSaldoOnly) {
          payload.rap_inscrito = item.rapInscrito;
          payload.rap_a_liquidar = item.rapALiquidar;
          payload.rap_liquidado = item.rapLiquidado;
          payload.rap_pago = item.rapPago;
          payload.valor = item.rapInscrito;
        }
      } else {
        payload.valor = item.valorEmpenhado;
        payload.valor_liquidado = item.valorLiquidadoOficial;
        payload.status =
          item.valorPagoOficial > 0 && item.valorPagoOficial >= item.valorEmpenhado
            ? 'pago'
            : item.valorLiquidadoOficial > 0 && item.valorLiquidadoOficial >= item.valorEmpenhado
              ? 'liquidado'
              : 'pendente';
      }

      if (item.descricao) payload.descricao = item.descricao;
      if (item.processo) payload.processo = item.processo;
      if (item.favorecidoNome) payload.favorecido_nome = item.favorecidoNome;
      if (item.favorecidoDocumento) payload.favorecido_documento = item.favorecidoDocumento;
      if (item.naturezaDespesa) payload.natureza_despesa = item.naturezaDespesa;
      if (item.planoInterno) payload.plano_interno = item.planoInterno;
      if (item.ptres) payload.origem_recurso = item.ptres;

      updates.push({ id: existing.id, payload });
      return;
    }

    const status =
      item.valorPagoOficial > 0 && item.valorPagoOficial >= item.valorEmpenhado
        ? 'pago'
        : item.valorLiquidadoOficial > 0 && item.valorLiquidadoOficial >= item.valorEmpenhado
          ? 'liquidado'
          : 'pendente';

    inserts.push({
      numero: item.numeroResumido,
      descricao: item.descricao || `Empenho ${item.numeroResumido}`,
      valor: item.isRap ? (item.rapSaldoOnly ? getImportedRapSaldo(item) : item.rapInscrito) : item.valorEmpenhado,
      dimensao: '',
      componente_funcional: '',
      origem_recurso: item.ptres || '',
      natureza_despesa: item.naturezaDespesa || '',
      plano_interno: item.planoInterno || null,
      favorecido_nome: item.favorecidoNome || null,
      favorecido_documento: item.favorecidoDocumento || null,
      processo: item.processo || null,
      data_empenho: `${item.numeroResumido.substring(0, 4)}-01-01`,
      status: item.isRap ? getRapStatus(item) : status,
      tipo: item.isRap ? 'rap' : 'exercicio',
      rap_inscrito: item.isRap ? (item.rapSaldoOnly ? getImportedRapSaldo(item) : item.rapInscrito) : null,
      rap_a_liquidar: item.isRap ? (item.rapSaldoOnly ? null : item.rapALiquidar) : null,
      rap_liquidado: item.isRap ? (item.rapSaldoOnly ? null : item.rapLiquidado) : null,
      rap_pago: item.isRap ? (item.rapSaldoOnly ? null : item.rapPago) : null,
      valor_liquidado: item.isRap ? null : item.valorLiquidadoOficial,
      valor_liquidado_a_pagar: item.isRap && item.rapSaldoOnly ? null : item.valorLiquidadoAPagar,
      valor_liquidado_oficial: item.isRap && item.rapSaldoOnly ? null : item.valorLiquidadoOficial,
      valor_pago_oficial: item.isRap && item.rapSaldoOnly ? null : item.valorPagoOficial,
      saldo_rap_oficial: item.isRap ? getImportedRapSaldo(item) : null,
      ultima_atualizacao_siafi: ultimaAtualizacaoSiafi,
    });
  });

  for (const chunk of chunkArray(updates, 25)) {
    await Promise.all(
      chunk.map(async (update) => {
        const { error } = await supabase.from('empenhos').update(update.payload).eq('id', update.id);
        if (error) throw error;
      }),
    );
  }

  if (inserts.length > 0) {
    await insertInChunks(supabase, 'empenhos', inserts);
  }

  return {
    pipeline: 'siafi_empenhos' as const,
    rowsDetected: rows.length,
    rowsWritten: updates.length + inserts.length,
    tableStats: [{ table: 'empenhos', rows: updates.length + inserts.length }],
  };
}

async function applyParsedImport(
  supabase: ReturnType<typeof createClient>,
  parsed: ParsedEmailCsvImport,
  sourceFile: string,
): Promise<ProcessingResult> {
  switch (parsed.pipeline) {
    case 'financeiro':
      return await applyFinanceiroImport(supabase, parsed.rows, sourceFile);
    case 'lc':
      return await applyLcImport(supabase, parsed.rows, sourceFile);
    case 'retencoes_efd_reinf':
      return await applyRetencoesEfdReinfImport(supabase, parsed.rows, sourceFile);
    case 'descentralizacoes':
      return await applyDescentralizacoesImport(supabase, parsed.rows);
    case 'documentos_habeis':
      return await applyDocumentosHabeisImport(supabase, parsed);
    case 'liquidacoes':
      return await applyLiquidacoesImport(supabase, parsed);
    case 'ordens_bancarias':
      return await applyOrdensBancariasImport(supabase, parsed);
    case 'situacoes_documentos':
      return await applySituacoesImport(supabase, parsed.rows);
    case 'creditos_disponiveis':
      return await applyCreditosDisponiveisImport(supabase, parsed.rows);
    case 'siafi_empenhos':
      return await applySiafiEmpenhosImport(supabase, parsed.rows);
  }
}

function assertSharedSecret(request: Request) {
  const expectedSecret = requireEnv('EMAIL_CSV_INGEST_SECRET');
  const providedSecret = request.headers.get('x-email-ingest-secret');

  if (!providedSecret || providedSecret !== expectedSecret) {
    throw new Response(
      JSON.stringify({ error: 'Segredo de ingestao ausente ou invalido.' }),
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

function assertAllowedSender(requestBody: EmailCsvIngestionRequest) {
  const configured = Deno.env.get('EMAIL_CSV_ALLOWED_SENDERS');
  if (!configured) return;

  const allowed = configured
    .split(',')
    .map((value) => extractEmailAddress(value))
    .filter(Boolean);

  const sender = extractEmailAddress(requestBody.from || '');
  if (!allowed.includes(sender)) {
    throw new Response(
      JSON.stringify({ error: `Remetente ${requestBody.from || 'desconhecido'} nao autorizado.` }),
      {
        status: 403,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Metodo nao suportado.' }, 405);
  }

  let runId: string | null = null;

  try {
    assertSharedSecret(request);

    const body = (await request.json()) as EmailCsvIngestionRequest;
    if (!body?.messageId || !body?.attachment?.fileName || !body?.attachment?.contentBase64) {
      return jsonResponse(
        { error: 'Envie messageId e attachment com fileName e contentBase64.' },
        400,
      );
    }

    assertAllowedSender(body);

    const supabaseUrl = requireEnv('SUPABASE_URL');
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const attachmentBytes = decodeBase64(body.attachment.contentBase64);
    const attachmentHash = await sha256Hex(attachmentBytes);

    const { data: existingRun, error: existingRunError } = await supabase
      .from('email_csv_ingestion_runs')
      .select('id, status, pipeline, rows_detected, rows_written, processed_at')
      .eq('message_id', body.messageId)
      .eq('attachment_sha256', attachmentHash)
      .maybeSingle();

    if (existingRunError) throw existingRunError;

    if (existingRun) {
      return jsonResponse({
        status: 'skipped',
        reason: 'duplicate_attachment',
        runId: existingRun.id,
        previousStatus: existingRun.status,
        pipeline: existingRun.pipeline,
        rowsDetected: existingRun.rows_detected,
        rowsWritten: existingRun.rows_written,
        processedAt: existingRun.processed_at,
      });
    }

    const { data: createdRun, error: createdRunError } = await supabase
      .from('email_csv_ingestion_runs')
      .insert({
        message_id: body.messageId,
        thread_id: body.threadId || null,
        sender_email: extractEmailAddress(body.from || ''),
        subject: body.subject || null,
        received_at: body.receivedAt || null,
        attachment_name: body.attachment.fileName,
        attachment_mime_type: body.attachment.mimeType || null,
        attachment_sha256: attachmentHash,
        status: 'processing',
        metadata: {
          to: body.to || null,
          gmailLabels: body.gmailLabels || [],
          pipelineHint: body.pipelineHint || 'auto',
        },
      })
      .select('id')
      .single();

    if (createdRunError) throw createdRunError;
    runId = String(createdRun.id);

    const sourceFile = `email:${body.attachment.fileName}`;
    const parsed = parseEmailCsvImport({
      fileName: body.attachment.fileName,
      text: decodeCsvBytes(attachmentBytes),
      pipelineHint: body.pipelineHint || 'auto',
      subject: body.subject,
    });

    const result = await applyParsedImport(supabase, parsed, sourceFile);

    await updateRun(supabase, runId, {
      pipeline: result.pipeline,
      status: 'succeeded' satisfies IngestionRunStatus,
      rows_detected: result.rowsDetected,
      rows_written: result.rowsWritten,
      processed_at: new Date().toISOString(),
      metadata: {
        to: body.to || null,
        gmailLabels: body.gmailLabels || [],
        pipelineHint: body.pipelineHint || 'auto',
        tableStats: result.tableStats,
      },
    });

    return jsonResponse({
      status: 'processed',
      runId,
      pipeline: result.pipeline,
      rowsDetected: result.rowsDetected,
      rowsWritten: result.rowsWritten,
      tableStats: result.tableStats,
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    if (runId) {
      try {
        const supabaseUrl = requireEnv('SUPABASE_URL');
        const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
        const supabase = createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        await updateRun(supabase, runId, {
          status: 'failed' satisfies IngestionRunStatus,
          error_message: error instanceof Error ? error.message : 'Falha inesperada na ingestao.',
          processed_at: new Date().toISOString(),
        });
      } catch (updateError) {
        console.error('ingest-email-csv:updateRun', updateError);
      }
    }

    console.error('ingest-email-csv', error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Falha inesperada ao processar o CSV recebido por e-mail.',
        runId,
      },
      500,
    );
  }
});
