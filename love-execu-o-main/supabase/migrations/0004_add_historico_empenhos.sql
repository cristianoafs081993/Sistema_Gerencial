-- Migration para adicionar histórico de operações nos empenhos
alter table public.empenhos
add column if not exists historico_operacoes jsonb default '[]'::jsonb;
