import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_CSV_PATH = 'C:\\Users\\3128880\\Downloads\\2 - Descentralizações (10).csv';
const ANULACAO_DESCENTRALIZACAO = 'ANULACAO DE DESCENTRALIZACAO DE CREDITO';
const DEVOLUCAO = 'DEVOLUCAO';
const NC_CELULA_DESTINO = 'DESTINO';
const NC_CELULA_ORIGEM = 'ORIGEM';
const NC_RESUMIDA_REGEX = /(\d{4}NC\d+)/i;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function normalizeKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function summarizeNotaCredito(value) {
  const normalizedValue = normalizeText(value).replace(/\s+/g, '');
  if (!normalizedValue) return '';

  const match = normalizedValue.match(NC_RESUMIDA_REGEX);
  return match?.[1] ?? normalizedValue;
}

function parseCurrency(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;

  const clean = raw.replace(/[^\d.,-]/g, '');
  if (!clean) return 0;

  if (clean.includes(',') && clean.includes('.')) {
    return Number(clean.replace(/\./g, '').replace(',', '.')) || 0;
  }

  if (clean.includes(',')) {
    return Number(clean.replace(',', '.')) || 0;
  }

  return Number(clean) || 0;
}

function toIsoDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const [, day, month, year] = br;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : null;
}

function splitCsvLine(line, separator) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === separator && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function detectSeparator(line) {
  const separators = ['\t', ';', ','];
  return separators
    .map((separator) => ({ separator, count: splitCsvLine(line, separator).length }))
    .sort((a, b) => b.count - a.count)[0].separator;
}

function parseCsv(filePath) {
  const buffer = fs.readFileSync(filePath);
  let text;
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    text = buffer.subarray(2).toString('utf16le');
  } else if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.alloc(buffer.length - 2);
    for (let index = 2; index + 1 < buffer.length; index += 2) {
      swapped[index - 2] = buffer[index + 1];
      swapped[index - 1] = buffer[index];
    }
    text = swapped.toString('utf16le');
  } else {
    const utf8 = buffer.toString('utf8');
    const hasManyNulls = (utf8.match(/\u0000/g) || []).length > utf8.length / 10;
    text = hasManyNulls ? buffer.toString('utf16le') : utf8;
  }
  text = text.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];

  const separator = detectSeparator(lines[0]);
  const headers = splitCsvLine(lines[0], separator).map(normalizeKey);

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line, separator);
    return Object.fromEntries(headers.map((header, index) => [header || `empty_${index}`, values[index] ?? '']));
  });
}

function findValue(row, patterns, fallbacks = []) {
  for (const key of fallbacks) {
    if (row[key] != null && String(row[key]).trim() !== '') return row[key];
  }

  for (const key of Object.keys(row)) {
    if (patterns.some((pattern) => pattern.test(key))) {
      const value = row[key];
      if (value != null && String(value).trim() !== '') return value;
    }
  }

  return '';
}

function isAnulacaoDescentralizacao(operationType) {
  return normalizeText(operationType).includes(ANULACAO_DESCENTRALIZACAO);
}

function normalizeImportValue({ cellType, operationType, description, rawValue, inferredOrigem }) {
  const normalizedCellType = normalizeText(cellType);
  const absValue = Math.abs(rawValue);

  if (normalizedCellType === NC_CELULA_DESTINO) return { shouldImport: true, valor: absValue };
  if (normalizedCellType === NC_CELULA_ORIGEM) {
    return isAnulacaoDescentralizacao(operationType)
      ? { shouldImport: true, valor: -absValue }
      : { shouldImport: false, valor: 0 };
  }
  if (inferredOrigem) return { shouldImport: false, valor: 0 };
  if (isAnulacaoDescentralizacao(operationType) || normalizeText(description).includes(DEVOLUCAO)) {
    return { shouldImport: true, valor: -absValue };
  }

  return { shouldImport: true, valor: rawValue };
}

function buildPairKey(row) {
  return [
    row.notaCredito,
    normalizeText(row.operacaoTipo),
    row.dataEmissao || '',
    normalizeText(row.descricao),
    row.planoInterno,
    row.origemRecurso,
    Math.abs(row.valorBruto),
  ].join('|');
}

function buildDbKey(row, valor) {
  return [
    row.notaCredito,
    row.dataEmissao || '',
    row.origemRecurso,
    row.naturezaDespesa,
    row.planoInterno,
    Math.abs(valor),
  ].join('|');
}

