-- Additive migration: existing prices are retained as unverified until confirmed.
alter table public.preco_referencia_itens
  add column if not exists price_kind text not null default 'nao_verificado',
  add column if not exists embedding_model text,
  add column if not exists raw_data jsonb not null default '{}'::jsonb;
alter table public.preco_referencia_sync_runs
  add column if not exists lease_token uuid,
  add column if not exists lease_until timestamptz,
  add column if not exists total_itens_novos integer not null default 0,
  add column if not exists total_itens_atualizados integer not null default 0;

create or replace function public.invalidate_preco_embedding() returns trigger
language plpgsql set search_path = public as $$
begin
  if (new.descricao_item, new.descricao_detalhada, new.marca) is distinct from
     (old.descricao_item, old.descricao_detalhada, old.marca) then
    new.embedding := null;
    new.embedding_model := null;
  end if;
  return new;
end; $$;
drop trigger if exists trg_preco_embedding_invalidated on public.preco_referencia_itens;
create trigger trg_preco_embedding_invalidated before update on public.preco_referencia_itens
  for each row execute function public.invalidate_preco_embedding();

create index if not exists idx_preco_ref_result_date on public.preco_referencia_itens(data_resultado desc);

-- Reciprocal rank fusion avoids comparing uncalibrated cosine/FTS/trigram scales.
create or replace function public.match_preco_referencia_v2(
  query_text text, query_embedding vector(768) default null,
  embedding_model text default 'gemini-embedding-001', match_count integer default 60,
  filter_catalog_type text default null, filter_catalog_code text default null,
  max_lookback_days integer default 365
) returns setof public.preco_referencia_itens
language sql stable security invoker set search_path = public, extensions as $$
  with eligible as not materialized (
    select i.* from public.preco_referencia_itens i
    where i.amostra_valida and i.valor_unitario > 0
      and coalesce(i.data_resultado, i.data_publicacao_pncp) >= now() - make_interval(days => least(365, greatest(1, max_lookback_days)))
      and coalesce(i.data_resultado, i.data_publicacao_pncp) <= now() + interval '1 day'
      and (filter_catalog_type is null or i.tipo_catalogo = filter_catalog_type)
      and (filter_catalog_code is null or i.codigo_item_catalogo = filter_catalog_code)
  ), semantic_candidates as materialized (
    select id, embedding <=> query_embedding as distance
    from eligible where query_embedding is not null and embedding is not null
      and eligible.embedding_model = match_preco_referencia_v2.embedding_model
    order by embedding <=> query_embedding limit 120
  ), semantic as (
    select id, row_number() over(order by distance) rank from semantic_candidates
  ), lexical as (
    select id, row_number() over (order by ts_rank_cd(search_tsv, plainto_tsquery('portuguese', query_text)) desc) rank
    from eligible where length(trim(query_text)) > 0 and search_tsv @@ plainto_tsquery('portuguese', query_text)
    order by ts_rank_cd(search_tsv, plainto_tsquery('portuguese', query_text)) desc limit 120
  ), fuzzy as (
    select id, row_number() over (order by extensions.word_similarity(query_text, descricao_item) desc) rank
    from eligible where length(trim(query_text)) > 0 and (descricao_item %> query_text or extensions.word_similarity(query_text, descricao_item) >= 0.25)
    order by extensions.word_similarity(query_text, descricao_item) desc limit 120
  ), fused as (
    select id, sum(1.0 / (60 + rank)) score
    from (select * from semantic union all select * from lexical union all select * from fuzzy) candidates
    group by id
  ) select i.* from public.preco_referencia_itens i join fused f using(id)
    order by f.score desc, i.data_resultado desc nulls last, i.id
    limit least(100, greatest(1, match_count));
$$;
grant execute on function public.match_preco_referencia_v2(text,vector,text,integer,text,text,integer) to authenticated;

-- Claim/resume atomically. Frozen dates and page size keep retries on the same window.
create or replace function public.claim_preco_sync(
  mode text, scope text, date_start date, date_end date, page_size integer,
  resume_id uuid default null
) returns public.preco_referencia_sync_runs
language plpgsql security definer set search_path = public as $$
declare r public.preco_referencia_sync_runs; token uuid := gen_random_uuid();
begin
  if mode not in ('backfill_mensal','daily_delta') or date_start > date_end or page_size not between 10 and 500 then
    raise exception 'Invalid sync parameters';
  end if;
  perform pg_advisory_xact_lock(hashtext('preco_sync:' || scope));
  if exists(select 1 from preco_referencia_sync_runs where escopo = scope and lease_until > now()) then
    raise exception 'Sincronização em andamento para este escopo';
  end if;
  select * into r from preco_referencia_sync_runs
  where escopo = scope and tipo_sync = mode and cursor_data->>'version' = '2'
    and status in ('partial_success','error','running')
    and (resume_id is null or id = resume_id)
    and (mode = 'daily_delta' or (data_inicial = date_start and data_final = date_end))
  order by started_at asc limit 1 for update;
  if r.id is null and resume_id is not null then raise exception 'Execução não disponível para retomada'; end if;
  if r.id is null then
    insert into preco_referencia_sync_runs(tipo_sync, ano, mes, data_inicial, data_final, escopo, cursor_data)
    values(mode, extract(year from date_start)::int,
      case when mode = 'backfill_mensal' then extract(month from date_start)::int end,
      date_start, date_end, scope, jsonb_build_object('version',2,'page',1,'pageSize',page_size)) returning * into r;
  end if;
  update preco_referencia_sync_runs set status = 'running', error_message = null,
    lease_token = token, lease_until = now() + interval '5 minutes', finished_at = null
    where id = r.id returning * into r;
  return r;
