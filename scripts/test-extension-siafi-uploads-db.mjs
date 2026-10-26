import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(resolve(process.env.SIAFI_SQL_RUNTIME || '.codex-temp/rd-sql','package.json'));
const {PGlite}=require('@electric-sql/pglite');
const db=new PGlite();
// Stubs mínimos de auth e storage com a mesma semântica de foldername/filename do Supabase.
await db.exec(`create schema auth;create schema storage;create role anon;create role authenticated;create role service_role bypassrls;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default now(),updated_at timestamptz default now(),unique(bucket_id,name));
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
create function storage.filename(name text) returns text language sql as $$select (string_to_array(name,'/'))[array_length(string_to_array(name,'/'),1)]$$;
grant usage on schema auth,storage to authenticated,service_role;
grant select,insert,update,delete on storage.objects to authenticated;`);
await db.exec(await readFile(new URL('../supabase/migrations/20261023120000_extension_siafi_uploads.sql',import.meta.url),'utf8'));
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
const nup='23035002988202697';
await db.query('insert into auth.users values($1),($2)',[a,b]);
const bucket=(await db.query("select public,file_size_limit,allowed_mime_types from storage.buckets where id='siafi-capturas'")).rows[0];
assert.deepEqual([bucket.public,Number(bucket.file_size_limit),bucket.allowed_mime_types],[false,41943040,['application/pdf']],'bucket privado, 40 MB, só PDF');

const stage=(tenant,doc='2026NP000123',extra={})=>db.query(`insert into extension_siafi_uploads(process_key,document_key,document_label,file_name,storage_path,byte_size,open_requested,updated_at)
  values($1,$2,$2,$3,$4,$5,$6,'2000-01-01')
  on conflict(tenant_id,process_key,document_key) do update set file_name=excluded.file_name,byte_size=excluded.byte_size,opened_at=null,updated_at=excluded.updated_at
  returning *`,[extra.key||nup,doc,extra.name||'23035.002988.2026-97 - 2026NP000123.pdf',extra.path||`${tenant}/${extra.key||nup}/${doc}.pdf`,extra.size||1000,extra.open??true]);

await db.exec(`set role authenticated;set test.uid='${a}'`);
await db.query("insert into storage.objects(bucket_id,name) values('siafi-capturas',$1)",[`${a}/${nup}/2026NP000123.pdf`]);
await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('siafi-capturas',$1)",[`${b}/${nup}/2026NP000123.pdf`]),/row-level security/,'não grava na pasta de outro usuário');
await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('siafi-capturas',$1)",[`${a}/123/2026NP000123.pdf`]),/row-level security/,'exige NUP com 17 dígitos');
await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('siafi-capturas',$1)",[`${a}/${nup}/nome livre.pdf`]),/row-level security/,'nome do objeto restrito ao DH');
await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('siafi-capturas',$1)",[`${a}/${nup}/x/2026NP000123.pdf`]),/row-level security/,'sem subpastas extras');

const first=(await stage(a)).rows[0];
await stage(a,'2026NP000123',{name:'23035.002988.2026-97 - 2026NP000123 - EMPRESA.pdf'});
const rows=(await db.query('select * from extension_siafi_uploads')).rows;
assert.equal(rows.length,1,'nova captura do mesmo DH substitui a anterior');
assert.equal(rows[0].id,first.id);
assert.ok(rows[0].updated_at.getUTCFullYear()>2000,'o servidor carimba updated_at');
await stage(a,'2026NP000124');
assert.equal((await db.query('select * from extension_siafi_uploads')).rows.length,2,'DHs diferentes do mesmo processo coexistem');
await assert.rejects(stage(a,'2026NP000125',{path:`${b}/${nup}/2026NP000125.pdf`}),/check constraint/,'caminho precisa ser do próprio usuário');
await assert.rejects(stage(a,'2026NP000126',{key:'123'}),/check constraint/);
await assert.rejects(stage(a,'2026 NP',{path:`${a}/${nup}/2026 NP.pdf`}),/check constraint/);
await assert.rejects(stage(a,'2026NP000127',{size:41943041}),/check constraint/,'limite de 40 MB');
await assert.rejects(stage(a,'2026NP000128',{name:'captura.exe'}),/check constraint/);
await assert.rejects(db.query("insert into extension_siafi_uploads(tenant_id,process_key,document_key,file_name,storage_path,byte_size) values($1,$2,'X',$3,$4,1)",[b,nup,'x.pdf',`${b}/${nup}/X.pdf`]),/row-level security/);

// Reivindicação condicional: só o primeiro perfil abre a aba do upload.
const claim=()=>db.query('update extension_siafi_uploads set opened_at=now() where id=$1 and opened_at is null returning id',[first.id]);
assert.equal((await claim()).rows.length,1);
assert.equal((await claim()).rows.length,0,'segundo perfil não reabre');

