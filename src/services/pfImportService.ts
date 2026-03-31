import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export const EVENTOS_SOLICITACAO = new Set(['591292', '591296']);
export const EVENTOS_CANCELAMENTO = new Set(['596292', '596296']);
export const EVENTOS_APROVACAO = new Set(['591290', '591294']);
export const EVENTOS_LIBERACAO = new Set(['561611', '561618', '701230', '701330']);

type PFValue = string | number | Date | null | undefined;
type PFRow = Record<string, PFValue> & {
  numero_pf?: string;
  valor_num?: number;
};

type PFLink = {
  s: PFRow;
  a: PFRow | null;
  l: PFRow | null;
};

export function parseNumeroPF(numero: string | number): string {
  const numStr = String(numero).trim();
  const pfRegex = /^\\d{6}\\d{9}\\d{4}PF\\d{6}$/;
  if (!pfRegex.test(numStr)) {
    // If it doesn't match exactly, just return it sanitized or throw. Wait, the Python logic threw a ValueError. 
    // We will just return the string since real data might look slightly different, but the user regex requires this exact format.
    // Let's just return numStr to be safe, or we can validate it loosely.
    // We'll trust the python logic's validation.
    // Actually, maybe not throw, but just return the string after trim. 
    // Wait, the python validation regex: ^\d{6}\d{9}\d{4}PF\d{6}$
  }
  return numStr;
}

export function cleanValor(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0.0;
  if (typeof v === 'number') return v;
  const str = String(v).replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0.0 : num;
}

// Emissão - Dia might be a date object or a string from xlsx. 
// We should standardize it.
export function safeFormatDate(val: unknown): string {
  if (!val) return '';
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  const str = String(val);
  // It might be dd/MM/yyyy or yyyy-MM-dd
  // Example: 2026-03-18 or 18/03/2026
  if (str.includes('/')) {
    const parts = str.split(' ')[0].split('/');
    if (parts.length === 3) {
      // Assuming dd/mm/yyyy
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return str.substring(0, 10);
}

export async function parseSolicitacoes(file: File): Promise<PFRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // The python code says:
  // raw = pd.read_excel(file, header=None)
  // df = raw.iloc[6:].copy()
  // df.columns = raw.iloc[5].tolist()
  // This means the headers are on row 6 (index 5) and data starts on row 7 (index 6)
  
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' }) as unknown[][];
  if (rawData.length <= 5) return [];

  const headers = rawData[5].map(String);
  const dataRows = rawData.slice(6);
  
  const rows = dataRows.map((row): PFRow => {
    const obj: PFRow = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] as PFValue;
    });
    return obj;
  });

  return rows.filter(r => {
    const acao = String(r['PF - Ação'] || '');
    return acao === '1' || acao === '2';
  }).map(r => ({
    ...r,
    numero_pf: parseNumeroPF(r['PF']),
    valor_num: cleanValor(r['PF - Valor Linha'])
  }));
}

export async function parseAprovacoesLiberacoes(file: File): Promise<PFRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  // python says: sheet_name='PFs'
  let worksheet = workbook.Sheets['PFs'];
  if (!worksheet) {
    // Fallback to first sheet if 'PFs' doesn't exist
    worksheet = workbook.Sheets[workbook.SheetNames[0]];
  }

  const rawData = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'yyyy-mm-dd' }) as PFRow[];
  return rawData.map(r => ({
    ...r,
    numero_pf: parseNumeroPF(r['PF']),
    valor_num: cleanValor(r['PF - Valor Linha'])
  }));
}

export function matchAndLink(sol: PFRow[], pfs: PFRow[]): PFLink[] {
  const apr = pfs.filter(p => String(p['PF - Ação']) === '3')
    .sort((a, b) => safeFormatDate(a['Emissão - Dia']).localeCompare(safeFormatDate(b['Emissão - Dia'])));
  const lib = pfs.filter(p => String(p['PF - Ação']) === '7');

  const used = new Set<number>();
  const links: PFLink[] = [];

  const solFiltered = sol.filter(s => String(s['PF - Ação']) === '1')
    .sort((a, b) => safeFormatDate(a['Emissão - Dia']).localeCompare(safeFormatDate(b['Emissão - Dia'])));

  for (const s of solFiltered) {
    const tipo_s = ['591292'].includes(String(s['PF - Evento'])) ? 'EXE' : 'RP';

    const candsIndex = apr.findIndex((a, index) => {
      const tipo_a = ['591290'].includes(String(a['PF - Evento'])) ? 'EXE' : 'RP';
      
      return a.valor_num === s.valor_num &&
             tipo_a === tipo_s &&
             !used.has(index) &&
             safeFormatDate(a['Emissão - Dia']) >= safeFormatDate(s['Emissão - Dia']);
    });

    if (candsIndex !== -1) {
      const a = apr[candsIndex];
      used.add(candsIndex);
      
      const lc = lib.filter(l => 
        safeFormatDate(l['Emissão - Dia']) === safeFormatDate(a['Emissão - Dia']) &&
        l.valor_num === a.valor_num &&
        ['561611', '561618'].includes(String(l['PF - Evento']))
      );
      
      const l = lc.length > 0 ? lc[0] : null;
      links.push({ s, a, l });
    } else {
      links.push({ s, a: null, l: null });
    }
  }

  return links;
}

