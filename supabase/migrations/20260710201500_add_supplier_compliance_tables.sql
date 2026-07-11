-- Migração para adicionar campos de compliance e histórico de certidões de fornecedores

-- 1. Adicionar colunas de localização e regularidade na tabela public.suppliers
alter table public.suppliers 
  add column if not exists city text,
  add column if not exists uf varchar(2),
  add column if not exists status_regularidade text default 'NAO_VALIDADO';

-- 2. Criar a tabela de certidões e idoneidade
create table if not exists public.supplier_certificates (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  tipo_certidao text not null,          -- 'TCU_CNJ_CEIS_CNEP', 'RFB', 'FGTS', 'CNDT', 'FALENCIA'
  numero_certidao text,
  situacao text not null,              -- 'REGULAR', 'IRREGULAR', 'PENDENTE'
  data_emissao timestamptz,
  data_validade timestamptz,
  pdf_url text,                        -- link para o PDF no bucket/storage
  detalhes_sancao jsonb,               -- detalhes das sanções encontradas (se houver)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexadores recomendados
create index if not exists idx_supplier_certificates_supplier on public.supplier_certificates (supplier_id);
create index if not exists idx_supplier_certificates_type on public.supplier_certificates (tipo_certidao);

-- Trigger para updated_at na tabela de certidões
drop trigger if exists trg_update_supplier_certificates_updated_at on public.supplier_certificates;
create trigger trg_update_supplier_certificates_updated_at
  before update on public.supplier_certificates
  for each row execute function update_updated_at_column();

-- 3. Habilitar Row Level Security (RLS)
alter table public.supplier_certificates enable row level security;

-- Políticas de acesso para usuários autenticados
drop policy if exists "Users can read all certificates" on public.supplier_certificates;
create policy "Users can read all certificates"
  on public.supplier_certificates for select to authenticated
  using (true);

drop policy if exists "Users can manage all certificates" on public.supplier_certificates;
create policy "Users can manage all certificates"
  on public.supplier_certificates for all to authenticated
  using (true)
  with check (true);

-- Permissões
grant select, insert, update, delete on public.supplier_certificates to authenticated;
