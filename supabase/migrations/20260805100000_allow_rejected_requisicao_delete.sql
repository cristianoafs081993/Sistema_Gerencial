-- Alinha a política de exclusão com a interface, que permite ao criador
-- remover rascunhos e requisições rejeitadas.

DROP POLICY IF EXISTS "Excluir requisicoes_compra" ON public.requisicoes_compra;

CREATE POLICY "Excluir requisicoes_compra"
  ON public.requisicoes_compra FOR DELETE TO authenticated
  USING (
    (created_by = auth.uid() AND status IN ('draft', 'rejected'))
    OR public.is_superadmin_jwt()
    OR EXISTS (
      SELECT 1
      FROM public.user_group_memberships membership
      JOIN public.user_groups group_row ON group_row.id = membership.group_id
      WHERE membership.user_id = auth.uid()
        AND group_row.slug IN ('diretores', 'fiscal-contratos', 'teste')
    )
  );
