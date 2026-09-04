-- Adiciona valor_unitario e valor_total na view manutencao_consumo_insumos
-- para permitir exibir o valor financeiro gasto no painel de Manutenção.

DROP VIEW IF EXISTS public.manutencao_consumo_insumos;

CREATE VIEW public.manutencao_consumo_insumos
WITH (security_invoker = true)
AS
SELECT
  material.id,
  'checkin'::text AS origem,
  checkin.created_at AS consumo_em,
  checkin.ambiente_id,
  ambiente.nome AS ambiente_nome,
  ambiente.codigo AS ambiente_codigo,
  ambiente.bloco AS ambiente_bloco,
  material.material AS material,
  material.quantidade::numeric AS quantidade,
  'UN'::text AS unidade,
  0::numeric AS valor_unitario,
  0::numeric AS valor_total,
  NULL::uuid AS requisicao_compra_id,
  NULL::text AS requisicao_numero,
  NULL::text AS requisicao_status
FROM public.manutencao_checkin_materiais material
JOIN public.manutencao_checkins checkin ON checkin.id = material.checkin_id
JOIN public.manutencao_ambientes ambiente ON ambiente.id = checkin.ambiente_id

UNION ALL

SELECT
  item.id,
  'requisicao_compra'::text AS origem,
  requisicao.consumo_iniciado_em AS consumo_em,
  refeitorio.id AS ambiente_id,
  refeitorio.nome AS ambiente_nome,
  refeitorio.codigo AS ambiente_codigo,
  refeitorio.bloco AS ambiente_bloco,
  item.description AS material,
  item.quantity::numeric AS quantidade,
  item.unit AS unidade,
  COALESCE(item.unit_price, 0)::numeric AS valor_unitario,
  ROUND((item.quantity * COALESCE(item.unit_price, 0))::numeric, 2) AS valor_total,
  requisicao.id AS requisicao_compra_id,
  requisicao.number AS requisicao_numero,
  requisicao.status AS requisicao_status
FROM public.requisicao_compra_itens item
JOIN public.requisicoes_compra requisicao ON requisicao.id = item.requisicao_compra_id
JOIN public.manutencao_ambientes refeitorio ON refeitorio.codigo = 'REFEITORIO'
WHERE requisicao.status <> 'draft'
  AND requisicao.consumo_iniciado_em IS NOT NULL;

GRANT SELECT ON public.manutencao_consumo_insumos TO authenticated;
