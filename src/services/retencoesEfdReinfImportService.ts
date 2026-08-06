import * as XLSX from 'xlsx';
import { endOfMonth, format, isValid, parse, parseISO } from 'date-fns';

import { supabase } from '@/lib/supabase';
import { splitCsvLine } from '@/utils/csvParser';

export interface RetencaoEfdReinfRegistro {
  id?: string;
  sourceIndex: number;
  documentoHabil: string;
  dhProcesso: string;
  dhEstado: string;
  dhUgPagadora: string;
  dhItemUgPagadora: string;
  dhCredorDocumento: string;
  dhCredorNome: string;
  dhSituacao: string;
  dhDataEmissaoDocOrigem: string | null;
  dhDiaPagamento: string | null;
  dhItemDiaVencimento: string | null;
  dhItemDiaPagamento: string | null;
  dhItemLiquidado: boolean | null;
  dhValorDocOrigem: number;
  metrica: string;
  valorRetencao: number;
  correcaoRealizada: boolean;
}

export type RetencaoEfdReinfPaymentDateSource = 'ob' | 'dh' | 'missing-ob';

type RetencaoEfdReinfDbRow = {
  id: string;
  source_index: number;
  documento_habil: string;
  dh_processo: string | null;
  dh_estado: string | null;
  dh_ug_pagadora: string | null;
  dh_item_ug_pagadora: string | null;
  dh_credor_documento: string | null;
  dh_credor_nome: string | null;
  dh_situacao: string | null;
  dh_data_emissao_doc_origem: string | null;
  dh_dia_pagamento: string | null;
  dh_item_dia_vencimento: string | null;
  dh_item_dia_pagamento: string | null;
  dh_item_liquidado: boolean | null;
  dh_valor_doc_origem: number | null;
  metrica: string | null;
  valor_retencao: number | null;
  source_file: string | null;
  imported_at: string;
  correcao_realizada?: boolean | null;
};

type RetencaoEfdReinfObRow = {
  id: string;
  documento_habil_id: string | null;
  data_emissao: string | null;
  observacao: string | null;
};

const SITUACOES_IGNORADAS_REGRA_UG_CRITICA = new Set(['DDR001', 'DGR001']);
const SITUACOES_PRAZO_GRUPO_DDF025 = new Set(['DDF025', 'DDF055']);
const SITUACOES_PRAZO_GRUPO_DDF021 = new Set(['DDF021', 'DDF050']);
const LOCAL_CORRECTION_STORAGE_KEY = 'retencoes-efd-reinf:correcoes-realizadas';

export type RetencaoEfdReinfValidation = {
  severity: 'ok' | 'warning' | 'critical';
  hasCriticalUgPagadora: boolean;
  hasWarningPrazo: boolean;
  expectedDate: string | null;
  expectedRule: 'DDF025' | 'DDF055' | 'DDF021' | 'DDF050' | null;
  paymentDateSource: RetencaoEfdReinfPaymentDateSource;
  paymentDateUsed: string | null;
  paymentObNumber: string | null;
  percentualRetencao: number | null;
  issues: string[];
};

export type RetencaoEfdReinfObPaymentInfo = {
  date: string;
  obNumber: string;
};

export type RetencaoEfdReinfValidationOptions = {
  obPaymentDates?: Map<string, string | RetencaoEfdReinfObPaymentInfo> | Record<string, string | RetencaoEfdReinfObPaymentInfo>;
};

function parseCurrencyBR(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;

  const normalized = String(value).replace(/\./g, '').replace(',', '.').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function decodeCsvBuffer(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes);
  }

  const utf8Text = new TextDecoder('utf-8').decode(bytes);
  if (utf8Text.includes('\ufffd')) {
    return new TextDecoder('latin1').decode(bytes);
  }

  return utf8Text;
}

