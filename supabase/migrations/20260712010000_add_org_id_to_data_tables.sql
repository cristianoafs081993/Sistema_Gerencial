-- =============================================================
-- Data Isolation by Org — Corrected
-- Adiciona org_id às tabelas de dados transacionais e ajusta
-- as políticas RLS para que cada órgão veja apenas seus dados.
--
-- A função current_user_org_id() (criada em 20260712000000)
-- é usada como chave de isolamento automático nas policies.
-- =============================================================

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 1 — Orçamento e Execução
-- ═══════════════════════════════════════════════════════════════

-- ── atividades ───────────────────────────────────────────────
ALTER TABLE public.atividades
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.atividades SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.atividades ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS atividades_org_id_idx ON public.atividades (org_id);

DROP POLICY IF EXISTS "atividades_rls_org"          ON public.atividades;
DROP POLICY IF EXISTS "atividades_rls_org_insert"   ON public.atividades;
DROP POLICY IF EXISTS "atividades_rls_org_update"   ON public.atividades;
DROP POLICY IF EXISTS "atividades_rls_org_delete"   ON public.atividades;

CREATE POLICY "atividades_rls_org" ON public.atividades
  FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "atividades_rls_org_insert" ON public.atividades
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "atividades_rls_org_update" ON public.atividades
  FOR UPDATE TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "atividades_rls_org_delete" ON public.atividades
  FOR DELETE TO authenticated
  USING (public.is_superadmin_jwt());

-- ── empenhos ─────────────────────────────────────────────────
ALTER TABLE public.empenhos
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.empenhos SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.empenhos ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS empenhos_org_id_idx ON public.empenhos (org_id);

DROP POLICY IF EXISTS "Superadmin pode inserir empenhos"         ON public.empenhos;
DROP POLICY IF EXISTS "Superadmin pode atualizar empenhos"       ON public.empenhos;
DROP POLICY IF EXISTS "Superadmin pode deletar empenhos"         ON public.empenhos;
DROP POLICY IF EXISTS "Usuarios autenticados podem ler empenhos" ON public.empenhos;
DROP POLICY IF EXISTS "empenhos_rls_org"                         ON public.empenhos;
DROP POLICY IF EXISTS "empenhos_rls_org_insert"                  ON public.empenhos;
DROP POLICY IF EXISTS "empenhos_rls_org_update"                  ON public.empenhos;
DROP POLICY IF EXISTS "empenhos_rls_org_delete"                  ON public.empenhos;

CREATE POLICY "empenhos_rls_org" ON public.empenhos
  FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "empenhos_rls_org_insert" ON public.empenhos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "empenhos_rls_org_update" ON public.empenhos
  FOR UPDATE TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "empenhos_rls_org_delete" ON public.empenhos
  FOR DELETE TO authenticated
  USING (public.is_superadmin_jwt());

-- ── descentralizacoes ────────────────────────────────────────
ALTER TABLE public.descentralizacoes
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.descentralizacoes SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.descentralizacoes ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS descentralizacoes_org_id_idx ON public.descentralizacoes (org_id);

DROP POLICY IF EXISTS "descentralizacoes_rls_org"        ON public.descentralizacoes;
DROP POLICY IF EXISTS "descentralizacoes_rls_org_insert" ON public.descentralizacoes;
DROP POLICY IF EXISTS "descentralizacoes_rls_org_update" ON public.descentralizacoes;

CREATE POLICY "descentralizacoes_rls_org" ON public.descentralizacoes
  FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "descentralizacoes_rls_org_insert" ON public.descentralizacoes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "descentralizacoes_rls_org_update" ON public.descentralizacoes
  FOR UPDATE TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

-- ── descentralizacoes_conta_saldos ───────────────────────────
ALTER TABLE public.descentralizacoes_conta_saldos
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.descentralizacoes_conta_saldos SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.descentralizacoes_conta_saldos ALTER COLUMN org_id SET NOT NULL;

DROP POLICY IF EXISTS "descentralizacoes_conta_saldos_rls_org"        ON public.descentralizacoes_conta_saldos;
DROP POLICY IF EXISTS "descentralizacoes_conta_saldos_rls_org_insert" ON public.descentralizacoes_conta_saldos;
DROP POLICY IF EXISTS "descentralizacoes_conta_saldos_rls_org_update" ON public.descentralizacoes_conta_saldos;

CREATE POLICY "descentralizacoes_conta_saldos_rls_org" ON public.descentralizacoes_conta_saldos
  FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "descentralizacoes_conta_saldos_rls_org_insert" ON public.descentralizacoes_conta_saldos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "descentralizacoes_conta_saldos_rls_org_update" ON public.descentralizacoes_conta_saldos
  FOR UPDATE TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

