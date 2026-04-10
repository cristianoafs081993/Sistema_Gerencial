import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

export interface FinanceiroRegistro {
  ugCodigo: string;
  ugNome: string;
  mesLancamento: string;
  fonteCodigo: string;
  fonteDescricao: string;
  vinculacaoCodigo: string;
  vinculacaoDescricao: string;
  saldo: number;
}

export interface FinanceiroDisponivelCard {
  fonteCodigo: string;
  fonteDescricao: string;
  vinculacaoCodigo: string;
  vinculacaoDescricao: string;
  saldoDisponivel: number;
}

type FinanceiroDbRow = {
  ug_codigo: string;
  ug_nome: string | null;
  mes_lancamento: string;
  fonte_codigo: string;
  fonte_descricao: string | null;
  vinculacao_codigo: string;
  vinculacao_descricao: string | null;
  saldo_disponivel: number;
  source_file: string | null;
  imported_at: string;
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
  return new TextDecoder('utf-8').decode(bytes);
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

export async function parseFinanceiroCsv(file: File): Promise<FinanceiroRegistro[]> {
  const workbook = await readWorkbook(file);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as unknown[][];

  const headerRowIndex = rows.findIndex((row) => {
    const joined = row.map((c) => String(c || '').toLowerCase()).join(' | ');
    return joined.includes('ug executora') && joined.includes('saldo - r$');
  });

  if (headerRowIndex === -1) {
    throw new Error('Não foi possível localizar o cabeçalho do arquivo financeiro.');
  }

  return rows
    .slice(headerRowIndex + 1)
    .map((row): FinanceiroRegistro | null => {
      const ugCodigo = String(row[0] || '').trim();
      const mesLancamento = String(row[2] || '').trim();
      const fonteCodigo = String(row[3] || '').trim();
      const vinculacaoCodigo = String(row[5] || '').trim();
      const saldo = parseCurrencyBR(row[7]);

      if (!ugCodigo || !mesLancamento || !fonteCodigo || !vinculacaoCodigo) return null;

      return {
        ugCodigo,
        ugNome: String(row[1] || '').trim(),
        mesLancamento,
        fonteCodigo,
        fonteDescricao: String(row[4] || '').trim(),
        vinculacaoCodigo,
        vinculacaoDescricao: String(row[6] || '').trim(),
        saldo,
      };
    })
    .filter((item): item is FinanceiroRegistro => item !== null);
}

export function aggregateFinanceiroDisponivel(rows: FinanceiroRegistro[]): FinanceiroDisponivelCard[] {
  const map = new Map<string, FinanceiroDisponivelCard>();

  for (const row of rows) {
    const key = `${row.fonteCodigo}|${row.vinculacaoCodigo}`;
    const existing = map.get(key);
    if (existing) {
      existing.saldoDisponivel += row.saldo;
      continue;
    }

    map.set(key, {
      fonteCodigo: row.fonteCodigo,
      fonteDescricao: row.fonteDescricao,
      vinculacaoCodigo: row.vinculacaoCodigo,
      vinculacaoDescricao: row.vinculacaoDescricao,
      saldoDisponivel: row.saldo,
    });
  }

  return Array.from(map.values()).sort((a, b) => b.saldoDisponivel - a.saldoDisponivel);
}

function aggregateForUpsert(rows: FinanceiroRegistro[]) {
  const map = new Map<string, FinanceiroRegistro>();

  for (const row of rows) {
    const key = `${row.ugCodigo}|${row.mesLancamento}|${row.fonteCodigo}|${row.vinculacaoCodigo}`;
    const current = map.get(key);
    if (current) {
      current.saldo += row.saldo;
      continue;
    }
    map.set(key, { ...row });
  }

  return Array.from(map.values());
}

function dbRowsToCards(rows: FinanceiroDbRow[]): FinanceiroDisponivelCard[] {
  const normalized: FinanceiroRegistro[] = rows.map((row) => ({
    ugCodigo: row.ug_codigo,
    ugNome: row.ug_nome || '',
    mesLancamento: row.mes_lancamento,
    fonteCodigo: row.fonte_codigo,
    fonteDescricao: row.fonte_descricao || '',
    vinculacaoCodigo: row.vinculacao_codigo,
    vinculacaoDescricao: row.vinculacao_descricao || '',
    saldo: Number(row.saldo_disponivel || 0),
  }));

  return aggregateFinanceiroDisponivel(normalized);
}

export async function saveFinanceiroRows(rows: FinanceiroRegistro[], sourceFile: string) {
  if (!rows.length) return;

  const importedAt = new Date().toISOString();
  const consolidated = aggregateForUpsert(rows);

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

  const { error } = await supabase
    .from('financeiro_fonte_vinculacao')
    .upsert(payload, { onConflict: 'ug_codigo,mes_lancamento,fonte_codigo,vinculacao_codigo' });

  if (error) throw error;
}

export async function loadLatestFinanceiroCardsFromDb(): Promise<{
  cards: FinanceiroDisponivelCard[];
  sourceFile: string;
}> {
  const { data: latest, error: latestError } = await supabase
    .from('financeiro_fonte_vinculacao')
    .select('imported_at, source_file')
    .order('imported_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw latestError;
  if (!latest?.imported_at) return { cards: [], sourceFile: '' };

  const { data: rows, error: rowsError } = await supabase
    .from('financeiro_fonte_vinculacao')
    .select('ug_codigo, ug_nome, mes_lancamento, fonte_codigo, fonte_descricao, vinculacao_codigo, vinculacao_descricao, saldo_disponivel, source_file, imported_at')
    .eq('imported_at', latest.imported_at);

  if (rowsError) throw rowsError;

  return {
    cards: dbRowsToCards((rows || []) as FinanceiroDbRow[]),
    sourceFile: latest.source_file || '',
  };
}
