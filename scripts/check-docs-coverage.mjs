import { execFileSync } from 'node:child_process';

const [baseArg, headArg] = process.argv.slice(2);

function resolveRef(value, fallback) {
  if (value && value.trim()) return value.trim();
  if (process.env[fallback]) return process.env[fallback].trim();
  return '';
}

const baseRef = resolveRef(baseArg, 'DOCS_CHECK_BASE');
const headRef = resolveRef(headArg, 'DOCS_CHECK_HEAD') || 'HEAD';
const zeroShaPattern = /^0+$/;

if (!baseRef) {
  console.error('Base ref ausente. Use: node scripts/check-docs-coverage.mjs <base> <head>');
  process.exit(1);
}

function normalizeBaseRef(ref) {
  if (!zeroShaPattern.test(ref)) return ref;
  const output = execFileSync('git', ['rev-list', '--max-parents=0', headRef], { encoding: 'utf8' });
  return output
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .at(-1) ?? headRef;
}

const normalizedBaseRef = normalizeBaseRef(baseRef);

function readChangedFiles() {
  const output = execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=ACMR', normalizedBaseRef, headRef],
    { encoding: 'utf8' },
  );
  return output
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const changedFiles = readChangedFiles();

if (changedFiles.length === 0) {
  console.log('Nenhum arquivo alterado no intervalo informado.');
  process.exit(0);
}

const docsChanged = {
  database: changedFiles.some((file) => file.startsWith('docs/database/')),
  dataImport: changedFiles.some((file) => file.startsWith('docs/data-import/')),
  integrations: changedFiles.some((file) => file.startsWith('docs/integrations/')),
  ops: changedFiles.some((file) => file.startsWith('docs/ops/')),
  frontend: changedFiles.some((file) => file.startsWith('docs/frontend/')),
  designSystem: changedFiles.some((file) => file.startsWith('docs/design-system/')),
};

const importRelatedPatterns = [
  /^src\/services\/.*Import.*\.(ts|tsx)$/,
  /^src\/services\/transparencia\.ts$/,
  /^src\/components\/JsonImportDialog\.tsx$/,
  /^src\/components\/modals\/PFImportDialog\.tsx$/,
  /^src\/pages\/Financeiro\.tsx$/,
  /^src\/pages\/LC\.tsx$/,
  /^src\/pages\/LiquidacoesPagamentos\.tsx$/,
  /^src\/pages\/RetencoesFdReinfDesign\.tsx$/,
  /^src\/pages\/RastreabilidadePFs\//,
];

const integrationPatterns = [
  /^src\/lib\/supabase.*\.ts$/,
  /^src\/services\/.*Api.*\.(ts|tsx)$/,
  /^src\/services\/transparencia\.ts$/,
  /^src\/pages\/Consultor\.tsx$/,
  /^src\/pages\/EditorDocumentos\.tsx$/,
  /^supabase\/functions\//,
  /^vercel\.json$/,
  /^vite\.config\.ts$/,
];

const frontendPatterns = [
  /^src\/App\.tsx$/,
  /^src\/contexts\//,
  /^src\/pages\/Dashboard\.tsx$/,
  /^src\/pages\/Empenhos\.tsx$/,
];

const designSystemPatterns = [
  /^src\/components\/design-system\//,
  /^src\/pages\/DesignSystemPreview\.tsx$/,
  /^docs\/DESIGN_SYSTEM\.md$/,
];

const requirements = [
  {
    name: 'docs/database',
    triggered: changedFiles.some((file) => file.startsWith('supabase/migrations/')),
    satisfied: docsChanged.database,
    reason: 'Mudancas em migrations exigem atualizacao em docs/database.',
  },
  {
    name: 'docs/data-import',
    triggered: changedFiles.some((file) => importRelatedPatterns.some((pattern) => pattern.test(file))),
    satisfied: docsChanged.dataImport,
    reason: 'Mudancas em importadores e telas de carga exigem atualizacao em docs/data-import.',
  },
  {
    name: 'docs/integrations ou docs/ops',
    triggered: changedFiles.some((file) => integrationPatterns.some((pattern) => pattern.test(file))),
    satisfied: docsChanged.integrations || docsChanged.ops,
    reason: 'Mudancas em integracoes, proxies, Supabase ou functions exigem atualizacao em docs/integrations ou docs/ops.',
  },
  {
    name: 'docs/frontend',
    triggered: changedFiles.some((file) => frontendPatterns.some((pattern) => pattern.test(file))),
    satisfied: docsChanged.frontend,
    reason: 'Mudancas em fluxo de dados do frontend exigem atualizacao em docs/frontend.',
  },
  {
    name: 'docs/design-system',
    triggered: changedFiles.some((file) => designSystemPatterns.some((pattern) => pattern.test(file))),
    satisfied: docsChanged.designSystem,
    reason: 'Mudancas no design system exigem atualizacao em docs/design-system.',
  },
];

const failures = requirements.filter((item) => item.triggered && !item.satisfied);

if (failures.length > 0) {
  console.error('Falha na cobertura de documentacao.');
  failures.forEach((failure) => {
    console.error(`- ${failure.reason}`);
  });
  console.error('Arquivos alterados:');
  changedFiles.forEach((file) => {
    console.error(`  - ${file}`);
  });
  process.exit(1);
}

console.log('Cobertura de documentacao validada com sucesso.');
