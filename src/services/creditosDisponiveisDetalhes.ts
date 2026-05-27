import * as XLSX from 'xlsx';

import { supabase } from '@/lib/supabase';
import {
  aggregateCreditoDisponivelRows,
  parseCreditoDisponivelTable,
  type CreditoDisponivelDetalheInput,
} from '@/utils/creditosDisponiveisDetalhes';

export type CreditoDisponivelDetalheRow = CreditoDisponivelDetalheInput & {
  id: string;
  importBatchId: string;
  sourceFile: string;
  importedAt: string;
};

export type CreditoDisponivelLatestReport = {
  rows: CreditoDisponivelDetalheRow[];
  sourceFile: string;
  importedAt: string;
};

type CreditoDisponivelDetalheDbRow = {
  id: string;
  ptres: string;
  plano_interno: string | null;
  descricao: string | null;
  metrica: string | null;
  valor: number | string;
  import_batch_id: string;
  source_file: string | null;
  imported_at: string;
};

function decodeCsvBuffer(arrayBuffer: ArrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes);
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

function mapDbRow(row: CreditoDisponivelDetalheDbRow): CreditoDisponivelDetalheRow {
  return {
    id: row.id,
    ptres: row.ptres,
    planoInterno: row.plano_interno || '',
    descricao: row.descricao || '',
    metrica: row.metrica || '',
    valor: Number(row.valor),
    importBatchId: row.import_batch_id,
    sourceFile: row.source_file || '',
    importedAt: row.imported_at,
  };
}

export async function parseCreditoDisponivelFile(file: File): Promise<CreditoDisponivelDetalheInput[]> {
  const text = decodeCsvBuffer(await file.arrayBuffer()).replace(/^\uFEFF/, '');
  const delimiter = text.includes('\t') ? '\t' : text.includes(';') ? ';' : ',';
  const workbook = XLSX.read(text, { type: 'string', raw: false, FS: delimiter });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as unknown[][];

  return parseCreditoDisponivelTable(rows);
}

export const creditosDisponiveisDetalhesService = {
  async getLatestReport(): Promise<CreditoDisponivelLatestReport> {
    const { data: latest, error: latestError } = await supabase
      .from('creditos_disponiveis_detalhes')
      .select('import_batch_id,source_file,imported_at')
      .order('imported_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) throw latestError;
    if (!latest?.import_batch_id) return { rows: [], sourceFile: '', importedAt: '' };

    const { data, error } = await supabase
      .from('creditos_disponiveis_detalhes')
      .select('id,ptres,plano_interno,descricao,metrica,valor,import_batch_id,source_file,imported_at')
      .eq('import_batch_id', latest.import_batch_id)
      .order('ptres', { ascending: true })
      .order('plano_interno', { ascending: true });

    if (error) throw error;

    return {
      rows: ((data || []) as CreditoDisponivelDetalheDbRow[]).map(mapDbRow),
      sourceFile: latest.source_file || '',
      importedAt: latest.imported_at || '',
    };
  },

  async importReport(rows: CreditoDisponivelDetalheInput[], sourceFile: string): Promise<void> {
    if (rows.length === 0) return;

    const importedAt = new Date().toISOString();
    const importBatchId = crypto.randomUUID();
    const summaryPayload = aggregateCreditoDisponivelRows(rows).map((row) => ({
      ptres: row.ptres,
      metrica: row.metrica,
      valor: row.valor,
      updated_at: importedAt,
    }));
    const { error: summaryError } = await supabase
      .from('creditos_disponiveis')
      .upsert(summaryPayload, { onConflict: 'ptres' });

    if (summaryError) throw summaryError;

    const detailPayload = rows.map((row) => ({
      ptres: row.ptres,
      plano_interno: row.planoInterno || null,
      descricao: row.descricao || null,
      metrica: row.metrica || null,
      valor: row.valor,
      import_batch_id: importBatchId,
      source_file: sourceFile,
      imported_at: importedAt,
    }));

    const { error: detailError } = await supabase
      .from('creditos_disponiveis_detalhes')
      .insert(detailPayload);

    if (detailError) throw detailError;
  },
};