-- ── creditos_disponiveis ──────────────────────────────────────
ALTER TABLE public.creditos_disponiveis
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.creditos_disponiveis SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.creditos_disponiveis ALTER COLUMN org_id SET NOT NULL;

DROP POLICY IF EXISTS "creditos_disponiveis_rls_org"        ON public.creditos_disponiveis;
DROP POLICY IF EXISTS "creditos_disponiveis_rls_org_insert" ON public.creditos_disponiveis;
DROP POLICY IF EXISTS "creditos_disponiveis_rls_org_update" ON public.creditos_disponiveis;

CREATE POLICY "creditos_disponiveis_rls_org" ON public.creditos_disponiveis
  FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "creditos_disponiveis_rls_org_insert" ON public.creditos_disponiveis
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "creditos_disponiveis_rls_org_update" ON public.creditos_disponiveis
  FOR UPDATE TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

-- ── creditos_disponiveis_detalhes ─────────────────────────────
ALTER TABLE public.creditos_disponiveis_detalhes
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.creditos_disponiveis_detalhes SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.creditos_disponiveis_detalhes ALTER COLUMN org_id SET NOT NULL;

DROP POLICY IF EXISTS "creditos_disponiveis_detalhes_rls_org"        ON public.creditos_disponiveis_detalhes;
DROP POLICY IF EXISTS "creditos_disponiveis_detalhes_rls_org_insert" ON public.creditos_disponiveis_detalhes;

CREATE POLICY "creditos_disponiveis_detalhes_rls_org" ON public.creditos_disponiveis_detalhes
  FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "creditos_disponiveis_detalhes_rls_org_insert" ON public.creditos_disponiveis_detalhes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

-- ── rap_historico_anual ───────────────────────────────────────
ALTER TABLE public.rap_historico_anual
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.rap_historico_anual SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.rap_historico_anual ALTER COLUMN org_id SET NOT NULL;

DROP POLICY IF EXISTS "rap_historico_anual_rls_org"        ON public.rap_historico_anual;
DROP POLICY IF EXISTS "rap_historico_anual_rls_org_insert" ON public.rap_historico_anual;

CREATE POLICY "rap_historico_anual_rls_org" ON public.rap_historico_anual
  FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "rap_historico_anual_rls_org_insert" ON public.rap_historico_anual
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 2 — Documentos Hábeis e Pagamentos
-- ═══════════════════════════════════════════════════════════════

-- ── documentos_habeis ────────────────────────────────────────
ALTER TABLE public.documentos_habeis
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.documentos_habeis SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.documentos_habeis ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS documentos_habeis_org_id_idx ON public.documentos_habeis (org_id);

DROP POLICY IF EXISTS "documentos_habeis_rls_org"        ON public.documentos_habeis;
DROP POLICY IF EXISTS "documentos_habeis_rls_org_insert" ON public.documentos_habeis;
DROP POLICY IF EXISTS "documentos_habeis_rls_org_update" ON public.documentos_habeis;

CREATE POLICY "documentos_habeis_rls_org" ON public.documentos_habeis
  FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "documentos_habeis_rls_org_insert" ON public.documentos_habeis
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "documentos_habeis_rls_org_update" ON public.documentos_habeis
  FOR UPDATE TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

-- ── retencoes ─────────────────────────────────────────────────
ALTER TABLE public.retencoes
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.retencoes SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.retencoes ALTER COLUMN org_id SET NOT NULL;

DROP POLICY IF EXISTS "retencoes_rls_org"        ON public.retencoes;
DROP POLICY IF EXISTS "retencoes_rls_org_insert" ON public.retencoes;

CREATE POLICY "retencoes_rls_org" ON public.retencoes
  FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "retencoes_rls_org_insert" ON public.retencoes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 3 — PFs
-- ═══════════════════════════════════════════════════════════════

-- ── pf_solicitacao ────────────────────────────────────────────
ALTER TABLE public.pf_solicitacao
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.pf_solicitacao SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.pf_solicitacao ALTER COLUMN org_id SET NOT NULL;

DROP POLICY IF EXISTS "pf_solicitacao_rls_org"        ON public.pf_solicitacao;
DROP POLICY IF EXISTS "pf_solicitacao_rls_org_insert" ON public.pf_solicitacao;

CREATE POLICY "pf_solicitacao_rls_org" ON public.pf_solicitacao
  FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "pf_solicitacao_rls_org_insert" ON public.pf_solicitacao
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

