import * as XLSX from 'xlsx';
import { endOfMonth, format, isValid, parse, parseISO } from 'date-fns';

import { supabase } from '@/lib/supabase';
import { splitCsvLine } from '@/utils/csvParser';

export interface RetencaoEfdReinfRegistro {
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
}

type RetencaoEfdReinfDbRow = {
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
};

export type RetencaoEfdReinfValidation = {
  severity: 'ok' | 'warning' | 'critical';
  hasCriticalUgPagadora: boolean;
  hasWarningPrazo: boolean;
  expectedDate: string | null;
  expectedRule: 'DDF025' | 'DDF021' | null;
  percentualRetencao: number | null;
  issues: string[];
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

  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .map((line) => splitCsvLine(line, '\t'));
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

function sameIsoDate(first?: string | null, second?: string | null) {
  return Boolean(first && second && first === second);
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

export async function parseRetencoesEfdReinfCsv(file: File): Promise<RetencaoEfdReinfRegistro[]> {
  const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type.includes('csv');
  const normalizedRows = isCsv
    ? ((await readCsvRows(file)) as unknown[][])
    : (() => {
        throw new Error('Arquivos XLSX ainda nao foram habilitados para este modulo.');
      })();

  const headerRowIndex = normalizedRows.findIndex((row) => {
    const normalized = row.map(normalizeHeader);
    return normalized.includes('documento habil') && normalized.includes('dh - situacao');
  });

  if (headerRowIndex === -1) {
    throw new Error('Nao foi possivel localizar o cabecalho do arquivo de retencoes EFD-Reinf.');
  }

  return normalizedRows
    .slice(headerRowIndex + 1)
    .map((row, index): RetencaoEfdReinfRegistro | null => {
      const documentoHabil = String(row[0] || '').trim();
      if (!documentoHabil) return null;

      return {
        sourceIndex: index + 1,
        documentoHabil,
        dhProcesso: String(row[1] || '').trim(),
        dhEstado: String(row[2] || '').trim(),
        dhUgPagadora: String(row[3] || '').trim(),
        dhItemUgPagadora: String(row[4] || '').trim(),
        dhCredorDocumento: String(row[5] || '').trim(),
        dhCredorNome: String(row[6] || '').trim(),
        dhSituacao: String(row[7] || '').trim().toUpperCase(),
        dhDataEmissaoDocOrigem: toIsoDate(row[8]),
        dhDiaPagamento: toIsoDate(row[9]),
        dhItemDiaVencimento: toIsoDate(row[10]),
        dhItemDiaPagamento: toIsoDate(row[11]),
        dhItemLiquidado: toBooleanLiquidado(row[12]),
        dhValorDocOrigem: parseCurrencyBR(row[13]),
        metrica: String(row[14] || '').trim(),
        valorRetencao: parseCurrencyBR(row[15]),
      };
    })
    .filter((item): item is RetencaoEfdReinfRegistro => item !== null);
}

export function validateRetencaoEfdReinfRow(row: RetencaoEfdReinfRegistro): RetencaoEfdReinfValidation {
  const issues: string[] = [];
  const itemUgPagadora = (row.dhItemUgPagadora || '').replace(/\D/g, '');
  const hasCriticalUgPagadora = itemUgPagadora !== '158155';

  let expectedRule: 'DDF025' | 'DDF021' | null = null;
  let expectedDate: string | null = null;
  let hasWarningPrazo = false;

  if (row.dhSituacao === 'DDF025') {
    expectedRule = 'DDF025';
    expectedDate = getExpectedNextMonthDay20(row.dhDiaPagamento);
    hasWarningPrazo =
      !expectedDate ||
      !sameIsoDate(row.dhItemDiaVencimento, expectedDate) ||
      !sameIsoDate(row.dhItemDiaPagamento, expectedDate);
    if (hasWarningPrazo) {
      issues.push('DDF025 deve vencer e pagar no dia 20 do mes seguinte ao DH - Dia Pagamento.');
    }
  }

  if (row.dhSituacao === 'DDF021') {
    expectedRule = 'DDF021';
    expectedDate = getExpectedNextMonthDay20(row.dhDataEmissaoDocOrigem);
    hasWarningPrazo =
      !expectedDate ||
      !sameIsoDate(row.dhItemDiaVencimento, expectedDate) ||
      !sameIsoDate(row.dhItemDiaPagamento, expectedDate);
    if (hasWarningPrazo) {
      issues.push('DDF021 deve vencer e pagar no dia 20 do mes seguinte a DH - Data Emissao Doc.Origem.');
    }
  }

  if (hasCriticalUgPagadora) {
    issues.unshift('DH Item - UG Pagadora deve ser 158155.');
  }

  const percentualRetencao =
    row.dhValorDocOrigem > 0 ? (row.valorRetencao / row.dhValorDocOrigem) * 100 : null;

  return {
    severity: hasCriticalUgPagadora ? 'critical' : hasWarningPrazo ? 'warning' : 'ok',
    hasCriticalUgPagadora,
    hasWarningPrazo,
    expectedDate,
    expectedRule,
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

  const { data: rows, error: rowsError } = await supabase
    .from('retencoes_efd_reinf')
    .select(`
      source_index,
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
    `)
    .eq('imported_at', latest.imported_at)
    .order('source_index', { ascending: true });

  if (rowsError) throw rowsError;

  return {
    rows: ((rows || []) as RetencaoEfdReinfDbRow[]).map(dbRowToRegistro),
    sourceFile: latest.source_file || '',
    importedAt: latest.imported_at,
  };
}

export function formatRetencaoEfdReinfDate(value?: string | null) {
  return formatDateBr(value);
}

