import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const GESTAO = '26435';

const normalizeDocId = (id: string | undefined): string => {
  if (!id) return '';
  const trimmed = id.trim();
  return trimmed.length > 12 ? trimmed.slice(-12) : trimmed;
};

function parseCSV(filePath: string, delimiter: string = '\t'): any[] {
  console.log(`Lendo arquivo: ${filePath}`);
  const content = fs.readFileSync(filePath, 'latin1'); 
  const lines = content.split('\n').filter(l => l.trim() !== '');
  if (lines.length === 0) return [];

  const headers = lines[0].split(delimiter).map(h => 
    h.replace(/"/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim()
  );

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.replace(/"/g, '').trim());
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] !== undefined ? values[index] : '';
    });
    row._raw = values;
    data.push(row);
  }
  return data;
}

function parseCurrency(valStr: string): number {
  if (!valStr || valStr.trim() === '' || valStr === '-') return 0;
  const cleanStr = valStr.replace(/\./g, '').replace(',', '.').trim();
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
}

function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return null;
}

async function run() {
  const filePath = path.resolve(__dirname, '../../docs/Documentos Hábeis.csv');
  if (!fs.existsSync(filePath)) {
    console.error('Arquivo Documentos Hábeis.csv não encontrado.');
    return;
  }

  // 1. Carregar mapeamento de Fonte SOF de Liquidações.csv
  const liqPath = path.resolve(__dirname, '../../docs/Liquidações.csv');
  const fonteMap = new Map<string, string>();
  if (fs.existsSync(liqPath)) {
    console.log('Lendo Liquidações.csv para mapear Fontes SOF...');
    const liqLines = fs.readFileSync(liqPath, 'latin1').split('\n');
    if (liqLines.length >= 2) {
      const liqHeaders = liqLines[1].split('\t').map(h => h.replace(/"/g, '').trim());
      const idIdx = liqHeaders.indexOf('Documento Origem');
      const fonteIdx = liqHeaders.indexOf('Fonte SOF');

      if (idIdx !== -1 && fonteIdx !== -1) {
        for (let i = 2; i < liqLines.length; i++) {
          const parts = liqLines[i].split('\t').map(p => p.replace(/"/g, '').trim());
          if (parts[idIdx] && parts[fonteIdx]) {
            fonteMap.set(parts[idIdx], parts[fonteIdx]);
          }
        }
      }
    }
  }

  // 2. Carregar Documentos Hábeis
  const rows = parseCSV(filePath, '\t');
  console.log(`Processando ${rows.length} registros...`);

  const docsMap = new Map<string, any>();

  for (const row of rows) {
    const rawId = row['Documento Habil'] || '';
    const id = normalizeDocId(rawId);
    if (!id) continue;

    if (!docsMap.has(id)) {
      const fSource = fonteMap.get(id) || null;
      docsMap.set(id, {
        doc: {
          id: id,
          valor_original: parseCurrency(row['DH - Valor Doc.Origem']),
          processo: row['DH - Processo'],
          estado: row['DH - Estado'],
          favorecido_documento: row['DH - Credor'],
          favorecido_nome: row['DH - Credor Nome'] || row._raw[7] || '', 
          data_emissao: parseDate(row['DH - Data Emissao Doc.Origem']) || new Date().toISOString().split('T')[0],
          fonte_sof: (fSource && fSource !== '158366') ? fSource : null,
          updated_at: new Date().toISOString()
        },
        situacoes: [],
        itens: [],
        sitSet: new Set<string>(),
        itemSet: new Set<string>()
      });
    }

    const docData = docsMap.get(id);

    // 1. Identificar Situações (Despesas/Retenções)
    const situacaoCodigo = row['DH - Situacao'];
    const valueSituacao = parseCurrency(row._raw[row._raw.length - 1]);
    
    if (situacaoCodigo && !['OB', 'NS', 'NC', 'DR', 'GR'].includes(situacaoCodigo)) {
      const sitKey = `${situacaoCodigo}_${valueSituacao}`;
      if (!docData.sitSet.has(sitKey)) {
        docData.situacoes.push({
          documento_habil_id: id,
          situacao_codigo: situacaoCodigo,
          valor: valueSituacao,
          is_retencao: situacaoCodigo.startsWith('DDF') || 
                      situacaoCodigo.startsWith('DDU') || 
                      situacaoCodigo === 'DOB001' || 
                      situacaoCodigo === 'DOB035'
        });
        docData.sitSet.add(sitKey);
      }
    }

    // 2. Identificar Itens (Documentos Gerados como OB, NS)
    const itemTipo = row['DH - Item'] || situacaoCodigo;
    const itemIdRaw = row['DH - Doc. Origem'] || '';
    const itemId = normalizeDocId(itemIdRaw);

    if (['OB', 'NS', 'NC', 'DR', 'GR'].includes(itemTipo)) {
      const itemValor = parseCurrency(row['DH - Valor Doc.Origem']); 
      const itemKey = `${itemTipo}_${itemValor}_${itemId}`;
      if (!docData.itemSet.has(itemKey)) {
        docData.itens.push({
          id: itemId || `${id}-${itemTipo}-${Math.random().toString(36).substr(2, 5)}`,
          documento_habil_id: id,
          doc_tipo: itemTipo,
          valor: itemValor,
          data_emissao: docData.doc.data_emissao,
          observacao: row._raw[9] || '' 
        });
        docData.itemSet.add(itemKey);
      }
    }
  }

  const allDocs = Array.from(docsMap.values()).map(d => d.doc);
  console.log(`Upserting ${allDocs.length} documentos...`);
  
  const batchSize = 100;
  for (let i = 0; i < allDocs.length; i += batchSize) {
    const batch = allDocs.slice(i, i + batchSize);
    const { error } = await supabase.from('documentos_habeis').upsert(batch, { onConflict: 'id' });
    if (error) console.error(`Error docs batch ${i}:`, error.message);
  }

  const docIds = allDocs.map(d => d.id);
  console.log('Limpando dados antigos relacionados...');
  for (let i = 0; i < docIds.length; i += batchSize) {
    const batchIds = docIds.slice(i, i + batchSize);
    await supabase.from('documentos_habeis_situacoes').delete().in('documento_habil_id', batchIds);
    await supabase.from('documentos_habeis_itens').delete().in('documento_habil_id', batchIds);
  }

  const allSituacoes = Array.from(docsMap.values()).flatMap(d => d.situacoes);
  console.log(`Inserindo ${allSituacoes.length} situações...`);
  for (let i = 0; i < allSituacoes.length; i += batchSize) {
    const batch = allSituacoes.slice(i, i + batchSize);
    const { error } = await supabase.from('documentos_habeis_situacoes').insert(batch);
    if (error) console.error(`Error situacoes batch ${i}:`, error.message);
  }

  const allItens = Array.from(docsMap.values()).flatMap(d => d.itens);
  
  // 3. Tentar carregar OBs de arquivo separado se existir
  const obFilePath = path.join(process.cwd(), 'docs', 'Ordens Bancárias.csv');
  const itemsMap = new Map<string, any>();

  // Primeiro adicionamos os itens que já vieram no docs (se houver algum)
  for (const item of allItens) {
    if (itemsMap.has(item.id)) {
      itemsMap.get(item.id).valor += item.valor;
    } else {
      itemsMap.set(item.id, item);
    }
  }

  if (fs.existsSync(obFilePath)) {
    console.log('Detectado arquivo de Ordens Bancárias separado. Processando...');
    const obRows = parseCSV(obFilePath, '\t');
    for (const row of obRows) {
      const rawId = row['Documento'];
      const rawDhId = row['Documento Origem'];
      
      const id = normalizeDocId(rawId);
      const dhId = normalizeDocId(rawDhId);
      
      if (!id || !dhId) continue;

      const valorStr = row['DESPESAS PAGAS'] || row['RESTOS A PAGAR PAGOS (PROC E N PROC)'] || '0';
      const valor = parseCurrency(valorStr);
      
      if (itemsMap.has(id)) {
        itemsMap.get(id).valor += valor;
      } else {
        itemsMap.set(id, {
          id,
          documento_habil_id: dhId,
          doc_tipo: row['Doc - Tipo'] || 'OB',
          valor,
          data_emissao: parseDate(row['Dia Lançamento']) || new Date().toISOString().split('T')[0],
          observacao: row['Doc - Observação'] || ''
        });
      }
    }
  }

  const finalItens = Array.from(itemsMap.values());
  console.log(`Inserindo ${finalItens.length} itens (OBs/NS/etc)...`);
  for (let i = 0; i < finalItens.length; i += batchSize) {
    const batch = finalItens.slice(i, i + batchSize);
    const { error } = await supabase.from('documentos_habeis_itens').upsert(batch, { onConflict: 'id' });
    if (error) console.error(`Error itens batch ${i}:`, error.message);
  }

  console.log('Carga finalizada.');
}

run();
