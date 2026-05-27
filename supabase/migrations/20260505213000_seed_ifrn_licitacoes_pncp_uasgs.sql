insert into public.licitacoes_pncp_uasgs (
  codigo_uasg,
  nome_uasg,
  codigo_orgao,
  cnpj_orgao,
  sigla_uf,
  raw_data
)
values
  ('152711', 'Natal - Cidade Alta', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":[]}'::jsonb),
  ('152756', 'Parnamirim', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":[]}'::jsonb),
  ('152757', 'Nova Cruz', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":[]}'::jsonb),
  ('154582', 'Sao Goncalo do Amarante', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":[]}'::jsonb),
  ('154838', 'Ceara-Mirim', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":[]}'::jsonb),
  ('154839', 'Canguaretama', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":[]}'::jsonb),
  ('154840', 'Sao Paulo do Potengi', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":[]}'::jsonb),
  ('158155', 'Reitoria', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":["Lajes","Natal - Zona Leste (EAD)"]}'::jsonb),
  ('158365', 'Mossoro', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":[]}'::jsonb),
  ('158366', 'Currais Novos', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":["Jucurutu","Parelhas"]}'::jsonb),
  ('158367', 'Ipanguacu', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":[]}'::jsonb),
  ('158368', 'Natal - Zona Norte', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":[]}'::jsonb),
  ('158369', 'Natal - Central', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":[]}'::jsonb),
  ('158370', 'Caico', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":[]}'::jsonb),
  ('158371', 'Apodi', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":[]}'::jsonb),
  ('158372', 'Santa Cruz', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":[]}'::jsonb),
  ('158373', 'Joao Camara', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":[]}'::jsonb),
  ('158374', 'Pau dos Ferros', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":[]}'::jsonb),
  ('158375', 'Macau', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":[]}'::jsonb)
on conflict (codigo_uasg) do update
set nome_uasg = excluded.nome_uasg,
    codigo_orgao = excluded.codigo_orgao,
    cnpj_orgao = excluded.cnpj_orgao,
    sigla_uf = excluded.sigla_uf,
    raw_data = excluded.raw_data,
    updated_at = now();