function parseSourceRows(csvPath) {
  const rawRows = parseCsv(csvPath).map((row) => {
    const notaCredito = summarizeNotaCredito(
      findValue(row, [/^nc$/i, /notacredito/i, /notadecredito/i], ['nc', 'notacredito', 'notadecredito']),
    );
    const operacaoTipo = findValue(
      row,
      [/operacaotip/i, /opera.*tip/i, /tipooperacao/i, /operacao/i],
      ['ncoperacaotipo', 'ncoperaotip', 'operacaotipo', 'operaotip', 'tipooperacao'],
    );
    const cellType = findValue(row, [/celulatipo/i], ['nccelulatipo', 'celulatipo']);
    const planoInterno = findValue(
      row,
      [/planointern/i, /plano/i],
      ['nccelulaplanointerno', 'planointerno', 'plano_interno', 'plano'],
    )
      .trim()
      .toUpperCase();
    const origemRecurso = findValue(
      row,
      [/ptres/i, /origemrecurso/i, /origem/i],
      ['nccelulaptres', 'origemrecurso', 'origem_recurso', 'ptres'],
    ).trim();
    const naturezaDespesa = findValue(
      row,
      [/naturezadesp/i, /natureza/i],
      ['nccelulanaturezadespesa', 'naturezadespesa', 'natureza_despesa', 'natureza'],
    ).trim();
    const descricao = findValue(row, [/descr/i], ['ncdescricao', 'descricao', 'ncdrescricao']).trim();
    const dataEmissao = toIsoDate(
      findValue(row, [/diaemiss/i, /dataemiss/i, /data/i], ['ncdiaemissao', 'dataemissao', 'data_emissao']),
    );
    const valorBruto = parseCurrency(findValue(row, [/valor/i], ['nccelulavalor', 'valor']));

    return {
      notaCredito,
      operacaoTipo,
      cellType,
      planoInterno,
      origemRecurso,
      naturezaDespesa,
      descricao,
      dataEmissao,
      valorBruto,
    };
  });

  const destinationPairKeys = new Set(
    rawRows
      .filter(
        (row) =>
          !row.cellType.trim() &&
          !isAnulacaoDescentralizacao(row.operacaoTipo) &&
          row.naturezaDespesa === '339000',
      )
      .map(buildPairKey),
  );

  return rawRows.map((row) => {
    const pairKey = buildPairKey(row);
    const fullKey = `${pairKey}|${row.naturezaDespesa}`;
    const inferredOrigem =
      !row.cellType.trim() &&
      !isAnulacaoDescentralizacao(row.operacaoTipo) &&
      row.naturezaDespesa !== '339000' &&
      destinationPairKeys.has(pairKey);
    const normalized = normalizeImportValue({
      cellType: row.cellType,
      operationType: row.operacaoTipo,
      description: row.descricao,
      rawValue: row.valorBruto,
      inferredOrigem,
    });

    return {
      ...row,
      ...normalized,
      inferredOrigem,
      fullKey,
      dbKey: buildDbKey(row, row.valorBruto),
    };
  });
}

function groupByKey(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = buildDbKey(
      {
        notaCredito: row.nota_credito || '',
        dataEmissao: row.data_emissao || '',
        origemRecurso: row.origem_recurso || '',
        naturezaDespesa: row.natureza_despesa || '',
        planoInterno: row.plano_interno || '',
      },
      Number(row.valor || 0),
    );
    const list = grouped.get(key) || [];
    list.push(row);
    grouped.set(key, list);
  }
  return grouped;
}

async function fetchExistingRows(supabase, notas) {
  const result = [];
  const uniqueNotas = [...new Set(notas.filter(Boolean))];
  for (let index = 0; index < uniqueNotas.length; index += 100) {
    const batch = uniqueNotas.slice(index, index + 100);
    const { data, error } = await supabase
      .from('descentralizacoes')
      .select('id,nota_credito,operacao_tipo,data_emissao,origem_recurso,natureza_despesa,plano_interno,descricao,valor,dimensao')
      .in('nota_credito', batch);

    if (error) throw error;
    result.push(...(data || []));
  }
  return result;
}

