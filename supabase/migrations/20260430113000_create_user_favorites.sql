CREATE TABLE IF NOT EXISTS public.user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('empenho', 'contrato')),
  empenho_id UUID REFERENCES public.empenhos(id) ON DELETE CASCADE,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_favorites_entity_check CHECK (
    (entity_type = 'empenho' AND empenho_id IS NOT NULL AND contrato_id IS NULL)
    OR
    (entity_type = 'contrato' AND contrato_id IS NOT NULL AND empenho_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_favorites_unique_empenho
  ON public.user_favorites (user_id, empenho_id)
  WHERE entity_type = 'empenho' AND empenho_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_favorites_unique_contrato
  ON public.user_favorites (user_id, contrato_id)
  WHERE entity_type = 'contrato' AND contrato_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_entity
  ON public.user_favorites (user_id, entity_type, created_at DESC);

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios leem seus favoritos" ON public.user_favorites;
CREATE POLICY "Usuarios leem seus favoritos"
  ON public.user_favorites
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Usuarios inserem seus favoritos" ON public.user_favorites;
CREATE POLICY "Usuarios inserem seus favoritos"
  ON public.user_favorites
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Usuarios removem seus favoritos" ON public.user_favorites;
CREATE POLICY "Usuarios removem seus favoritos"
  ON public.user_favorites
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.user_favorites TO authenticated;