async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const arrayBuffer = await file.arrayBuffer();
  const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type.includes('csv');

  if (isCsv) {
    const text = decodeCsvBuffer(arrayBuffer).replace(/^\uFEFF/, '');
    const delimiter = text.includes('\t') ? '\t' : text.includes(';') ? ';' : ',';
    return XLSX.read(text, { type: 'string', raw: false, FS: delimiter });
  }

  return XLSX.read(arrayBuffer, { type: 'array' });
}

async function readCsvRows(file: File): Promise<string[][]> {
  const arrayBuffer = await file.arrayBuffer();
  const text = decodeCsvBuffer(arrayBuffer)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return [];

  // Detecta o delimitador buscando na linha do cabeçalho ou nas primeiras linhas
  const sample = lines.slice(0, 10).join('\n');
  const delimiter = sample.includes('\t') ? '\t' : sample.includes(';') ? ';' : ',';

  return lines.map((line) => splitCsvLine(line, delimiter));
}

function normalizeHeader(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/["']/g, '')
    .replace(/\?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return format(new Date(parsed.y, parsed.m - 1, parsed.d), 'yyyy-MM-dd');
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const date = raw.includes('/')
    ? parse(raw, 'dd/MM/yyyy', new Date())
    : parseISO(raw);

  if (!isValid(date)) return null;
  return format(date, 'yyyy-MM-dd');
}

function normalizeDocumentoHabilId(value?: string | null) {
  const trimmed = String(value || '').trim();
  return trimmed.length > 12 ? trimmed.slice(-12).toUpperCase() : trimmed.toUpperCase();
}

function formatDateBr(value?: string | null) {
  if (!value) return '-';
  const parsed = parseISO(value);
  return isValid(parsed) ? format(parsed, 'dd/MM/yyyy') : value;
}

function getExpectedNextMonthDay20(baseDate?: string | null) {
  if (!baseDate) return null;

  const parsed = parseISO(baseDate);
  if (!isValid(parsed)) return null;

  const nextMonth = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 20);
  const cappedDate = endOfMonth(nextMonth).getDate() < 20
    ? endOfMonth(nextMonth)
    : nextMonth;

  return format(cappedDate, 'yyyy-MM-dd');
}

function isDateWithinPaymentWindow(value?: string | null, startDate?: string | null, endDate?: string | null) {
  return Boolean(value && startDate && endDate && value >= startDate && value <= endDate);
}

function toBooleanLiquidado(value: unknown): boolean | null {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
  if (!normalized) return null;
  if (normalized === 'SIM' || normalized === 'S') return true;
  if (normalized === 'NAO' || normalized === 'N') return false;
  return null;
}

function normalizeText(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function isMissingCorrectionColumnError(error: unknown) {
  const maybeError = error as { message?: string; details?: string; hint?: string; code?: string } | null | undefined;
  const text = [
    maybeError?.message,
    maybeError?.details,
    maybeError?.hint,
    maybeError?.code,
  ].filter(Boolean).join(' ').toLowerCase();

  return text.includes('correcao_realizada') || text.includes('schema cache') || text.includes('pgrst204') || text.includes('42703');
}

function readLocalCorrections(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_CORRECTION_STORAGE_KEY);
    return raw ? JSON.parse(raw) as Record<string, boolean> : {};
  } catch {
    return {};
  }
}

function getLocalCorrection(id?: string | null) {
  if (!id) return false;
  return readLocalCorrections()[id] === true;
}

function setLocalCorrection(id: string, correcaoRealizada: boolean) {
  if (typeof window === 'undefined') return;
  const corrections = readLocalCorrections();
  if (correcaoRealizada) {
    corrections[id] = true;
  } else {
    delete corrections[id];
  }
  window.localStorage.setItem(LOCAL_CORRECTION_STORAGE_KEY, JSON.stringify(corrections));
}

function isObPagamentoPrincipal(row: RetencaoEfdReinfObRow) {
  const observacao = normalizeText(row.observacao);
  const indicaPagamento = /\b(PGTO|PAGAMENTO)\b/.test(observacao);
  const indicaRetencao = /\bRETENCAO\b/.test(observacao);
  return indicaPagamento && !indicaRetencao;
}

