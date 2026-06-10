import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import * as XLSX from 'xlsx';

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSearchText(value) {
  return normalizeText(value)
    .split(' ')
    .map((token) => (
      token.length > 4 && token.endsWith('s') && !token.endsWith('ss')
        ? token.slice(0, -1)
        : token
    ))
    .join(' ');
}

function writeCatalog(outputPath, payload) {
  const outputDirectory = path.dirname(outputPath);
  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory, { recursive: true });
  }
  const json = JSON.stringify(payload);
  fs.writeFileSync(outputPath, gzipSync(json, { level: 9 }));
  console.log(`${path.basename(outputPath)}: ${payload.entries.length} registros, ${json.length} bytes antes do gzip`);
}

function buildCatmat(sourcePath) {
  const workbook = XLSX.readFile(sourcePath, { dense: true });
  const worksheet = workbook.Sheets.Materiais ?? workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });

  return rows.slice(1).flatMap((row) => {
    const code = String(row[6] ?? '').replace(/\D/g, '');
    const description = String(row[7] ?? '').trim();
    if (!code || !description) return [];
    const context = [row[1], row[3], row[5]].map((value) => String(value ?? '').trim()).filter(Boolean).join(' > ');
    return [[code, description, context, normalizeSearchText(`${description} ${context}`)]];
  });
}

function buildCatser(sourcePath) {
  const workbook = XLSX.readFile(sourcePath, { dense: true });
  const worksheet = workbook.Sheets['Lista CATSER'] ?? workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });

  return rows.slice(3).flatMap((row) => {
    const code = String(row[5] ?? '').replace(/\D/g, '');
    const description = String(row[6] ?? '').trim();
    const status = normalizeText(row[7]);
    if (!code || !description || status !== 'ativo') return [];
    const context = [row[2], row[4]].map((value) => String(value ?? '').trim()).filter(Boolean).join(' > ');
    return [[code, description, context, normalizeSearchText(`${description} ${context}`)]];
  });
}

const [, , catmatSource, catserSource, outputDirectory = 'public/catalogs'] = process.argv;
if (!catmatSource || !catserSource) {
  console.error('Uso: node scripts/generate-price-catalogs.mjs <CATMAT.xlsx> <CATSER.xlsx> [diretorio-saida]');
  process.exit(1);
}

const generatedAt = new Date().toISOString();
writeCatalog(path.join(outputDirectory, 'catmat.json.gz'), {
  version: 1,
  type: 'material',
  generatedAt,
  source: path.basename(catmatSource),
  entries: buildCatmat(catmatSource),
});
writeCatalog(path.join(outputDirectory, 'catser.json.gz'), {
  version: 1,
  type: 'service',
  generatedAt,
  source: path.basename(catserSource),
  entries: buildCatser(catserSource),
});
