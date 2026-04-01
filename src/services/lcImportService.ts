import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

export interface LCRegistro {
  obListaCredores: string;
  sequencial: number;
  favorecidoDocumento: string;
  favorecidoNome: string;
  bancoCodigo: string;
  bancoNome: string;
  agenciaCodigo: string;
  agenciaNome: string;
  contaBancaria: string;
}

type LcDbRow = {
  ob_lista_credores: string;
  sequencial: number;
  favorecido_documento: string;
  favorecido_nome: string | null;
  banco_codigo: string | null;
  banco_nome: string | null;
  agencia_codigo: string | null;
  agencia_nome: string | null;
  conta_bancaria: string | null;
  source_file: string | null;
  imported_at: string;
};

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

export async function parseLCCsv(file: File): Promise<LCRegistro[]> {
  const workbook = await readWorkbook(file);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as unknown[][];

  const headerRowIndex = rows.findIndex((row) => {
    const joined = row.map((c) => String(c || '').toLowerCase()).join(' | ');
    return joined.includes('ob - lista credores') && joined.includes('ob/lc - sequencial');
  });

  if (headerRowIndex === -1) {
    throw new Error('Nao foi possivel localizar o cabecalho do arquivo LC.');
  }

  return rows
    .slice(headerRowIndex + 1)
    .map((row): LCRegistro | null => {
      const obListaCredores = String(row[0] || '').trim();
      const sequencialRaw = String(row[1] || '').trim();
      const favorecidoDocumento = String(row[2] || '').trim();

      if (!obListaCredores || obListaCredores === '-9') return null;
      if (!sequencialRaw || sequencialRaw === '-9') return null;
      if (!favorecidoDocumento || favorecidoDocumento === '-9') return null;

      const sequencial = Number(sequencialRaw);
      if (!Number.isFinite(sequencial)) return null;

      return {
        obListaCredores,
        sequencial,
        favorecidoDocumento,
        favorecidoNome: String(row[3] || '').trim(),
        bancoCodigo: String(row[4] || '').trim(),
        bancoNome: String(row[5] || '').trim(),
        agenciaCodigo: String(row[6] || '').trim(),
        agenciaNome: String(row[7] || '').trim(),
        contaBancaria: String(row[8] || '').trim(),
      };
    })
    .filter((item): item is LCRegistro => item !== null);
}

export async function saveLCRows(rows: LCRegistro[], sourceFile: string) {
  if (!rows.length) return;

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

  const { error } = await supabase
    .from('lc_credores')
    .upsert(payload, { onConflict: 'ob_lista_credores,sequencial' });

  if (error) throw error;
}

export async function loadLatestLCRowsFromDb(): Promise<{ rows: LCRegistro[]; sourceFile: string }> {
  const { data: latest, error: latestError } = await supabase
    .from('lc_credores')
    .select('imported_at, source_file')
    .order('imported_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw latestError;
  if (!latest?.imported_at) return { rows: [], sourceFile: '' };

  const allRows: LcDbRow[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('lc_credores')
      .select('ob_lista_credores, sequencial, favorecido_documento, favorecido_nome, banco_codigo, banco_nome, agencia_codigo, agencia_nome, conta_bancaria, source_file, imported_at')
      .eq('imported_at', latest.imported_at)
      .order('ob_lista_credores', { ascending: true })
      .order('sequencial', { ascending: true })
      .range(from, to);

    if (error) throw error;
    const chunk = (data || []) as LcDbRow[];
    allRows.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  const rows: LCRegistro[] = allRows.map((row) => ({
    obListaCredores: row.ob_lista_credores,
    sequencial: row.sequencial,
    favorecidoDocumento: row.favorecido_documento,
    favorecidoNome: row.favorecido_nome || '',
    bancoCodigo: row.banco_codigo || '',
    bancoNome: row.banco_nome || '',
    agenciaCodigo: row.agencia_codigo || '',
    agenciaNome: row.agencia_nome || '',
    contaBancaria: row.conta_bancaria || '',
  }));

  return { rows, sourceFile: latest.source_file || '' };
}