function getPaymentDateFromOptions(
  documentoHabil: string,
  options?: RetencaoEfdReinfValidationOptions,
) {
  const dates = options?.obPaymentDates;
  if (!dates) return undefined;

  const normalized = normalizeDocumentoHabilId(documentoHabil);
  const value = dates instanceof Map
    ? dates.get(documentoHabil) || dates.get(normalized)
    : dates[documentoHabil] || dates[normalized];

  if (!value) return undefined;
  return typeof value === 'string' ? { date: value, obNumber: '' } : value;
}

export async function parseRetencoesEfdReinfCsv(file: File): Promise<RetencaoEfdReinfRegistro[]> {
  const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type.includes('csv');
  const normalizedRows = isCsv
    ? ((await readCsvRows(file)) as unknown[][])
    : (() => {
        throw new Error('Arquivos XLSX ainda nao foram habilitados para este modulo.');
      })();

  const headerRowIndex = normalizedRows.findIndex((row) => {
    const normalized = row.map(normalizeHeader);
    return normalized.includes('documento habil') && normalized.some((col) => col.includes('situacao'));
  });

  if (headerRowIndex === -1) {
    throw new Error('Nao foi possivel localizar o cabecalho do arquivo de retencoes EFD-Reinf.');
  }

  const rawHeaders = normalizedRows[headerRowIndex].map(normalizeHeader);
  const docHabilIdx = rawHeaders.findIndex((h) => h.includes('documento habil'));
  const processoIdx = rawHeaders.findIndex((h) => h.includes('processo'));
  const estadoIdx = rawHeaders.findIndex((h) => h.includes('estado'));
  const ugPagadoraIdx = rawHeaders.findIndex((h) => h === 'dh - ug pagadora' || h === 'ug pagadora');
  const itemUgPagadoraIdx = rawHeaders.findIndex((h) => h.includes('item') && h.includes('ug pagadora'));
  const credorDocIdx = rawHeaders.findIndex((h) => h.includes('credor') && !h.includes('nome'));

  // Se o cabeçalho tem uma coluna vazia logo após Credor, essa coluna em branco é o Credor Nome
  let credorNomeIdx = rawHeaders.findIndex((h) => h.includes('credor') && h.includes('nome'));
  if (credorNomeIdx === -1 && credorDocIdx !== -1 && rawHeaders[credorDocIdx + 1] === '') {
    credorNomeIdx = credorDocIdx + 1;
  }

  const situacaoIdx = rawHeaders.findIndex((h) => h.includes('situacao'));
  const emissaoIdx = rawHeaders.findIndex((h) => h.includes('emissao'));
  const diaPgtoIdx = rawHeaders.findIndex((h) => h.includes('dia pagamento') && !h.includes('item'));
  const itemVencimentoIdx = rawHeaders.findIndex((h) => h.includes('item') && h.includes('vencimento'));
  const itemPgtoIdx = rawHeaders.findIndex((h) => h.includes('item') && h.includes('pagamento'));
  const itemLiquidadoIdx = rawHeaders.findIndex((h) => h.includes('liquidado'));
  const valorDocOrigemIdx = rawHeaders.findIndex((h) => h.includes('valor doc') || h.includes('valor doc.origem'));
  const metricaIdx = rawHeaders.findIndex((h) => h.includes('metrica'));
  
  // O valor da retenção pode ser uma coluna chamada "valor retencao" ou a última coluna (inclusive se o cabeçalho estiver vazio no final)
  let valorRetencaoIdx = rawHeaders.findIndex((h) => h.includes('retencao') || h.includes('retida'));

  return normalizedRows
    .slice(headerRowIndex + 1)
    .map((row, index): RetencaoEfdReinfRegistro | null => {
      const getVal = (idx: number) => (idx >= 0 && idx < row.length ? String(row[idx] || '').trim() : '');

      const documentoHabil = docHabilIdx >= 0 ? getVal(docHabilIdx) : String(row[0] || '').trim();
      if (!documentoHabil) return null;

      // Se valorRetencaoIdx não foi identificado no cabeçalho, tenta usar a última coluna que contém valor numérico
      let rawValorRetencao = valorRetencaoIdx >= 0 ? getVal(valorRetencaoIdx) : '';
      if (!rawValorRetencao && row.length > 15) {
        rawValorRetencao = String(row[15] || '').trim();
      }
      if (!rawValorRetencao && row.length > 0) {
        rawValorRetencao = String(row[row.length - 1] || '').trim();
      }

      return {
        sourceIndex: index + 1,
        documentoHabil,
        dhProcesso: getVal(processoIdx >= 0 ? processoIdx : 1),
        dhEstado: getVal(estadoIdx >= 0 ? estadoIdx : 2),
        dhUgPagadora: getVal(ugPagadoraIdx >= 0 ? ugPagadoraIdx : 3),
        dhItemUgPagadora: getVal(itemUgPagadoraIdx >= 0 ? itemUgPagadoraIdx : 4),
        dhCredorDocumento: getVal(credorDocIdx >= 0 ? credorDocIdx : 5),
        dhCredorNome: getVal(credorNomeIdx >= 0 ? credorNomeIdx : 6),
        dhSituacao: getVal(situacaoIdx >= 0 ? situacaoIdx : 7).toUpperCase(),
        dhDataEmissaoDocOrigem: toIsoDate(getVal(emissaoIdx >= 0 ? emissaoIdx : 8)),
        dhDiaPagamento: toIsoDate(getVal(diaPgtoIdx >= 0 ? diaPgtoIdx : 9)),
        dhItemDiaVencimento: toIsoDate(getVal(itemVencimentoIdx >= 0 ? itemVencimentoIdx : 10)),
        dhItemDiaPagamento: toIsoDate(getVal(itemPgtoIdx >= 0 ? itemPgtoIdx : 11)),
        dhItemLiquidado: toBooleanLiquidado(getVal(itemLiquidadoIdx >= 0 ? itemLiquidadoIdx : 12)),
        dhValorDocOrigem: parseCurrencyBR(getVal(valorDocOrigemIdx >= 0 ? valorDocOrigemIdx : 13)),
        metrica: getVal(metricaIdx >= 0 ? metricaIdx : 14),
        valorRetencao: parseCurrencyBR(rawValorRetencao),
        correcaoRealizada: false,
      };
    })
    .filter((item): item is RetencaoEfdReinfRegistro => item !== null);
}

