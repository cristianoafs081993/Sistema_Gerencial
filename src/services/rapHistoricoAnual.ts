import * as XLSX from 'xlsx';

import { supabase } from '@/lib/supabase';
import { parseRapHistoricoAnualTable, type RapHistoricoAnualInput } from '@/utils/rapHistoricoAnual';

export type RapHistoricoAnualRow = RapHistoricoAnualInput & {
  id: string;
  importBatchId: string;
  sourceFile: string;
  importedAt: string;
};

export type RapHistoricoAnualLatestReport = {
  rows: RapHistoricoAnualRow[];
  sourceFile: string;
  importedAt: string;
};

type RapHistoricoAnualDbRow = {
  id: string;
  ug_executora: string;
  ug_nome: string | null;
  ano: number | string;
  metrica: string | null;
  item_informacao_codigo: string;
  item_informacao_nome: string;
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

function mapDbRow(row: RapHistoricoAnualDbRow): RapHistoricoAnualRow {
  return {
    id: row.id,
    ugExecutora: row.ug_executora,
    ugNome: row.ug_nome || '',
    ano: Number(row.ano),
    metrica: row.metrica || '',
    itemInformacaoCodigo: row.item_informacao_codigo,
    itemInformacaoNome: row.item_informacao_nome,
    valor: Number(row.valor),
    importBatchId: row.import_batch_id,
    sourceFile: row.source_file || '',
    importedAt: row.imported_at,
  };
}

export async function parseRapHistoricoAnualFile(file: File): Promise<RapHistoricoAnualInput[]> {
  const text = decodeCsvBuffer(await file.arrayBuffer()).replace(/^\uFEFF/, '');
  
  // Count occurrences of delimiters on a sample of lines to detect the true CSV separator
  const lines = text.split('\n').slice(0, 20);
  let commaCount = 0;
  let semiCount = 0;
  let tabCount = 0;
  for (const line of lines) {
    commaCount += (line.match(/,/g) || []).length;
    semiCount += (line.match(/;/g) || []).length;
    tabCount += (line.match(/\t/g) || []).length;
  }
  
  let delimiter = ',';
  if (tabCount > commaCount && tabCount > semiCount) {
    delimiter = '\t';
  } else if (semiCount > commaCount && semiCount > tabCount) {
    delimiter = ';';
  }

  const workbook = XLSX.read(text, { type: 'string', raw: false, FS: delimiter });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as unknown[][];

  return parseRapHistoricoAnualTable(rows);
}

export const rapHistoricoAnualService = {
  async getLatestReport(): Promise<RapHistoricoAnualLatestReport> {
    const { data: latest, error: latestError } = await supabase
      .from('rap_historico_anual')
      .select('import_batch_id,source_file,imported_at')
      .order('imported_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) throw latestError;
    if (!latest?.import_batch_id) return { rows: [], sourceFile: '', importedAt: '' };

    const { data, error } = await supabase
      .from('rap_historico_anual')
      .select('id,ug_executora,ug_nome,ano,metrica,item_informacao_codigo,item_informacao_nome,valor,import_batch_id,source_file,imported_at')
      .eq('import_batch_id', latest.import_batch_id)
      .order('ug_executora', { ascending: true })
      .order('ano', { ascending: true })
      .order('item_informacao_codigo', { ascending: true });

    if (error) throw error;

    return {
      rows: ((data || []) as RapHistoricoAnualDbRow[]).map(mapDbRow),
      sourceFile: latest.source_file || '',
      importedAt: latest.imported_at || '',
    };
  },

  async importReport(rows: RapHistoricoAnualInput[], sourceFile: string): Promise<void> {
    if (rows.length === 0) return;

    const importedAt = new Date().toISOString();
    const importBatchId = crypto.randomUUID();
    const payload = rows.map((row) => ({
      ug_executora: row.ugExecutora,
      ug_nome: row.ugNome || null,
      ano: row.ano,
      metrica: row.metrica || null,
      item_informacao_codigo: row.itemInformacaoCodigo,
      item_informacao_nome: row.itemInformacaoNome,
      valor: row.valor,
      import_batch_id: importBatchId,
      source_file: sourceFile,
      imported_at: importedAt,
    }));

    const { error } = await supabase
      .from('rap_historico_anual')
      .insert(payload);

    if (error) throw error;
  },
};
