alter table public.price_researches
  add column if not exists institution_name text,
  add column if not exists institution_unit text,
  add column if not exists institution_details text,
  add column if not exists institution_logo text,
  add column if not exists report_servers jsonb not null default '[]'::jsonb;
