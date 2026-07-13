alter table public.price_researches
  add column if not exists search_filters jsonb not null default '{}'::jsonb;

comment on column public.price_researches.search_filters is
  'Filtros oficiais e locais usados na pesquisa de preços para restaurar o contexto da busca e curadoria.';