-- 1. Descoberta inicial: cadastra na tabela os órgãos já presentes nas atas ingeridas
insert into public.orgaos_atas_classificacao (
  cnpj,
  razao_social,
  classificacao,
  permite_adesao_ifrn,
  usar_somente_pesquisa_precos,
  observacoes
)
select distinct
  regexp_replace(coalesce(raw_payload ->> 'cnpjOrgao', ''), '\D', '', 'g') as cnpj,
  nullif(trim(coalesce(raw_payload ->> 'nomeOrgao', orgao_gerenciador, '')), '') as razao_social,
  'nao_classificado'::public.classificacao_orgao_adesao_atas as classificacao,
  null as permite_adesao_ifrn,
  false as usar_somente_pesquisa_precos,
  'Carga inicial automatica a partir das atas ingeridas.' as observacoes
from public.atas
where regexp_replace(coalesce(raw_payload ->> 'cnpjOrgao', ''), '\D', '', 'g') ~ '^[0-9]{14}$'
on conflict (cnpj) do update
set
  razao_social = coalesce(public.orgaos_atas_classificacao.razao_social, excluded.razao_social),
  updated_at = now();

-- 2. Exemplo de classificação explícita
-- Ajuste/expanda este bloco conforme a política do IFRN.
-- Sempre que um órgão só puder servir para pesquisa de preços:
--   permite_adesao_ifrn = false
--   usar_somente_pesquisa_precos = true

insert into public.orgaos_atas_classificacao (
  cnpj,
  razao_social,
  classificacao,
  natureza_juridica,
  permite_adesao_ifrn,
  usar_somente_pesquisa_precos,
  observacoes
)
values
  (
    '15126437000143',
    'EMPRESA BRASILEIRA DE SERVICOS HOSPITALARES',
    'empresa_publica',
    'Empresa publica federal',
    false,
    true,
    'Classificada para uso somente em pesquisa de preços no IFRN.'
  )
on conflict (cnpj) do update
set
  razao_social = excluded.razao_social,
  classificacao = excluded.classificacao,
  natureza_juridica = excluded.natureza_juridica,
  permite_adesao_ifrn = excluded.permite_adesao_ifrn,
  usar_somente_pesquisa_precos = excluded.usar_somente_pesquisa_precos,
  observacoes = excluded.observacoes,
  updated_at = now();

-- 3. Consulta de revisão
select
  cnpj,
  razao_social,
  classificacao,
  permite_adesao_ifrn,
  usar_somente_pesquisa_precos,
  observacoes
from public.orgaos_atas_classificacao
order by
  usar_somente_pesquisa_precos desc,
  classificacao,
  razao_social nulls last;