export function validateRetencaoEfdReinfRow(
  row: RetencaoEfdReinfRegistro,
  options?: RetencaoEfdReinfValidationOptions,
): RetencaoEfdReinfValidation {
  const issues: string[] = [];
  const itemUgPagadora = (row.dhItemUgPagadora || '').replace(/\D/g, '');
  const situacao = row.dhSituacao.trim().toUpperCase();
  const shouldIgnoreUgCritica = SITUACOES_IGNORADAS_REGRA_UG_CRITICA.has(situacao);
  const hasCriticalUgPagadora = !shouldIgnoreUgCritica && itemUgPagadora !== '158366';

  let expectedRule: 'DDF025' | 'DDF055' | 'DDF021' | 'DDF050' | null = null;
  let expectedDate: string | null = null;
  let hasWarningPrazo = false;
  let paymentDateSource: RetencaoEfdReinfPaymentDateSource = 'dh';
  let paymentDateUsed: string | null = null;

  if (SITUACOES_PRAZO_GRUPO_DDF025.has(situacao)) {
    expectedRule = situacao as 'DDF025' | 'DDF055';
    paymentDateSource = 'dh';
    paymentDateUsed = row.dhDiaPagamento;
    expectedDate = getExpectedNextMonthDay20(paymentDateUsed);

    hasWarningPrazo =
      !expectedDate ||
      !isDateWithinPaymentWindow(row.dhItemDiaVencimento, paymentDateUsed, expectedDate) ||
      !isDateWithinPaymentWindow(row.dhItemDiaPagamento, paymentDateUsed, expectedDate);
    if (hasWarningPrazo) {
      issues.push(`${expectedRule} deve vencer e pagar entre DH - Dia Pagamento e o dia 20 do mes seguinte.`);
    }
  }

  if (SITUACOES_PRAZO_GRUPO_DDF021.has(situacao)) {
    expectedRule = situacao as 'DDF021' | 'DDF050';
    paymentDateSource = 'dh';
    paymentDateUsed = row.dhDiaPagamento;
    expectedDate = getExpectedNextMonthDay20(paymentDateUsed);
    hasWarningPrazo =
      !expectedDate ||
      !isDateWithinPaymentWindow(row.dhItemDiaVencimento, paymentDateUsed, expectedDate) ||
      !isDateWithinPaymentWindow(row.dhItemDiaPagamento, paymentDateUsed, expectedDate);
    if (hasWarningPrazo) {
      issues.push(`${expectedRule} deve vencer e pagar entre DH - Dia Pagamento e o dia 20 do mes seguinte.`);
    }
  }

  if (hasCriticalUgPagadora) {
    issues.unshift('DH Item - UG Pagadora deve ser 158366.');
  }

  const percentualRetencao =
    row.dhValorDocOrigem > 0 ? (row.valorRetencao / row.dhValorDocOrigem) * 100 : null;

  return {
    severity: hasCriticalUgPagadora ? 'critical' : hasWarningPrazo ? 'warning' : 'ok',
    hasCriticalUgPagadora,
    hasWarningPrazo,
    expectedDate,
    expectedRule,
    paymentDateSource,
    paymentDateUsed,
    paymentObNumber: getPaymentDateFromOptions(row.documentoHabil, options)?.obNumber || null,
    percentualRetencao,
    issues,
  };
}

