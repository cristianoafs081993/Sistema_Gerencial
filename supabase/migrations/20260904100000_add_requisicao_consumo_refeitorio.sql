-- Alimenta o painel de Manutenção com os insumos requisitados para o Refeitório.
-- A origem continua sendo a requisição: a view evita duplicar movimentos de consumo.

ALTER TABLE public.requisicoes_compra
  ADD COLUMN IF NOT EXISTS consumo_iniciado_em timestamptz;

INSERT INTO public.manutencao_ambientes (codigo, nome, bloco, tipo, status)
VALUES ('REFEITORIO', 'Refeitório', 'Refeitório', 'outros', 'ativo')
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome,
    bloco = EXCLUDED.bloco,
    tipo = EXCLUDED.tipo,
    status = EXCLUDED.status;

-- Requisições já enviadas não possuem data histórica de transição. updated_at é a
-- melhor aproximação disponível e só é usada uma vez nesta migração.
UPDATE public.requisicoes_compra
SET consumo_iniciado_em = updated_at
WHERE status <> 'draft'
  AND consumo_iniciado_em IS NULL;

CREATE OR REPLACE FUNCTION public.set_requisicao_consumo_iniciado_em()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'draft' THEN
    NEW.consumo_iniciado_em := NULL;
  ELSIF NEW.consumo_iniciado_em IS NULL THEN
    NEW.consumo_iniciado_em := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_requisicao_consumo_iniciado_em ON public.requisicoes_compra;
CREATE TRIGGER trg_set_requisicao_consumo_iniciado_em
BEFORE INSERT OR UPDATE OF status ON public.requisicoes_compra
FOR EACH ROW
EXECUTE FUNCTION public.set_requisicao_consumo_iniciado_em();

CREATE OR REPLACE VIEW public.manutencao_consumo_insumos
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
  requisicao.id AS requisicao_compra_id,
  requisicao.number AS requisicao_numero,
  requisicao.status AS requisicao_status
FROM public.requisicao_compra_itens item
JOIN public.requisicoes_compra requisicao ON requisicao.id = item.requisicao_compra_id
JOIN public.manutencao_ambientes refeitorio ON refeitorio.codigo = 'REFEITORIO'
WHERE requisicao.status <> 'draft'
  AND requisicao.consumo_iniciado_em IS NOT NULL;

GRANT SELECT ON public.manutencao_consumo_insumos TO authenticated;