-- ── pf_aprovacao ──────────────────────────────────────────────
ALTER TABLE public.pf_aprovacao
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.pf_aprovacao SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.pf_aprovacao ALTER COLUMN org_id SET NOT NULL;

DROP POLICY IF EXISTS "pf_aprovacao_rls_org"        ON public.pf_aprovacao;
DROP POLICY IF EXISTS "pf_aprovacao_rls_org_insert" ON public.pf_aprovacao;

CREATE POLICY "pf_aprovacao_rls_org" ON public.pf_aprovacao
  FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "pf_aprovacao_rls_org_insert" ON public.pf_aprovacao
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

-- ── pf_liberacao ──────────────────────────────────────────────
ALTER TABLE public.pf_liberacao
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.pf_liberacao SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.pf_liberacao ALTER COLUMN org_id SET NOT NULL;

DROP POLICY IF EXISTS "pf_liberacao_rls_org"        ON public.pf_liberacao;
DROP POLICY IF EXISTS "pf_liberacao_rls_org_insert" ON public.pf_liberacao;

CREATE POLICY "pf_liberacao_rls_org" ON public.pf_liberacao
  FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "pf_liberacao_rls_org_insert" ON public.pf_liberacao
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 4 — Contratos Locais
-- ═══════════════════════════════════════════════════════════════

-- ── contratos ─────────────────────────────────────────────────
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.contratos SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.contratos ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS contratos_org_id_idx ON public.contratos (org_id);

DROP POLICY IF EXISTS "contratos_rls_org"        ON public.contratos;
DROP POLICY IF EXISTS "contratos_rls_org_insert" ON public.contratos;
DROP POLICY IF EXISTS "contratos_rls_org_update" ON public.contratos;
DROP POLICY IF EXISTS "contratos_rls_org_delete" ON public.contratos;

CREATE POLICY "contratos_rls_org" ON public.contratos
  FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "contratos_rls_org_insert" ON public.contratos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "contratos_rls_org_update" ON public.contratos
  FOR UPDATE TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "contratos_rls_org_delete" ON public.contratos
  FOR DELETE TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

-- ── requisicoes_compra ────────────────────────────────────────
ALTER TABLE public.requisicoes_compra
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.requisicoes_compra SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.requisicoes_compra ALTER COLUMN org_id SET NOT NULL;

DROP POLICY IF EXISTS "requisicoes_compra_rls_org"        ON public.requisicoes_compra;
DROP POLICY IF EXISTS "requisicoes_compra_rls_org_insert" ON public.requisicoes_compra;

CREATE POLICY "requisicoes_compra_rls_org" ON public.requisicoes_compra
  FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "requisicoes_compra_rls_org_insert" ON public.requisicoes_compra
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 5 — Financeiro e Auxiliares
-- ═══════════════════════════════════════════════════════════════

-- ── financeiro_fonte_vinculacao ───────────────────────────────
ALTER TABLE public.financeiro_fonte_vinculacao
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.financeiro_fonte_vinculacao SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.financeiro_fonte_vinculacao ALTER COLUMN org_id SET NOT NULL;

DROP POLICY IF EXISTS "financeiro_fonte_vinculacao_rls_org"        ON public.financeiro_fonte_vinculacao;
DROP POLICY IF EXISTS "financeiro_fonte_vinculacao_rls_org_insert" ON public.financeiro_fonte_vinculacao;

CREATE POLICY "financeiro_fonte_vinculacao_rls_org" ON public.financeiro_fonte_vinculacao
  FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "financeiro_fonte_vinculacao_rls_org_insert" ON public.financeiro_fonte_vinculacao
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

-- ── lc_credores ───────────────────────────────────────────────
ALTER TABLE public.lc_credores
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.lc_credores SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.lc_credores ALTER COLUMN org_id SET NOT NULL;

DROP POLICY IF EXISTS "lc_credores_rls_org"        ON public.lc_credores;
DROP POLICY IF EXISTS "lc_credores_rls_org_insert" ON public.lc_credores;

CREATE POLICY "lc_credores_rls_org" ON public.lc_credores
  FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "lc_credores_rls_org_insert" ON public.lc_credores
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

-- ── retencoes_efd_reinf ───────────────────────────────────────
ALTER TABLE public.retencoes_efd_reinf
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.retencoes_efd_reinf SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.retencoes_efd_reinf ALTER COLUMN org_id SET NOT NULL;

DROP POLICY IF EXISTS "retencoes_efd_reinf_rls_org"        ON public.retencoes_efd_reinf;
DROP POLICY IF EXISTS "retencoes_efd_reinf_rls_org_insert" ON public.retencoes_efd_reinf;

