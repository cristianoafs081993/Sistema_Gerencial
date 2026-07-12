-- =============================================================
-- Scope suppliers by org
--
-- Fornecedores deixaram de ser uma base global: cada orgao deve ver
-- e manter apenas seu proprio cadastro de fornecedores.
-- =============================================================

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.suppliers
SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.suppliers
  ALTER COLUMN org_id SET NOT NULL,
  ALTER COLUMN org_id SET DEFAULT public.current_user_org_id();

DROP INDEX IF EXISTS idx_suppliers_name_trgm;
CREATE INDEX IF NOT EXISTS idx_suppliers_org_name ON public.suppliers (org_id, name);

ALTER TABLE public.suppliers DROP CONSTRAINT IF EXISTS suppliers_document_key;
DROP INDEX IF EXISTS suppliers_document_key;
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_org_document_unique
  ON public.suppliers (org_id, document)
  WHERE document IS NOT NULL;

DROP POLICY IF EXISTS "Users can read all suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can manage all suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_rls_org_select" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_rls_org_insert" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_rls_org_update" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_rls_org_delete" ON public.suppliers;

CREATE POLICY "suppliers_rls_org_select" ON public.suppliers
  FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "suppliers_rls_org_insert" ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "suppliers_rls_org_update" ON public.suppliers
  FOR UPDATE TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id())
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "suppliers_rls_org_delete" ON public.suppliers
  FOR DELETE TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

DROP POLICY IF EXISTS "Users can read all certificates" ON public.supplier_certificates;
DROP POLICY IF EXISTS "Users can manage all certificates" ON public.supplier_certificates;
DROP POLICY IF EXISTS "supplier_certificates_rls_org_select" ON public.supplier_certificates;
DROP POLICY IF EXISTS "supplier_certificates_rls_org_insert" ON public.supplier_certificates;
DROP POLICY IF EXISTS "supplier_certificates_rls_org_update" ON public.supplier_certificates;
DROP POLICY IF EXISTS "supplier_certificates_rls_org_delete" ON public.supplier_certificates;

CREATE POLICY "supplier_certificates_rls_org_select" ON public.supplier_certificates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.suppliers supplier
      WHERE supplier.id = supplier_certificates.supplier_id
        AND (public.is_superadmin_jwt() OR supplier.org_id = public.current_user_org_id())
    )
  );

CREATE POLICY "supplier_certificates_rls_org_insert" ON public.supplier_certificates
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.suppliers supplier
      WHERE supplier.id = supplier_certificates.supplier_id
        AND (public.is_superadmin_jwt() OR supplier.org_id = public.current_user_org_id())
    )
  );

CREATE POLICY "supplier_certificates_rls_org_update" ON public.supplier_certificates
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.suppliers supplier
      WHERE supplier.id = supplier_certificates.supplier_id
        AND (public.is_superadmin_jwt() OR supplier.org_id = public.current_user_org_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.suppliers supplier
      WHERE supplier.id = supplier_certificates.supplier_id
        AND (public.is_superadmin_jwt() OR supplier.org_id = public.current_user_org_id())
    )
  );

CREATE POLICY "supplier_certificates_rls_org_delete" ON public.supplier_certificates
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.suppliers supplier
      WHERE supplier.id = supplier_certificates.supplier_id
        AND (public.is_superadmin_jwt() OR supplier.org_id = public.current_user_org_id())
    )
  );

DROP POLICY IF EXISTS "Users can read research suppliers" ON public.price_research_suppliers;
DROP POLICY IF EXISTS "Users can manage research suppliers" ON public.price_research_suppliers;

CREATE POLICY "Users can read research suppliers"
  ON public.price_research_suppliers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.price_researches research
      WHERE research.id = price_research_suppliers.research_id
        AND (research.created_by = auth.uid() OR public.is_superadmin_jwt())
    )
    AND EXISTS (
      SELECT 1
      FROM public.suppliers supplier
      WHERE supplier.id = price_research_suppliers.supplier_id
        AND (public.is_superadmin_jwt() OR supplier.org_id = public.current_user_org_id())
    )
  );

CREATE POLICY "Users can manage research suppliers"
  ON public.price_research_suppliers FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.price_researches research
      WHERE research.id = price_research_suppliers.research_id
        AND (research.created_by = auth.uid() OR public.is_superadmin_jwt())
    )
    AND EXISTS (
      SELECT 1
      FROM public.suppliers supplier
      WHERE supplier.id = price_research_suppliers.supplier_id
        AND (public.is_superadmin_jwt() OR supplier.org_id = public.current_user_org_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.price_researches research
      WHERE research.id = price_research_suppliers.research_id
        AND (research.created_by = auth.uid() OR public.is_superadmin_jwt())
    )
    AND EXISTS (
      SELECT 1
      FROM public.suppliers supplier
      WHERE supplier.id = price_research_suppliers.supplier_id
        AND (public.is_superadmin_jwt() OR supplier.org_id = public.current_user_org_id())
    )
  );
