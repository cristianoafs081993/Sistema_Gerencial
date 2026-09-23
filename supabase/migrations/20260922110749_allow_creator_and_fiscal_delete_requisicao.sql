-- Migration: Corrigir recursão mútua entre default_org_id() e current_user_org_id(),
-- e permitir exclusão de requisições de compra por criadores (draft e enviada_fornecedor) e gestores/fiscais (todas).

-- 1. Quebra da recursão mútua em default_org_id(): nunca chamar current_user_org_id()
CREATE OR REPLACE FUNCTION public.default_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1),
    (SELECT id FROM public.orgs WHERE is_active = true ORDER BY created_at LIMIT 1)
  );
$$;

COMMENT ON FUNCTION public.default_org_id() IS
  'Retorna o id do órgão padrão do sistema (ifrn-cn ou primeiro ativo). Não chama current_user_org_id() para evitar recursão infinita.';

-- 2. Garantir que current_user_org_id() use fallback direto para default_org_id()
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT org_id FROM public.org_users WHERE user_id = auth.uid() LIMIT 1),
    public.default_org_id()
  );
$$;

COMMENT ON FUNCTION public.current_user_org_id() IS
  'Retorna o org_id do usuário autenticado, com fallback para o órgão padrão caso ainda não associado.';

-- 3. Atualizar política RLS de exclusão em public.requisicoes_compra
DROP POLICY IF EXISTS "Excluir requisicoes_compra" ON public.requisicoes_compra;
CREATE POLICY "Excluir requisicoes_compra"
  ON public.requisicoes_compra FOR DELETE TO authenticated
  USING (
    (created_by = auth.uid() AND status <> 'liquidada')
    OR public.is_superadmin_jwt()
    OR EXISTS (
      SELECT 1
      FROM public.user_group_memberships membership
      JOIN public.user_groups group_row ON group_row.id = membership.group_id
      WHERE membership.user_id = auth.uid()
        AND group_row.slug IN ('diretores', 'fiscal-contratos', 'fiscais-de-contratos', 'teste')
    )
  );

-- 4. Ajustar política RLS de manipulação dos itens e empenhos da requisição
DROP POLICY IF EXISTS "Manipular requisicao_compra_itens" ON public.requisicao_compra_itens;
CREATE POLICY "Manipular requisicao_compra_itens"
  ON public.requisicao_compra_itens FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.requisicoes_compra parent
      WHERE parent.id = requisicao_compra_itens.requisicao_compra_id
        AND (
          (parent.created_by = auth.uid() AND parent.status <> 'liquidada')
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
      WHERE parent.id = requisicao_compra_itens.requisicao_compra_id
        AND (
          (parent.created_by = auth.uid() AND parent.status <> 'liquidada')
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
          (parent.created_by = auth.uid() AND parent.status <> 'liquidada')
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
          (parent.created_by = auth.uid() AND parent.status <> 'liquidada')
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
