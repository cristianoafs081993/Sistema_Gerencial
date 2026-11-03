import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(resolve(process.env.SIAFI_SQL_RUNTIME || '.codex-temp/rd-sql','package.json'));
const {PGlite}=require('@electric-sql/pglite');
const db=new PGlite();
await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role bypassrls;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
grant usage on schema auth to authenticated,service_role;`);
await db.exec(await readFile(new URL('../supabase/migrations/20261014150000_extension_process_registry.sql',import.meta.url),'utf8'));
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
const perfilSuap='11111111-1111-4111-8111-111111111111',perfilSiafi='22222222-2222-4222-8222-222222222222';
await db.query('insert into auth.users values($1),($2)',[a,b]);
const upsert=(perfil,chave,payload='{}')=>db.query(`insert into extension_process_registry(profile_id,process_key,suap_id,process_number,payload,updated_at)
  values($1,$2,$2,'23035.000001.2026-01',$3,'2000-01-01')
  on conflict(tenant_id,profile_id,process_key) do update set payload=excluded.payload,updated_at=excluded.updated_at`,[perfil,chave,payload]);

await db.exec(`set role authenticated;set test.uid='${a}'`);
await upsert(perfilSuap,'495256','{"fields":[{"label":"CPF","value":"1"}]}');
await upsert(perfilSuap,'495256','{"fields":[{"label":"CPF","value":"2"}]}');
await upsert(perfilSiafi,'495256');
const rows=(await db.query('select profile_id,payload,updated_at from extension_process_registry order by profile_id')).rows;
assert.equal(rows.length,2,'um registro por perfil e processo');
assert.equal(rows[0].payload.fields[0].value,'2','upsert substitui o payload');
assert.ok(rows.every((row)=>row.updated_at.getUTCFullYear()>2000),'o servidor carimba updated_at');
assert.equal((await db.query('select * from extension_process_registry where profile_id<>$1',[perfilSiafi])).rows.length,1);
await assert.rejects(db.query("insert into extension_process_registry(tenant_id,profile_id,process_key) values($1,$2,'1')",[b,perfilSuap]),/row-level security/);
await assert.rejects(upsert('perfil-invalido','1'),/check constraint/);
await assert.rejects(upsert(perfilSuap,'1',JSON.stringify({blob:'x'.repeat(270000)})),/check constraint/);
await assert.rejects(upsert(perfilSuap,'1','[]'),/check constraint/);

await db.exec(`set test.uid='${b}'`);
assert.equal((await db.query('select * from extension_process_registry')).rows.length,0,'outro usuário não lê');
await db.query('update extension_process_registry set payload=$1',['{"invadido":true}']);
await db.query('delete from extension_process_registry');
await db.exec(`set test.uid='${a}'`);
assert.equal((await db.query('select * from extension_process_registry')).rows.length,2,'outro usuário não altera nem apaga');
assert.ok((await db.query('select payload from extension_process_registry')).rows.every((row)=>!row.payload.invadido));
await db.query('delete from extension_process_registry where profile_id=$1',[perfilSuap]);
assert.equal((await db.query('select * from extension_process_registry')).rows.length,1);

await db.exec('reset role;set role anon');
await assert.rejects(db.query('select * from extension_process_registry'),/permission denied/);
await db.close();console.log('Registro de processos da extensão: RLS por usuário, upsert por perfil, carimbo do servidor e limites aprovados.');
