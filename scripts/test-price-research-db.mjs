// Disposable PostgreSQL/WASM database. Never connects to Supabase.
// npm install --prefix /tmp/price-sql @electric-sql/pglite @electric-sql/pglite-pgvector
// PRICE_SQL_RUNTIME=/tmp/price-sql node scripts/test-price-research-db.mjs
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(resolve(process.env.PRICE_SQL_RUNTIME || '.', 'package.json'));
const { PGlite } = require('@electric-sql/pglite');
const { vector } = require('@electric-sql/pglite-pgvector');
const { pg_trgm } = require('@electric-sql/pglite/contrib/pg_trgm');
const { unaccent } = require('@electric-sql/pglite/contrib/unaccent');
const db = new PGlite({ extensions: { vector, pg_trgm, unaccent } });
await db.exec('create schema extensions; create role anon; create role authenticated; create role service_role;');
for (const file of ['20260905100000_create_preco_referencia_base.sql','20260907010000_price_research_precision.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
const claim = async resume => (await db.query("select * from claim_preco_sync('backfill_mensal','nacional','2026-01-01','2026-01-31',100,$1)",[resume || null])).rows[0];
const r = await claim();
await assert.rejects(claim(), /andamento/);
const record={numero_controle_pncp:'12345678000100-1-000001/2026',numero_item:1,source_id:'item',tipo_catalogo:'material',
  descricao_item:'notebook 16 GB RAM SSD 512 GB',unidade_medida:'UN',quantidade:10,valor_unitario:4000,valor_total:40000,
  orgao_nome:'Órgão de teste',orgao_cnpj:'12345678000100',orgao_esfera:'Federal',ano_compra:2026,
  data_publicacao_pncp:new Date().toISOString(),data_resultado:new Date().toISOString(),amostra_valida:true,price_kind:'homologado',raw_data:{}};
const ingest = async (run,page,records=[record]) => (await db.query('select ingest_preco_page($1,$2,$3,$4,100,25) as counts',[run.id,run.lease_token,page,JSON.stringify(records)])).rows[0].counts;
assert.deepEqual(await ingest(r,1),{inserted:1,updated:0});
await assert.rejects(ingest(r,1), /fora de ordem/);
for (let page=2;page<=10;page++) await ingest(r,page);
await db.query("update preco_referencia_sync_runs set status='partial_success',lease_until=null where id=$1",[r.id]);
const resumed=await claim(r.id);
assert.equal(resumed.cursor_data.page,11);
assert.equal(resumed.total_itens_novos,1);
assert.equal(resumed.total_itens_atualizados,9);
await assert.rejects(ingest(r,11),/Lease/);
await assert.rejects(ingest(resumed,11,[{...record,valor_unitario:-1}]),/check constraint/);
assert.equal((await db.query('select cursor_data from preco_referencia_sync_runs where id=$1',[r.id])).rows[0].cursor_data.page,11);
assert.deepEqual(await ingest(resumed,11),{inserted:0,updated:1});
const found=await db.query("select numero_item from match_preco_referencia_v2('notebook 16 GB',null,'gemini-embedding-001',60,'material',null,365)");
assert.equal(found.rows.length,1);
assert.equal((await db.query("select * from match_preco_referencia_v2('notebook',null,'gemini-embedding-001',60,'servico',null,365)")).rows.length,0);
const vec=JSON.stringify(Array(768).fill(0.1));
await db.query("update preco_referencia_itens set embedding=$1::vector,embedding_model='gemini-embedding-001'",[vec]);
await db.query("update preco_referencia_itens set descricao_item='Notebook 32 GB RAM'");
assert.equal((await db.query('select embedding,embedding_model from preco_referencia_itens')).rows[0].embedding,null);
await db.exec('set role authenticated;');
await assert.rejects(claim(),/permission denied/);
await db.close();
console.log('SQL validado: migrations, busca textual/filtros, retomada 11/25, lease concorrente, rollback, contagens e invalidação de embeddings.');
