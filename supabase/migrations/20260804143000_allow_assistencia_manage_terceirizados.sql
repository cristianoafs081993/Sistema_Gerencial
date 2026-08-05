-- Permite que o grupo Assistência administre terceirizados e seus vínculos.
-- A tela já é liberada para esse grupo em user_group_screen_permissions,
-- mas as policies antigas consideravam apenas diretores/fiscais/teste.

CREATE OR REPLACE FUNCTION public.check_user_can_manage_terceirizados(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_superadmin_jwt()
    OR EXISTS (
      SELECT 1
      FROM public.user_group_memberships membership
      JOIN public.user_groups group_row ON group_row.id = membership.group_id
      WHERE membership.user_id = p_user_id
        AND group_row.slug IN ('diretores', 'fiscal-contratos', 'teste', 'assistencia')
    );
$$;

GRANT EXECUTE ON FUNCTION public.check_user_can_manage_terceirizados(uuid) TO authenticated;

DROP POLICY IF EXISTS "Leitura de terceirizados" ON public.terceirizados;
CREATE POLICY "Leitura de terceirizados"
  ON public.terceirizados FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.check_user_can_manage_terceirizados(auth.uid())
    OR (
      public.normalize_terceirizado_matricula(matricula) <> ''
      AND public.normalize_terceirizado_matricula(matricula) = public.normalize_terceirizado_matricula(
        coalesce(
          auth.jwt() -> 'user_metadata' ->> 'matricula',
          auth.jwt() -> 'user_metadata' ->> 'username',
          auth.jwt() -> 'user_metadata' ->> 'identificacao',
          auth.jwt() -> 'raw_user_meta_data' ->> 'matricula',
          auth.jwt() -> 'raw_user_meta_data' ->> 'username',
          auth.jwt() -> 'raw_user_meta_data' ->> 'identificacao'
        )
      )
    )
  );

DROP POLICY IF EXISTS "Gestores total controle terceirizados" ON public.terceirizados;
CREATE POLICY "Gestores total controle terceirizados"
  ON public.terceirizados FOR ALL TO authenticated
  USING (public.check_user_can_manage_terceirizados(auth.uid()))
  WITH CHECK (public.check_user_can_manage_terceirizados(auth.uid()));

DROP POLICY IF EXISTS "Gestores total controle terceirizado_permissions" ON public.terceirizado_permissions;
CREATE POLICY "Gestores total controle terceirizado_permissions"
  ON public.terceirizado_permissions FOR ALL TO authenticated
  USING (public.check_user_can_manage_terceirizados(auth.uid()))
  WITH CHECK (public.check_user_can_manage_terceirizados(auth.uid()));
