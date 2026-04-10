alter table public.itens_ata
  add column if not exists valor_unitario numeric(18, 8),
  add column if not exists valor_total numeric(18, 8),
  add column if not exists quantidade_homologada_fornecedor numeric(18, 8),
  add column if not exists maximo_adesao numeric(18, 8),
  add column if not exists fornecedor_documento text,
  add column if not exists fornecedor_nome text,
  add column if not exists codigo_pdm text,
  add column if not exists nome_pdm text;

create index if not exists idx_itens_ata_fornecedor_documento on public.itens_ata (fornecedor_documento);
create index if not exists idx_itens_ata_codigo_pdm on public.itens_ata (codigo_pdm);