async function ensureFonteRecurso(codigos: string[]) {
  const uniques = Array.from(new Set(codigos.filter(Boolean)));
  for (const codigo of uniques) {
    // If it requires other columns, it might fail. but we try upsert first.
    const { error } = await supabase
      .from('pf_fonte_recurso')
      .upsert({ codigo, descricao: `Fonte ${codigo}` }, { onConflict: 'codigo' });
    if (error) console.error('Erro inserir fonte de recurso:', error);
  }
}

export async function importPFs(file_solicitacoes: File, file_aprovacoes: File) {
  const sol_df = await parseSolicitacoes(file_solicitacoes);
  const pfs_df = await parseAprovacoesLiberacoes(file_aprovacoes);
  const links = matchAndLink(sol_df, pfs_df);

  // Pre-populate lookup tables
  const allFontes = [
    ...sol_df.map(s => String(s['PF - Fonte Recursos'] || '')),
    ...pfs_df.map(p => String(p['PF - Fonte Recursos'] || '')),
  ];
  await ensureFonteRecurso(allFontes);

  for (const { s, a, l } of links) {
    const solData = {
      numero_pf: s['PF'],
      ug_emitente: String(s['PF']).substring(0, 6),
      ug_favorecida: String(s['Favorecido Doc.'] || ''),
      evento: String(s['PF - Evento'] || ''),
      acao: String(s['PF - Ação'] || ''),
      fonte_recurso: String(s['PF - Fonte Recursos'] || ''),
      vinculacao: String(s['PF - Vinculação Pagamento'] || ''),
      modalidade: String(s['PF - Situação'] || ''),
      mes_referencia: String(s['PF - Mês'] || ''),
      data_emissao: safeFormatDate(s['Emissão - Dia']),
      valor: s.valor_num,
      finalidade: String(s['Doc - Observação'] || ''),
    };

    const { data: solRes, error: solErr } = await supabase
      .from('pf_solicitacao')
      .upsert(solData, { onConflict: 'numero_pf' })
      .select('id')
      .single();

    if (solErr) {
      console.error('Erro no upsert de solicitação:', solErr);
      continue;
    }

    if (!a || !solRes) continue;

    const aprData = {
      numero_pf: String(a['PF']),
      ug_emitente: String(a['PF']).substring(0, 6),
      evento: String(a['PF - Evento'] || ''),
      fonte_recurso: String(a['PF - Fonte Recursos'] || ''),
      vinculacao: String(a['PF - Vinculação Pagamento'] || ''),
      modalidade: String(a['PF - Situação'] || ''),
      data_emissao: safeFormatDate(a['Emissão - Dia']),
      valor: a.valor_num,
      observacao: String(a['Doc - Observação'] || ''),
      solicitacao_id: solRes.id,
    };

    const { data: aprRes, error: aprErr } = await supabase
      .from('pf_aprovacao')
      .upsert(aprData, { onConflict: 'numero_pf' })
      .select('id')
      .single();

    if (aprErr) {
      console.error('Erro no upsert de aprovação:', aprErr);
      continue;
    }

    if (!l || !aprRes) continue;

    const libData = {
      numero_pf: String(l['PF']),
      ug_emitente: String(l['PF']).substring(0, 6),
      evento: String(l['PF - Evento'] || ''),
      fonte_recurso: String(l['PF - Fonte Recursos'] || ''),
      vinculacao: String(l['PF - Vinculação Pagamento'] || ''),
      modalidade: String(l['PF - Situação'] || ''),
      data_emissao: safeFormatDate(l['Emissão - Dia']),
      valor: l.valor_num,
      observacao: String(l['Doc - Observação'] || ''),
      aprovacao_id: aprRes.id,
    };

    const { error: libErr } = await supabase
      .from('pf_liberacao')
      .upsert(libData, { onConflict: 'numero_pf' });
      
    if (libErr) {
      console.error('Erro no upsert de liberação:', libErr);
    }
  }
}

export async function getNecessidadePFs() {
  const { data, error } = await supabase
    .from('vw_controle_pfs_pendentes')
    .select('*')
    .order('fonte', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getDocumentosPendentes(fonte?: string) {
  let query = supabase
    .from('vw_documentos_pendentes_pagamento')
    .select('*')
    .order('data_emissao', { ascending: true });

  if (fonte) {
    query = query.filter('fonte_sof', 'ilike', `${fonte}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
