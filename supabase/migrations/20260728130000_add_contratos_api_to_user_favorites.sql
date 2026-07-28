ALTER TABLE public.user_favorites
  ADD COLUMN IF NOT EXISTS contrato_api_id UUID REFERENCES public.contratos_api(id) ON DELETE CASCADE;

ALTER TABLE public.user_favorites
  DROP CONSTRAINT IF EXISTS user_favorites_entity_check;

ALTER TABLE public.user_favorites
  ADD CONSTRAINT user_favorites_entity_check CHECK (
    (entity_type = 'empenho' AND empenho_id IS NOT NULL AND contrato_id IS NULL AND contrato_api_id IS NULL)
    OR
    (entity_type = 'contrato' AND contrato_id IS NOT NULL AND empenho_id IS NULL AND contrato_api_id IS NULL)
    OR
    (entity_type = 'contrato_api' AND contrato_api_id IS NOT NULL AND empenho_id IS NULL AND contrato_id IS NULL)
  );

ALTER TABLE public.user_favorites
  DROP CONSTRAINT IF EXISTS user_favorites_entity_type_check;

ALTER TABLE public.user_favorites
  ADD CONSTRAINT user_favorites_entity_type_check
  CHECK (entity_type IN ('empenho', 'contrato', 'contrato_api'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_favorites_unique_contrato_api
  ON public.user_favorites (user_id, contrato_api_id)
  WHERE entity_type = 'contrato_api' AND contrato_api_id IS NOT NULL;