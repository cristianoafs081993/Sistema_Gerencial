-- Usuários que visualizam o módulo Refeitório precisam consultar as
-- requisições de compra e seus detalhes, independentemente do criador.
-- A permissão abaixo é somente de leitura; as policies de escrita continuam
-- restritas ao criador, gestores e superadministrador.

CREATE OR REPLACE FUNCTION public.can_view_refeitorio_requisicoes()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_superadmin_jwt()
    OR EXISTS (
      SELECT 1
      FROM public.user_group_memberships membership
      JOIN public.user_groups group_row ON group_row.id = membership.group_id
      WHERE membership.user_id = auth.uid()
        AND group_row.slug = 'terceirizado'
    )
    OR EXISTS (
      SELECT 1
      FROM public.terceirizados terceirizado
      WHERE terceirizado.user_id = auth.uid()
         OR (
           public.normalize_terceirizado_matricula(terceirizado.matricula) <> ''
           AND public.normalize_terceirizado_matricula(terceirizado.matricula) =
               public.normalize_terceirizado_matricula(coalesce(
                 auth.jwt() -> 'user_metadata' ->> 'matricula',
                 auth.jwt() -> 'user_metadata' ->> 'username',
                 auth.jwt() -> 'user_metadata' ->> 'identificacao',
                 ''
               ))
         )
         OR (
           btrim(coalesce(terceirizado.email, '')) <> ''
           AND lower(terceirizado.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
         )
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_group_memberships membership
      JOIN public.user_group_screen_permissions permission
        ON permission.group_id = membership.group_id
      WHERE membership.user_id = auth.uid()
        AND permission.can_access = true
        AND permission.screen_id IN ('refeitorio', 'refeitorio-insumos', 'requisicao-compra')
        AND (
          public.current_user_org_id() IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.org_module_permissions module_permission
            WHERE module_permission.org_id = public.current_user_org_id()
              AND module_permission.screen_id IN ('refeitorio', 'refeitorio-insumos', 'requisicao-compra')
              AND module_permission.can_access = true
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_view_refeitorio_requisicoes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_refeitorio_requisicoes() TO authenticated;

DROP POLICY IF EXISTS "Leitura de requisicoes_compra" ON public.requisicoes_compra;
CREATE POLICY "Leitura de requisicoes_compra"
  ON public.requisicoes_compra FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_superadmin_jwt()
    OR (
      public.can_view_refeitorio_requisicoes()
      AND (public.is_superadmin_jwt() OR org_id = public.current_user_org_id())
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_group_memberships membership
      JOIN public.user_groups group_row ON group_row.id = membership.group_id
      WHERE membership.user_id = auth.uid()
        AND group_row.slug IN ('diretores', 'fiscal-contratos', 'fiscais-de-contratos', 'teste')
    )
  );

DROP POLICY IF EXISTS "Leitura de requisicao_compra_itens" ON public.requisicao_compra_itens;
CREATE POLICY "Leitura de requisicao_compra_itens"
  ON public.requisicao_compra_itens FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.requisicoes_compra parent
      WHERE parent.id = requisicao_compra_itens.requisicao_compra_id
        AND (
          parent.created_by = auth.uid()
          OR public.is_superadmin_jwt()
          OR (
            public.can_view_refeitorio_requisicoes()
            AND (public.is_superadmin_jwt() OR parent.org_id = public.current_user_org_id())
          )
          OR EXISTS (
            SELECT 1
            FROM public.user_group_memberships membership
            JOIN public.user_groups group_row ON group_row.id = membership.group_id
            WHERE membership.user_id = auth.uid()
              AND group_row.slug IN ('diretores', 'fiscal-contratos', 'fiscais-de-contratos', 'teste')
          )
        )
    )
  );

DROP POLICY IF EXISTS "Leitura de requisicao_compra_empenhos" ON public.requisicao_compra_empenhos;
CREATE POLICY "Leitura de requisicao_compra_empenhos"
  ON public.requisicao_compra_empenhos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.requisicoes_compra parent
      WHERE parent.id = requisicao_compra_empenhos.requisicao_compra_id
        AND (
          parent.created_by = auth.uid()
          OR public.is_superadmin_jwt()
          OR (
            public.can_view_refeitorio_requisicoes()
            AND (public.is_superadmin_jwt() OR parent.org_id = public.current_user_org_id())
          )
          OR EXISTS (
            SELECT 1
            FROM public.user_group_memberships membership
            JOIN public.user_groups group_row ON group_row.id = membership.group_id
            WHERE membership.user_id = auth.uid()
              AND group_row.slug IN ('diretores', 'fiscal-contratos', 'fiscais-de-contratos', 'teste')
          )
        )
    )
  );