function planChanges(sourceRows, existingRows) {
  const existingByKey = groupByKey(existingRows);
  const updates = [];
  const inserts = [];
  const deletes = [];
  const ignored = [];
  const consumedExistingIds = new Set();

  for (const row of sourceRows) {
    if (!row.notaCredito || !row.dataEmissao || !row.origemRecurso || !row.naturezaDespesa || !row.planoInterno || row.valorBruto === 0) {
      ignored.push({ reason: 'linha incompleta ou valor zero', row });
      continue;
    }

    const matches = existingByKey.get(row.dbKey) || [];
    const availableMatches = matches.filter((match) => !consumedExistingIds.has(match.id));

    if (!row.shouldImport) {
      for (const match of availableMatches) {
        deletes.push({ id: match.id, existing: match, source: row });
        consumedExistingIds.add(match.id);
      }
      if (availableMatches.length === 0) ignored.push({ reason: 'origem ignorada sem registro correspondente', row });
      continue;
    }

    const match = availableMatches[0];
    if (!match) {
      inserts.push({
        nota_credito: row.notaCredito || null,
        operacao_tipo: row.operacaoTipo.trim() || null,
        origem_recurso: row.origemRecurso,
        natureza_despesa: row.naturezaDespesa,
        plano_interno: row.planoInterno,
        data_emissao: row.dataEmissao,
        descricao: row.descricao,
        valor: row.valor,
      });
      continue;
    }

    consumedExistingIds.add(match.id);
    const patch = {};
    if (Number(match.valor) !== row.valor) patch.valor = row.valor;
    if ((match.operacao_tipo || '') !== row.operacaoTipo.trim()) patch.operacao_tipo = row.operacaoTipo.trim() || null;
    if ((match.descricao || '') !== row.descricao) patch.descricao = row.descricao;

    if (Object.keys(patch).length > 0) {
      updates.push({ id: match.id, patch, existing: match, source: row });
    } else {
      ignored.push({ reason: 'registro ja correto', row });
    }
  }

  return { updates, inserts, deletes, ignored };
}

async function applyChanges(supabase, plan) {
  for (const update of plan.updates) {
    const { error } = await supabase.from('descentralizacoes').update(update.patch).eq('id', update.id);
    if (error) throw error;
  }

  if (plan.inserts.length > 0) {
    const { error } = await supabase.from('descentralizacoes').insert(plan.inserts);
    if (error) throw error;
  }

  const deleteIds = plan.deletes.map((item) => item.id);
  for (let index = 0; index < deleteIds.length; index += 100) {
    const batch = deleteIds.slice(index, index + 100);
    const { error } = await supabase.from('descentralizacoes').delete().in('id', batch);
    if (error) throw error;
  }
}

function printSummary(plan, apply) {
  const ignoredByReason = plan.ignored.reduce((acc, item) => {
    acc[item.reason] = (acc[item.reason] || 0) + 1;
    return acc;
  }, {});
  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    updateCount: plan.updates.length,
    insertCount: plan.inserts.length,
    deleteCount: plan.deletes.length,
    ignoredCount: plan.ignored.length,
    ignoredByReason,
    deletes: plan.deletes.map((item) => ({
      id: item.id,
      nota_credito: item.existing.nota_credito,
      data_emissao: item.existing.data_emissao,
      origem_recurso: item.existing.origem_recurso,
      natureza_despesa: item.existing.natureza_despesa,
      plano_interno: item.existing.plano_interno,
      valor: item.existing.valor,
      reason: item.source.inferredOrigem ? 'origem inferida' : 'origem sem anulacao',
    })),
    updates: plan.updates.map((item) => ({ id: item.id, patch: item.patch })),
    inserts: plan.inserts,
  };

  console.log(JSON.stringify(summary, null, 2));
}

async function main() {
  const apply = process.argv.includes('--apply');
  const csvArgIndex = process.argv.indexOf('--csv');
  const csvPath = csvArgIndex >= 0 ? process.argv[csvArgIndex + 1] : DEFAULT_CSV_PATH;

  loadEnvFile(path.join(repoRoot, '.env'));
  loadEnvFile(path.join(repoRoot, '.env.local'));

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Defina SUPABASE_URL/VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente ou .env.');
  }

  const sourceRows = parseSourceRows(csvPath);
  const existingRows = await fetchExistingRows(
    createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    sourceRows.map((row) => row.notaCredito),
  );
  const plan = planChanges(sourceRows, existingRows);

  printSummary(plan, apply);

  if (apply) {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await applyChanges(supabase, plan);
    console.log('Aplicacao concluida.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
