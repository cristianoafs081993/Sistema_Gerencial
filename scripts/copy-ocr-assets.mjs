// Copia para public/ocr os arquivos do tesseract.js que o navegador precisa carregar do proprio app
// (worker, nucleo WebAssembly e dados do idioma), para o OCR nao depender de CDN externa.
// Executado automaticamente por `predev` e `prebuild`. A pasta public/ocr e ignorada pelo git.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nodeModules = join(root, 'node_modules');
const outDir = join(root, 'public', 'ocr');

const assets = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  // O tesseract.js escolhe entre estes dois conforme o suporte a SIMD do navegador.
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'core/tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'core/tesseract-core-lstm.wasm.js'],
  ['@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz', 'lang/por.traineddata.gz'],
];

const missing = assets.filter(([from]) => !existsSync(join(nodeModules, from)));
if (missing.length) {
  console.error('[copy-ocr-assets] Arquivos nao encontrados em node_modules (rode `npm install`):');
  for (const [from] of missing) console.error(`  - ${from}`);
  process.exit(1);
}

let totalBytes = 0;
for (const [from, to] of assets) {
  const target = join(outDir, to);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(nodeModules, from), target);
  totalBytes += statSync(target).size;
}

console.log(`[copy-ocr-assets] ${assets.length} arquivos copiados para public/ocr (${(totalBytes / 1024 / 1024).toFixed(1)} MB).`);