function aggregateForUpsert(rows: RetencaoEfdReinfRegistro[]) {
  const map = new Map<string, RetencaoEfdReinfRegistro>();

  for (const row of rows) {
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
  }

  return Array.from(map.values());
}

function dbRowToRegistro(row: RetencaoEfdReinfDbRow): RetencaoEfdReinfRegistro {
  return {
    id: row.id,
    sourceIndex: row.source_index,
    documentoHabil: row.documento_habil,
    dhProcesso: row.dh_processo || '',
    dhEstado: row.dh_estado || '',
    dhUgPagadora: row.dh_ug_pagadora || '',
    dhItemUgPagadora: row.dh_item_ug_pagadora || '',
    dhCredorDocumento: row.dh_credor_documento || '',
    dhCredorNome: row.dh_credor_nome || '',
    dhSituacao: row.dh_situacao || '',
    dhDataEmissaoDocOrigem: row.dh_data_emissao_doc_origem,
    dhDiaPagamento: row.dh_dia_pagamento,
    dhItemDiaVencimento: row.dh_item_dia_vencimento,
    dhItemDiaPagamento: row.dh_item_dia_pagamento,
    dhItemLiquidado: row.dh_item_liquidado,
    dhValorDocOrigem: Number(row.dh_valor_doc_origem || 0),
    metrica: row.metrica || '',
    valorRetencao: Number(row.valor_retencao || 0),
    correcaoRealizada: row.correcao_realizada === undefined ? getLocalCorrection(row.id) : row.correcao_realizada === true,
  };
}