CREATE POLICY "retencoes_efd_reinf_rls_org" ON public.retencoes_efd_reinf
  FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "retencoes_efd_reinf_rls_org_insert" ON public.retencoes_efd_reinf
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 6 — Energia Campus
-- ═══════════════════════════════════════════════════════════════

-- ── energia_import_runs ───────────────────────────────────────
ALTER TABLE public.energia_import_runs
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.energia_import_runs SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.energia_import_runs ALTER COLUMN org_id SET NOT NULL;

DROP POLICY IF EXISTS "energia_import_runs_rls_org"        ON public.energia_import_runs;
DROP POLICY IF EXISTS "energia_import_runs_rls_org_insert" ON public.energia_import_runs;

CREATE POLICY "energia_import_runs_rls_org" ON public.energia_import_runs
  FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "energia_import_runs_rls_org_insert" ON public.energia_import_runs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

-- ── energia_consumo_faturas ───────────────────────────────────
ALTER TABLE public.energia_consumo_faturas
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.energia_consumo_faturas SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.energia_consumo_faturas ALTER COLUMN org_id SET NOT NULL;

DROP POLICY IF EXISTS "energia_consumo_faturas_rls_org"        ON public.energia_consumo_faturas;
DROP POLICY IF EXISTS "energia_consumo_faturas_rls_org_insert" ON public.energia_consumo_faturas;

CREATE POLICY "energia_consumo_faturas_rls_org" ON public.energia_consumo_faturas
  FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "energia_consumo_faturas_rls_org_insert" ON public.energia_consumo_faturas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

-- ── energia_solar_geracao ─────────────────────────────────────
ALTER TABLE public.energia_solar_geracao
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.energia_solar_geracao SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.energia_solar_geracao ALTER COLUMN org_id SET NOT NULL;

DROP POLICY IF EXISTS "energia_solar_geracao_rls_org"        ON public.energia_solar_geracao;
DROP POLICY IF EXISTS "energia_solar_geracao_rls_org_insert" ON public.energia_solar_geracao;

CREATE POLICY "energia_solar_geracao_rls_org" ON public.energia_solar_geracao
  FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "energia_solar_geracao_rls_org_insert" ON public.energia_solar_geracao
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

-- ── energia_contratos ─────────────────────────────────────────
ALTER TABLE public.energia_contratos
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.energia_contratos SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.energia_contratos ALTER COLUMN org_id SET NOT NULL;

DROP POLICY IF EXISTS "energia_contratos_rls_org"        ON public.energia_contratos;
DROP POLICY IF EXISTS "energia_contratos_rls_org_insert" ON public.energia_contratos;

CREATE POLICY "energia_contratos_rls_org" ON public.energia_contratos
  FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "energia_contratos_rls_org_insert" ON public.energia_contratos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

-- ── energia_contrato_execucoes ────────────────────────────────
ALTER TABLE public.energia_contrato_execucoes
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.energia_contrato_execucoes SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.energia_contrato_execucoes ALTER COLUMN org_id SET NOT NULL;

DROP POLICY IF EXISTS "energia_contrato_execucoes_rls_org"        ON public.energia_contrato_execucoes;
DROP POLICY IF EXISTS "energia_contrato_execucoes_rls_org_insert" ON public.energia_contrato_execucoes;

CREATE POLICY "energia_contrato_execucoes_rls_org" ON public.energia_contrato_execucoes
  FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

CREATE POLICY "energia_contrato_execucoes_rls_org_insert" ON public.energia_contrato_execucoes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

-- ═══════════════════════════════════════════════════════════════
-- BLOCO 7 — Pesquisa de Preços
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.price_researches
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT;

UPDATE public.price_researches SET org_id = (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1)
WHERE org_id IS NULL;

ALTER TABLE public.price_researches ALTER COLUMN org_id SET NOT NULL;

DROP POLICY IF EXISTS "price_researches_rls_org" ON public.price_researches;

-- Mantém isolamento por proprietário E restringe ao org
CREATE POLICY "price_researches_rls_org" ON public.price_researches
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin_jwt()
    OR (
      org_id = public.current_user_org_id()
      AND (created_by = auth.uid() OR public.is_superadmin_jwt())
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- Nota: tabelas globais/compartilhadas sem org_id
-- contratos_api*, licitacoes_pncp*, atas_registro_precos*,
-- normativos*, document_templates, dimensoes, suppliers, etc.
-- ═══════════════════════════════════════════════════════════════
