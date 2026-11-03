-- Reduz o tamanho do banco (plano Free: 500 MB) e o volume de logs gerados por crons.
set local statement_timeout = 0;

-- 1. Base de preços de referência desativada por enquanto: apaga os dados (embeddings + HNSW
--    respondiam por ~500 MB) e para os jobs que a reabasteceriam. Para reativar, reagende
--    sync-precos-referencia-daily/-resume e precos-embeddings-pending e rode o backfill.
truncate table public.preco_referencia_itens;

do $$
declare v_job record;
begin
  for v_job in
    select jobid from cron.job
    where jobname in ('sync-precos-referencia-daily', 'sync-precos-referencia-resume', 'precos-embeddings-pending')
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end;
$$;

-- 2. Snapshots do Plano 8 do SUAP: só o mais recente por organização/unidade importa.
--    Previews das últimas 24 h seguem aplicáveis e são preservados.
delete from public.suap_plan_activity_snapshots s
using public.suap_plan_sync_runs r
where s.run_id = r.id
  and r.id not in (
    select distinct on (org_id, plan_id, suap_unit_code) id
    from public.suap_plan_sync_runs
    where status = 'success'
    order by org_id, plan_id, suap_unit_code, started_at desc
  )
  and not (r.status = 'preview' and r.started_at > now() - interval '1 day');

create or replace function public.prune_suap_plan_snapshots_on_success()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'success' and old.status is distinct from 'success' then
    delete from public.suap_plan_activity_snapshots s
    using public.suap_plan_sync_runs r
    where s.run_id = r.id
      and r.id <> new.id
      and r.org_id = new.org_id
      and r.plan_id = new.plan_id
      and r.suap_unit_code = new.suap_unit_code
      and r.started_at < new.started_at;
  end if;
  return new;
end;
$$;
revoke all on function public.prune_suap_plan_snapshots_on_success() from public, anon, authenticated;

drop trigger if exists trg_prune_suap_plan_snapshots on public.suap_plan_sync_runs;
create trigger trg_prune_suap_plan_snapshots
after update of status on public.suap_plan_sync_runs
for each row execute function public.prune_suap_plan_snapshots_on_success();

-- 3. Bloat: DELETE/UPDATE não devolvem espaço em disco. CLUSTER reescreve tabela e índices.
do $$
declare
  v_table text;
  v_index text;
begin
  foreach v_table in array array[
    'contratos_api_recursos', 'atas_registro_precos_itens', 'contratos_api', 'contratos_api_faturas',
    'contratos_api_itens', 'contratos_api_historico', 'contratos_api_fatura_itens',
    'contratos_api_fatura_empenhos', 'contratos_api_empenhos', 'contratos_api_compras_documentos',
    'suap_plan_activity_snapshots', 'atividades', 'lc_credores', 'suap_requisicoes_despesa'
  ] loop
    if to_regclass('public.' || v_table) is null then continue; end if;
    select c.relname into v_index
    from pg_index i join pg_class c on c.oid = i.indexrelid
    where i.indrelid = ('public.' || v_table)::regclass and i.indisprimary;
    if v_index is not null then
      execute format('cluster public.%I using %I', v_table, v_index);
      execute format('analyze public.%I', v_table);
    end if;
  end loop;
  if to_regclass('public.idx_chunks_embedding') is not null then
    reindex index public.idx_chunks_embedding;
  end if;
end;
$$;

-- 4. Histórico do pg_cron: mantém só as últimas execuções de cada job (e limpa respostas do pg_net).
create or replace function public.purge_cron_run_details(p_keep integer default 10)
returns bigint language plpgsql security definer set search_path = public, cron as $$
declare v_deleted bigint;
begin
  delete from cron.job_run_details d
  using (
    select runid, row_number() over (partition by jobid order by start_time desc nulls last, runid desc) as rn
    from cron.job_run_details
  ) r
  where d.runid = r.runid and r.rn > greatest(coalesce(p_keep, 10), 1);
  get diagnostics v_deleted = row_count;
  begin
    delete from net._http_response where created < now() - interval '1 hour';
  exception when others then
    null;
  end;
  return v_deleted;
end;
$$;
revoke all on function public.purge_cron_run_details(integer) from public, anon, authenticated;

select public.purge_cron_run_details(10);
-- 06:40 UTC = 03:40 em Brasília.
select cron.schedule('purge-cron-run-details-daily', '40 6 * * *', 'select public.purge_cron_run_details(10);');

-- 5. Crons sub-horários passam a rodar de hora em hora (reduz logs e invocações).
do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'sync-contratos-pncp-documentos-batch';
  if v_job_id is not null then
    perform cron.alter_job(v_job_id, schedule := '7 * * * *');
  end if;
end;
$$;
