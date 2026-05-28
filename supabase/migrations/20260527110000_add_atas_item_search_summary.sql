create or replace view public.atas_registro_precos_resumo as
select
  atas.*,
  coalesce(item_counts.total_itens, 0) as total_itens,
  coalesce(participacoes.unidades_participantes, '{}'::text[]) as unidades_participantes,
  coalesce(participacoes.total_unidades_participantes, 0) as total_unidades_participantes,
  coalesce(adesoes.unidades_aderentes, '{}'::text[]) as unidades_aderentes,
  coalesce(adesoes.total_adesoes, 0) as total_adesoes,
  coalesce(item_counts.itens_texto_pesquisa, '') as itens_texto_pesquisa
from public.atas_registro_precos atas
left join (
  select
    ata_key,
    count(*)::integer as total_itens,
    string_agg(
      concat_ws(' ', numero_item, codigo_item, descricao_item, fornecedor_nome, fornecedor_ni),
      ' '
      order by numero_item
    ) as itens_texto_pesquisa
  from public.atas_registro_precos_itens
  group by ata_key
) item_counts on item_counts.ata_key = atas.ata_key
left join (
  select
    ata_key,
    array_agg(distinct unidade_codigo order by unidade_codigo) as unidades_participantes,
    count(distinct unidade_codigo)::integer as total_unidades_participantes
  from public.atas_registro_precos_unidades
  where coalesce(nullif(raw_data->>'tipoUnidade', ''), 'PARTICIPANTE') <> 'GERENCIADORA'
  group by ata_key
) participacoes on participacoes.ata_key = atas.ata_key
left join (
  select
    ata_key,
    array_agg(distinct unidade_codigo order by unidade_codigo) as unidades_aderentes,
    count(*)::integer as total_adesoes
  from public.atas_registro_precos_adesoes
  group by ata_key
) adesoes on adesoes.ata_key = atas.ata_key;
grant select on public.atas_registro_precos_resumo to authenticated;
