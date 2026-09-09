-- Corrige o escopo de acesso das requisições de compra para o grupo
-- atualmente utilizado no catálogo de usuários: fiscais-de-contratos.
-- Mantém fiscal-contratos por compatibilidade com instalações antigas.

INSERT INTO public.user_group_screen_permissions (group_id, screen_id, can_access)
SELECT id, 'requisicao-compra', true
FROM public.user_groups
WHERE slug = 'fiscais-de-contratos'
ON CONFLICT (group_id, screen_id) DO UPDATE
SET can_access = EXCLUDED.can_access,
    updated_at = now();

DROP POLICY IF EXISTS "Leitura de requisicoes_compra" ON public.requisicoes_compra;
CREATE POLICY "Leitura de requisicoes_compra"
  ON public.requisicoes_compra FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_superadmin_jwt()
    OR EXISTS (
      SELECT 1
      FROM public.user_group_memberships membership
      JOIN public.user_groups group_row ON group_row.id = membership.group_id
      WHERE membership.user_id = auth.uid()
        AND group_row.slug IN ('diretores', 'fiscal-contratos', 'fiscais-de-contratos', 'teste')
    )
  );

DROP POLICY IF EXISTS "Atualizar requisicoes_compra" ON public.requisicoes_compra;
CREATE POLICY "Atualizar requisicoes_compra"
  ON public.requisicoes_compra FOR UPDATE TO authenticated
  USING (
    (created_by = auth.uid() AND status IN ('draft', 'review'))
    OR public.is_superadmin_jwt()
    OR EXISTS (
      SELECT 1
      FROM public.user_group_memberships membership
      JOIN public.user_groups group_row ON group_row.id = membership.group_id
      WHERE membership.user_id = auth.uid()
        AND group_row.slug IN ('diretores', 'fiscal-contratos', 'fiscais-de-contratos', 'teste')
    )
  );

DROP POLICY IF EXISTS "Excluir requisicoes_compra" ON public.requisicoes_compra;
CREATE POLICY "Excluir requisicoes_compra"
  ON public.requisicoes_compra FOR DELETE TO authenticated
  USING (
    (created_by = auth.uid() AND status = 'draft')
    OR public.is_superadmin_jwt()
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

DROP POLICY IF EXISTS "Manipular requisicao_compra_itens" ON public.requisicao_compra_itens;
CREATE POLICY "Manipular requisicao_compra_itens"
  ON public.requisicao_compra_itens FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.requisicoes_compra parent
      WHERE parent.id = requisicao_compra_itens.requisicao_compra_id
        AND (
          (parent.created_by = auth.uid() AND parent.status IN ('draft', 'review'))
          OR public.is_superadmin_jwt()
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

DROP POLICY IF EXISTS "Manipular requisicao_compra_empenhos" ON public.requisicao_compra_empenhos;
CREATE POLICY "Manipular requisicao_compra_empenhos"
  ON public.requisicao_compra_empenhos FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.requisicoes_compra parent
      WHERE parent.id = requisicao_compra_empenhos.requisicao_compra_id
        AND (
          (parent.created_by = auth.uid() AND parent.status IN ('draft', 'review'))
          OR public.is_superadmin_jwt()
          OR EXISTS (
            SELECT 1
            FROM public.user_group_memberships membership
            JOIN public.user_groups group_row ON group_row.id = membership.group_id
            WHERE membership.user_id = auth.uid()
              AND group_row.slug IN ('diretores', 'fiscal-contratos', 'fiscais-de-contratos', 'teste')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.requisicoes_compra parent
      WHERE parent.id = requisicao_compra_empenhos.requisicao_compra_id
        AND (
          (parent.created_by = auth.uid() AND parent.status IN ('draft', 'review'))
          OR public.is_superadmin_jwt()
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

-- A RPC mais recente contém a mesma lista de grupos para validar transições
-- de status. Atualiza sua definição sem reimplementar o restante da lógica.
DO $$
DECLARE
  function_definition text;
BEGIN
  SELECT pg_get_functiondef('public.save_requisicao_compra(jsonb,jsonb,uuid)'::regprocedure)
  INTO function_definition;

  function_definition := replace(
    function_definition,
    'group_row.slug IN (''diretores'', ''fiscal-contratos'', ''teste'')',
    'group_row.slug IN (''diretores'', ''fiscal-contratos'', ''fiscais-de-contratos'', ''teste'')'
  );

  IF function_definition NOT LIKE '%fiscais-de-contratos%' THEN
    RAISE EXCEPTION 'Nao foi possivel atualizar a validacao de grupo da RPC save_requisicao_compra.';
  END IF;

  EXECUTE function_definition;
END;
$$;
