// Disposable PostgreSQL/WASM: EMAIL_SQL_RUNTIME=.codex-temp/rd-sql node scripts/test-email-budget-balances-db.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(resolve(process.env.EMAIL_SQL_RUNTIME || '.codex-temp/rd-sql', 'package.json'));
const { PGlite } = require('@electric-sql/pglite');
const db = new PGlite();
const parser = (() => {
  const exports = {};
  const source = readFileSync('src/lib/emailCsvIngestion.ts', 'utf8');
  runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, TextDecoder });
  return exports;
})();
const source = readFileSync('supabase/functions/ingest-email-csv/index.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { applyParsedImport } = runInNewContext(compiled + '\n({ applyParsedImport });', {
  exports: {},
  require: (name) => {
    if (name.endsWith('/emailCsvIngestion.ts')) return parser;
    if (name.startsWith('https://esm.sh/@supabase/supabase-js')) return {};
    throw new Error(`Unexpected import: ${name}`);
  },
  Deno: { serve() {} },
  Response,
});

const tables = ['descentralizacoes_conta_saldos', 'creditos_disponiveis'];
const migration = readFileSync('supabase/migrations/20260907150000_add_user_campus_scope.sql', 'utf8');
const client = {
  from(table) {
    assert.ok(tables.includes(table));
    return {
      async upsert(rows, { onConflict }) {
        try {
          const columns = Object.keys(rows[0]);
          const values = rows.flatMap((row) => columns.map((column) => row[column]));
          const placeholders = rows.map((_, index) =>
            `(${columns.map((_, column) => `$${index * columns.length + column + 1}`).join(',')})`,
          );
          await db.query(
            `insert into ${table} (${columns.join(',')}) values ${placeholders.join(',')}
             on conflict (${onConflict}) do update set metrica = excluded.metrica,
             valor = excluded.valor, updated_at = excluded.updated_at`,
            values,
          );
          return { error: null };
        } catch (error) {
          return { error };
        }
      },
    };
  },
};

try {
  for (const table of tables) {
    await db.exec(`create table ${table} (
      campus_uasg text not null default '158366', ptres text not null,
      metrica text, valor numeric not null, updated_at timestamptz
    )`);
    const index = migration.match(new RegExp(
      `CREATE UNIQUE INDEX IF NOT EXISTS ${table}_campus_ptres_key[\\s\\S]*?;`,
    ));
    assert.ok(index, `Missing campus/PTRES index for ${table}`);
    await db.exec(index[0]);
    await db.exec(`insert into ${table} (campus_uasg, ptres, valor)
      values ('158366', '261941', 395178.17), ('158155', '261941', 999)`);
    const parsed = parser.parseEmailCsvImport({
      fileName: table === 'creditos_disponiveis' ? '3 - Credito Disponivel.csv' : '13 - Conta descentralizacoes.csv',
      text: '"PTRES","Metrica",\n"261941","Saldo","510.304,43"\n"231796","Saldo","2.161.616,80"',
    });
    assert.equal(parsed.pipeline, table);
    const first = await applyParsedImport(client, parsed, 'regression.csv');
    assert.equal(first.rowsWritten, 2);
    await applyParsedImport(client, parsed, 'regression.csv');
    const { rows } = await db.query(`select campus_uasg, ptres, valor::text as valor
      from ${table} order by campus_uasg, ptres`);
    assert.deepEqual(rows, [
      { campus_uasg: '158155', ptres: '261941', valor: '999' },
      { campus_uasg: '158366', ptres: '231796', valor: '2161616.8' },
      { campus_uasg: '158366', ptres: '261941', valor: '510304.43' },
    ]);
    console.log(`${table}: insert, update, idempotency and campus isolation passed`);
  }
} catch (error) {
  console.error(`${error.code || 'Regression failure'}: ${error.message}`);
  process.exitCode = 1;
} finally {
  await db.close();
}
