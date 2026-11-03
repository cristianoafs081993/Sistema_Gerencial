-- Compatibilidade: a retenção de PDFs do SUAP passou a expirar objetos pelo próprio Storage
-- (suap_expired_pdf_candidates, migration 20261031120000) e o desenho anterior (processos.pdf_last_used_at,
-- suap_pdf_retention_leases e touch_suap_process_pdf, migration 20261019110000) não existe mais no remoto.
-- O código ainda chama touch_suap_process_pdf (Edge Functions process-pdf/process-pdf-worker e app web) e trata
-- qualquer falha como erro, o que quebrava todo processamento/abertura de PDF
-- ("Could not find the function public.touch_suap_process_pdf(...) in the schema cache").
-- Esta função mantém a assinatura e as permissões antigas e não faz nada: o uso de um PDF não precisa mais ser registrado.
create or replace function public.touch_suap_process_pdf(
  p_processo_id uuid default null,
  p_storage_path text default null,
  p_suap_id text default null
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select true;
$$;

revoke all on function public.touch_suap_process_pdf(uuid, text, text) from public, anon;
grant execute on function public.touch_suap_process_pdf(uuid, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