export async function saveRetencoesEfdReinfRows(rows: RetencaoEfdReinfRegistro[], sourceFile: string) {
  if (!rows.length) return;

  const importedAt = new Date().toISOString();
  const payload = aggregateForUpsert(rows).map((row) => ({
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

  const { error } = await supabase
    .from('retencoes_efd_reinf')
    .upsert(payload, {
      onConflict: 'documento_habil,dh_processo,dh_situacao,dh_credor_documento,dh_dia_pagamento,valor_retencao',
    });

  if (error) throw error;
}

export async function loadLatestRetencoesEfdReinfRowsFromDb(): Promise<{
  rows: RetencaoEfdReinfRegistro[];
  sourceFile: string;
  importedAt: string | null;
}> {
  const { data: latest, error: latestError } = await supabase
    .from('retencoes_efd_reinf')
    .select('imported_at, source_file')
    .order('imported_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw latestError;
  if (!latest?.imported_at) {
    return { rows: [], sourceFile: '', importedAt: null };
  }

  const baseColumns = `
    source_index,
    id,
    documento_habil,
    dh_processo,
    dh_estado,
    dh_ug_pagadora,
    dh_item_ug_pagadora,
    dh_credor_documento,
    dh_credor_nome,
    dh_situacao,
    dh_data_emissao_doc_origem,
    dh_dia_pagamento,
    dh_item_dia_vencimento,
    dh_item_dia_pagamento,
    dh_item_liquidado,
    dh_valor_doc_origem,
    metrica,
    valor_retencao,
    source_file,
    imported_at
  `;

  const loadRows = (columns: string) => supabase
    .from('retencoes_efd_reinf')
    .select(columns)
    .eq('imported_at', latest.imported_at)
    .order('source_index', { ascending: true });

  let { data: rows, error: rowsError } = await loadRows(`${baseColumns}, correcao_realizada`);
  if (rowsError && isMissingCorrectionColumnError(rowsError)) {
    const fallback = await loadRows(baseColumns);
    rows = fallback.data;
    rowsError = fallback.error;
  }

  if (rowsError) throw rowsError;

  return {
    rows: ((rows || []) as RetencaoEfdReinfDbRow[]).map(dbRowToRegistro),
    sourceFile: latest.source_file || '',
    importedAt: latest.imported_at,
  };
}

export async function loadRetencoesEfdReinfObPaymentDates(
  rows: RetencaoEfdReinfRegistro[],
): Promise<Map<string, RetencaoEfdReinfObPaymentInfo>> {
  const documentoIds = Array.from(new Set(rows.map((row) => normalizeDocumentoHabilId(row.documentoHabil)).filter(Boolean)));
  if (!documentoIds.length) return new Map();

  const { data, error } = await supabase
    .from('documentos_habeis_itens')
    .select('id, documento_habil_id, data_emissao, observacao')
    .in('documento_habil_id', documentoIds)
    .eq('doc_tipo', 'OB')
    .order('data_emissao', { ascending: true });

  if (error) throw error;

  const grouped = new Map<string, RetencaoEfdReinfObRow[]>();
  for (const row of ((data || []) as RetencaoEfdReinfObRow[])) {
    const documentoId = normalizeDocumentoHabilId(row.documento_habil_id);
    if (!documentoId || !row.data_emissao) continue;
    const existing = grouped.get(documentoId) || [];
    existing.push(row);
    grouped.set(documentoId, existing);
  }

  const paymentDates = new Map<string, RetencaoEfdReinfObPaymentInfo>();
  for (const [documentoId, obRows] of grouped.entries()) {
    const sortedRows = [...obRows].sort((left, right) => {
      const leftDate = toIsoDate(left.data_emissao) || '';
      const rightDate = toIsoDate(right.data_emissao) || '';
      if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
      return left.id.localeCompare(right.id);
    });
    const selected = sortedRows.find(isObPagamentoPrincipal) || sortedRows[0];
    const paymentDate = toIsoDate(selected.data_emissao);
    if (paymentDate) paymentDates.set(documentoId, { date: paymentDate, obNumber: selected.id });
  }

  return paymentDates;
}

export async function updateRetencaoEfdReinfCorrecaoRealizada(
  id: string,
  correcaoRealizada: boolean,
): Promise<'remote' | 'local'> {
  const { error } = await supabase
    .from('retencoes_efd_reinf')
    .update({ correcao_realizada: correcaoRealizada, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    if (isMissingCorrectionColumnError(error)) {
      setLocalCorrection(id, correcaoRealizada);
      return 'local';
    }
    throw error;
  }

  return 'remote';
}

export function formatRetencaoEfdReinfDate(value?: string | null) {
  return formatDateBr(value);
}