await db.exec(`set test.uid='${b}'`);
assert.equal((await db.query('select * from extension_siafi_uploads')).rows.length,0,'outro usuário não lê');
assert.equal((await db.query("select * from storage.objects where bucket_id='siafi-capturas'")).rows.length,0,'outro usuário não lê o PDF');
await db.query('update extension_siafi_uploads set opened_at=null');
await db.query('delete from extension_siafi_uploads');
await db.query("delete from storage.objects where bucket_id='siafi-capturas'");
await db.exec(`set test.uid='${a}'`);
assert.equal((await db.query('select * from extension_siafi_uploads where opened_at is not null')).rows.length,1,'outro usuário não altera');
assert.equal((await db.query('select * from extension_siafi_uploads')).rows.length,2,'outro usuário não apaga');
assert.equal((await db.query("select * from storage.objects where bucket_id='siafi-capturas'")).rows.length,1);
await db.query("delete from storage.objects where bucket_id='siafi-capturas'");
assert.equal((await db.query("select * from storage.objects where bucket_id='siafi-capturas'")).rows.length,0,'dono apaga o próprio PDF');

await db.exec('reset role;set role anon');
await assert.rejects(db.query('select * from extension_siafi_uploads'),/permission denied/);

// Limpeza diária: lista arquivos anteriores ao corte (inclusive de outros usuários e órfãos), só para service_role.
await db.exec('reset role');
await db.query(`insert into storage.objects(bucket_id,name,created_at,updated_at) values
  ('siafi-capturas',$1,'2026-10-22 20:00-03','2026-10-22 20:00-03'),('siafi-capturas',$2,'2026-10-22 23:59-03','2026-10-22 23:59-03'),
  ('siafi-capturas',$3,'2026-10-23 00:01-03','2026-10-23 00:01-03'),('suap-pdfs',$4,'2026-10-01','2026-10-01')`,
  [`${a}/${nup}/ontem.pdf`,`${b}/${nup}/orfao.pdf`,`${a}/${nup}/hoje.pdf`,`${a}/1.pdf`]);
const candidates=(cutoff,limit=100)=>db.query('select name from public.siafi_capturas_cleanup_candidates($1,$2)',[cutoff,limit]);
assert.deepEqual((await candidates('2026-10-23 00:00-03')).rows.map(row=>row.name),[`${a}/${nup}/ontem.pdf`,`${b}/${nup}/orfao.pdf`],'só o bucket do printup e só antes do corte');
assert.equal((await candidates('2026-10-23 00:00-03',1)).rows.length,1,'respeita o lote');
await db.exec('set role authenticated');
await assert.rejects(candidates('2026-10-23 00:00-03'),/permission denied/,'usuário não lista arquivos alheios');

// Agendamento: segredo no Vault, função de disparo e job diário às 03:05 UTC (00:05 em Brasília).
await db.exec(`reset role;create schema vault;create schema cron;create schema net;
create table vault.secrets(name text primary key,secret text,description text);
create view vault.decrypted_secrets as select name,secret as decrypted_secret from vault.secrets;
create function vault.create_secret(s text,n text,d text) returns text language sql as $$insert into vault.secrets values(n,s,d) returning n$$;
create table cron.job(jobid bigserial primary key,jobname text,schedule text,command text);
create function cron.schedule(n text,s text,c text) returns bigint language sql as $$insert into cron.job(jobname,schedule,command) values(n,s,c) returning jobid$$;
create function cron.unschedule(id bigint) returns boolean language sql as $$delete from cron.job where jobid=id returning true$$;
create table net.calls(url text,headers jsonb);
create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds int) returns bigint language sql as $$insert into net.calls values(url,headers) returning 1::bigint$$;`);
const schedule=(await readFile(new URL('../supabase/migrations/20261023121000_schedule_siafi_capturas_cleanup.sql',import.meta.url),'utf8')).replace(/^CREATE EXTENSION.*$/gm,'');
await db.exec(schedule);await db.exec(schedule.replace(/CREATE FUNCTION/g,'CREATE OR REPLACE FUNCTION'));
const jobs=(await db.query("select schedule,command from cron.job where jobname='siafi-capturas-cleanup-daily'")).rows;
assert.deepEqual(jobs,[{schedule:'5 3 * * *',command:'select public.dispatch_siafi_capturas_cleanup();'}],'um único job diário, reaplicável');
const secret=(await db.query("select secret from vault.secrets where name='siafi_capturas_cleanup_secret'")).rows[0].secret;
assert.ok(secret.length>=64 && !jobs[0].command.includes(secret),'segredo fora do texto do cron');
await db.query('select public.dispatch_siafi_capturas_cleanup()');
const call=(await db.query('select url,headers from net.calls')).rows[0];
assert.equal(call.url,'https://mnqhwyrzhgykjlyyqodd.supabase.co/functions/v1/cleanup-siafi-capturas');
assert.equal(call.headers['x-cleanup-secret'],secret);
assert.equal((await db.query('select public.validate_siafi_capturas_cleanup_secret($1) ok',[secret])).rows[0].ok,true);
assert.equal((await db.query("select public.validate_siafi_capturas_cleanup_secret('x') ok")).rows[0].ok,false);
await db.exec('set role authenticated');
await assert.rejects(db.query('select public.dispatch_siafi_capturas_cleanup()'),/permission denied/);
await assert.rejects(db.query("select public.validate_siafi_capturas_cleanup_secret('x')"),/permission denied/);
await db.close();console.log('Capturas do printup: bucket privado, caminhos por usuário/NUP/DH, RLS, upsert por DH, carimbo do servidor, limites, reivindicação única, candidatos da limpeza e job diário aprovados.');