end; $$;

-- The page upsert, new/update counts and cursor advance commit in one transaction.
create or replace function public.ingest_preco_page(run_id uuid, token uuid, page integer, records jsonb, consulted integer, total_pages integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r preco_referencia_sync_runs; fresh integer; changed integer;
begin
  select * into r from preco_referencia_sync_runs where id = run_id for update;
  if r.id is null or r.lease_token is distinct from token or r.lease_until < now() then raise exception 'Lease inválida'; end if;
  if (r.cursor_data->>'page')::integer <> page then raise exception 'Página já processada ou fora de ordem'; end if;
  with input as (
    select * from jsonb_populate_recordset(null::public.preco_referencia_itens, records)
  ), written as (
    insert into preco_referencia_itens(numero_controle_pncp, numero_item, source_id, codigo_item_catalogo, tipo_catalogo,
      descricao_item, descricao_detalhada, unidade_medida, quantidade, valor_unitario, valor_total, marca,
      fornecedor_nome, fornecedor_cnpj, orgao_nome, orgao_cnpj, orgao_esfera, orgao_uf, uasg_codigo, modalidade_nome,
      ano_compra, numero_compra, data_publicacao_pncp, data_resultado, link_pncp, amostra_valida, sync_run_id, price_kind, raw_data)
    select numero_controle_pncp, numero_item, source_id, codigo_item_catalogo, tipo_catalogo, descricao_item, descricao_detalhada,
      unidade_medida, quantidade, valor_unitario, valor_total, marca, fornecedor_nome, fornecedor_cnpj,
      orgao_nome, orgao_cnpj, orgao_esfera, orgao_uf, uasg_codigo, modalidade_nome, ano_compra, numero_compra,
      data_publicacao_pncp, data_resultado, link_pncp, amostra_valida, run_id, price_kind, raw_data from input
    on conflict(numero_controle_pncp, numero_item) do update set
      codigo_item_catalogo = excluded.codigo_item_catalogo, tipo_catalogo = excluded.tipo_catalogo,
      descricao_item = excluded.descricao_item, descricao_detalhada = excluded.descricao_detalhada,
      unidade_medida = excluded.unidade_medida, quantidade = excluded.quantidade, valor_unitario = excluded.valor_unitario,
      valor_total = excluded.valor_total, marca = excluded.marca, fornecedor_nome = excluded.fornecedor_nome,
      fornecedor_cnpj = excluded.fornecedor_cnpj, orgao_nome = excluded.orgao_nome, orgao_esfera = excluded.orgao_esfera,
      orgao_uf = excluded.orgao_uf, uasg_codigo = excluded.uasg_codigo, modalidade_nome = excluded.modalidade_nome,
      data_publicacao_pncp = excluded.data_publicacao_pncp, data_resultado = excluded.data_resultado,
      link_pncp = excluded.link_pncp, price_kind = excluded.price_kind, raw_data = excluded.raw_data, sync_run_id = run_id
    returning (xmax = 0) as inserted
  ) select count(*) filter(where inserted), count(*) filter(where not inserted) into fresh, changed from written;
  update preco_referencia_sync_runs set total_compras_consultadas = total_compras_consultadas + consulted,
    total_itens_ingeridos = total_itens_ingeridos + fresh + changed,
    total_itens_novos = total_itens_novos + fresh, total_itens_atualizados = total_itens_atualizados + changed,
    cursor_data = cursor_data || jsonb_build_object('page', page + 1, 'totalPaginas', total_pages),
    lease_until = now() + interval '5 minutes' where id = run_id;
  return jsonb_build_object('inserted',fresh,'updated',changed);
end; $$;
revoke all on function public.claim_preco_sync(text,text,date,date,integer,uuid) from public, anon, authenticated;
revoke all on function public.ingest_preco_page(uuid,uuid,integer,jsonb,integer,integer) from public, anon, authenticated;
grant execute on function public.claim_preco_sync(text,text,date,date,integer,uuid) to service_role;
grant execute on function public.ingest_preco_page(uuid,uuid,integer,jsonb,integer,integer) to service_role;
