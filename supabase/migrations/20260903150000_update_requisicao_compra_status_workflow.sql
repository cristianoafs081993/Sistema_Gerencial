-- Migration: Atualiza o workflow de status de Requisições de Compra para 3 status:
-- 'draft' (Rascunho), 'enviada_fornecedor' (Enviada ao Fornecedor) e 'liquidada' (Liquidada).
-- Aplica a dedução de saldo de requisições enviadas ao fornecedor na validação do empenho.

-- 1. Migrar status legados existentes
UPDATE public.requisicoes_compra
SET status = 'enviada_fornecedor'
WHERE status IN ('review', 'approved');

UPDATE public.requisicoes_compra
SET status = 'draft'
WHERE status = 'rejected';

-- 2. Atualizar CHECK constraint na tabela requisicoes_compra
ALTER TABLE public.requisicoes_compra
  DROP CONSTRAINT IF EXISTS requisicoes_compra_status_check;

ALTER TABLE public.requisicoes_compra
  ADD CONSTRAINT requisicoes_compra_status_check
  CHECK (status IN ('draft', 'enviada_fornecedor', 'liquidada'));

-- 3. Atualizar política de exclusão
DROP POLICY IF EXISTS Excluir requisicoes_compra ON public.requisicoes_compra;

CREATE POLICY Excluir requisicoes_compra
  ON public.requisicoes_compra FOR DELETE TO authenticated
  USING (
    (created_by = auth.uid() AND status = 'draft')
    OR public.is_superadmin_jwt()
    OR EXISTS (
      SELECT 1
      FROM public.user_group_memberships membership
      JOIN public.user_groups group_row ON group_row.id = membership.group_id
      WHERE membership.user_id = auth.uid()
        AND group_row.slug IN ('diretores', 'fiscal-contratos', 'teste')
    )
  );

-- 4. Atualizar a função save_requisicao_compra com validação de status e desconto de saldo
CREATE OR REPLACE FUNCTION public.save_requisicao_compra(
  p_requisicao jsonb,
  p_items jsonb,
  p_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS 
DECLARE
  v_id uuid := p_id;
  v_status text := coalesce(nullif(p_requisicao ->> 'status', ''), 'draft');
  v_contrato_id uuid := nullif(p_requisicao ->> 'contratoId', '')::uuid;
  v_first_empenho_id uuid;
  v_first_empenho_numero text;
  v_balance numeric;
  v_other_enviadas numeric := 0;
  v_effective_balance numeric := 0;
  v_requested numeric := 0;
  v_is_terceirizado boolean := false;
  v_is_manager boolean := false;
  v_user_matricula text := coalesce(
    auth.jwt() -> 'user_metadata' ->> 'matricula',
    auth.jwt() -> 'user_metadata' ->> 'username',
    auth.jwt() -> 'user_metadata' ->> 'identificacao',
    ''
  );
  v_user_email text := coalesce(auth.jwt() ->> 'email', '');
  v_empenho jsonb;
  v_item jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.' USING ERRCODE = '42501';
  END IF;

  IF v_status NOT IN ('draft', 'enviada_fornecedor', 'liquidada') THEN
    RAISE EXCEPTION 'Situacao de requisicao invalida: %.', v_status USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Adicione ao menos um item a requisicao.' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(coalesce(p_requisicao -> 'empenhos', '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Lista de empenhos invalida.' USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(coalesce(p_requisicao -> 'empenhos', '[]'::jsonb)) = 0
     AND nullif(p_requisicao ->> 'empenhoId', '') IS NOT NULL THEN
    p_requisicao := jsonb_set(
      p_requisicao,
      '{empenhos}',
      jsonb_build_array(jsonb_build_object(
        'empenhoId', p_requisicao ->> 'empenhoId',
        'empenhoNumero', p_requisicao ->> 'empenhoNumero'
      ))
    );
  END IF;

  SELECT (empenho ->> 'empenhoId')::uuid,
         nullif(empenho ->> 'empenhoNumero', '')
  INTO v_first_empenho_id, v_first_empenho_numero
  FROM jsonb_array_elements(coalesce(p_requisicao -> 'empenhos', '[]'::jsonb)) WITH ORDINALITY AS rows(empenho, ordinality)
  ORDER BY ordinality
  LIMIT 1;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) item
    WHERE btrim(coalesce(item ->> 'description', '')) = ''
       OR coalesce((item ->> 'quantity')::numeric, 0) < 0
       OR coalesce((item ->> 'unitPrice')::numeric, -1) < 0
       OR coalesce(nullif(item ->> 'sourceType', ''), 'manual') NOT IN ('manual', 'portal_transparencia_empenho_item', 'contrato_api_item')
  ) THEN
    RAISE EXCEPTION 'Os itens possuem dados invalidos.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(coalesce(p_requisicao -> 'empenhos', '[]'::jsonb)) empenho
    WHERE nullif(empenho ->> 'empenhoId', '') IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.empenhos e
         WHERE e.id = (empenho ->> 'empenhoId')::uuid
       )
  ) THEN
    RAISE EXCEPTION 'Empenho selecionado nao foi encontrado.' USING ERRCODE = '22023';
  END IF;

  IF v_status IN ('enviada_fornecedor', 'liquidada') THEN
    IF jsonb_array_length(coalesce(p_requisicao -> 'empenhos', '[]'::jsonb)) = 0 THEN
      RAISE EXCEPTION 'Selecione ao menos um empenho antes de salvar a requisicao.' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_items) item
      WHERE nullif(item ->> 'empenhoId', '') IS NULL
         OR NOT EXISTS (
           SELECT 1
           FROM jsonb_array_elements(coalesce(p_requisicao -> 'empenhos', '[]'::jsonb)) empenho
           WHERE empenho ->> 'empenhoId' = item ->> 'empenhoId'
         )
    ) THEN
      RAISE EXCEPTION 'Cada item deve estar vinculado a um empenho selecionado.' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.terceirizados terceirizado
    WHERE terceirizado.tipo = 'refeitorio'
      AND (
        terceirizado.user_id = auth.uid()
        OR (
          public.normalize_terceirizado_matricula(terceirizado.matricula) <> ''
          AND public.normalize_terceirizado_matricula(terceirizado.matricula) =
              public.normalize_terceirizado_matricula(v_user_matricula)
        )
      )
  ) INTO v_is_terceirizado;

  SELECT public.is_superadmin_jwt() OR EXISTS (
    SELECT 1
    FROM public.user_group_memberships membership
    JOIN public.user_groups group_row ON group_row.id = membership.group_id
    WHERE membership.user_id = auth.uid()
      AND group_row.slug IN ('diretores', 'fiscal-contratos', 'teste')
  ) INTO v_is_manager;

  IF v_status = 'liquidada' AND NOT v_is_manager THEN
    RAISE EXCEPTION 'Somente fiscais ou gestores podem marcar requisicoes como liquidadas.' USING ERRCODE = '42501';
  END IF;

  IF v_is_terceirizado THEN
    IF v_status NOT IN ('draft', 'enviada_fornecedor') THEN
      RAISE EXCEPTION 'Terceirizados nao podem liquidar requisicoes diretamente.' USING ERRCODE = '42501';
    END IF;

    IF v_contrato_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.terceirizado_permissions permission
      WHERE permission.contrato_id = v_contrato_id
        AND (
          permission.user_id = auth.uid()
          OR (
            public.normalize_terceirizado_matricula(permission.user_matricula) <> ''
            AND public.normalize_terceirizado_matricula(permission.user_matricula) =
                public.normalize_terceirizado_matricula(v_user_matricula)
          )
          OR (
            btrim(coalesce(permission.user_email, '')) <> ''
            AND lower(permission.user_email) = lower(v_user_email)
          )
        )
    ) THEN
      RAISE EXCEPTION 'Contrato nao autorizado para este terceirizado.' USING ERRCODE = '42501';
    END IF;

    FOR v_empenho IN
      SELECT empenho FROM jsonb_array_elements(coalesce(p_requisicao -> 'empenhos', '[]'::jsonb)) empenho
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.terceirizado_permissions permission
        WHERE permission.empenho_id = (v_empenho ->> 'empenhoId')::uuid
          AND (
            permission.user_id = auth.uid()
            OR (
              public.normalize_terceirizado_matricula(permission.user_matricula) <> ''
              AND public.normalize_terceirizado_matricula(permission.user_matricula) =
                  public.normalize_terceirizado_matricula(v_user_matricula)
            )
            OR (
              btrim(coalesce(permission.user_email, '')) <> ''
              AND lower(permission.user_email) = lower(v_user_email)
            )
          )
      ) THEN
        RAISE EXCEPTION 'Empenho nao autorizado para este terceirizado.' USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;

  -- Validacao de saldo quando enviada ao fornecedor:
  -- Subtrai requisições já enviadas ao fornecedor ativas (exceto a própria que está sendo editada)
  IF v_status = 'enviada_fornecedor' THEN
    FOR v_empenho IN
      SELECT empenho FROM jsonb_array_elements(coalesce(p_requisicao -> 'empenhos', '[]'::jsonb)) empenho
    LOOP
      PERFORM pg_advisory_xact_lock(hashtext(v_empenho ->> 'empenhoId'));
      SELECT public.fn_empenho_saldo_disponivel((v_empenho ->> 'empenhoId')::uuid) INTO v_balance;
      IF v_balance IS NULL THEN
        RAISE EXCEPTION 'Empenho selecionado nao foi encontrado.' USING ERRCODE = '22023';
      END IF;

      -- Soma de itens de outras requisições com status 'enviada_fornecedor'
      SELECT coalesce(sum(item_row.quantity * item_row.unit_price), 0)
      INTO v_other_enviadas
      FROM public.requisicao_compra_itens item_row
      JOIN public.requisicoes_compra req_row ON req_row.id = item_row.requisicao_compra_id
      WHERE item_row.empenho_id = (v_empenho ->> 'empenhoId')::uuid
        AND req_row.status = 'enviada_fornecedor'
        AND (v_id IS NULL OR req_row.id <> v_id);

      v_effective_balance := greatest(0, coalesce(v_balance, 0) - coalesce(v_other_enviadas, 0));

      SELECT coalesce(sum((item ->> 'quantity')::numeric * (item ->> 'unitPrice')::numeric), 0)
      INTO v_requested
      FROM jsonb_array_elements(p_items) item
      WHERE item ->> 'empenhoId' = v_empenho ->> 'empenhoId';

      IF v_requested > v_effective_balance THEN
        RAISE EXCEPTION 'Saldo insuficiente no empenho %. Saldo disponível: R$ % (Oficial: R$ %, Comprometido em requisições enviadas: R$ %).',
          coalesce(nullif(v_empenho ->> 'empenhoNumero', ''), v_empenho ->> 'empenhoId'),
          to_char(v_effective_balance, 'FM999G999G999G990D00'),
          to_char(greatest(0, v_balance), 'FM999G999G999G990D00'),
          to_char(v_other_enviadas, 'FM999G999G999G990D00')
          USING ERRCODE = 'P0001';
      END IF;
    END LOOP;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.requisicoes_compra (
      title, number, process_number, contrato_id, contrato_numero,
      empenho_id, empenho_numero, notes, status, created_by
    ) VALUES (
      coalesce(nullif(p_requisicao ->> 'title', ''), 'Requisicao de Compra'),
      p_requisicao ->> 'number', nullif(p_requisicao ->> 'processNumber', ''),
      v_contrato_id, nullif(p_requisicao ->> 'contratoNumero', ''),
      v_first_empenho_id, v_first_empenho_numero,
      nullif(p_requisicao ->> 'notes', ''), v_status, auth.uid()
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.requisicoes_compra
    SET title = coalesce(nullif(p_requisicao ->> 'title', ''), 'Requisicao de Compra'),
        number = p_requisicao ->> 'number',
        process_number = nullif(p_requisicao ->> 'processNumber', ''),
        contrato_id = v_contrato_id,
        contrato_numero = nullif(p_requisicao ->> 'contratoNumero', ''),
        empenho_id = v_first_empenho_id,
        empenho_numero = v_first_empenho_numero,
        notes = nullif(p_requisicao ->> 'notes', ''),
        status = v_status
    WHERE id = v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Requisicao nao encontrada ou sem permissao para edicao.' USING ERRCODE = '42501';
    END IF;

    DELETE FROM public.requisicao_compra_itens WHERE requisicao_compra_id = v_id;
    DELETE FROM public.requisicao_compra_empenhos WHERE requisicao_compra_id = v_id;
  END IF;

  INSERT INTO public.requisicao_compra_empenhos (
    requisicao_compra_id,
    empenho_id,
    empenho_numero,
    sort_order
  )
  SELECT v_id,
         (empenho ->> 'empenhoId')::uuid,
         coalesce(nullif(empenho ->> 'empenhoNumero', ''), e.numero),
         ordinality - 1
  FROM jsonb_array_elements(coalesce(p_requisicao -> 'empenhos', '[]'::jsonb)) WITH ORDINALITY AS rows(empenho, ordinality)
  JOIN public.empenhos e ON e.id = (empenho ->> 'empenhoId')::uuid
  ON CONFLICT (requisicao_compra_id, empenho_id) DO UPDATE
  SET empenho_numero = EXCLUDED.empenho_numero,
      sort_order = EXCLUDED.sort_order;

  INSERT INTO public.requisicao_compra_itens (
    requisicao_compra_id,
    description,
    quantity,
    unit,
    unit_price,
    empenho_id,
    empenho_numero,
    source_type,
    source_item_key,
    source_reference,
    source_snapshot,
    sort_order
  )
  SELECT v_id,
         item ->> 'description',
         (item ->> 'quantity')::numeric,
         coalesce(nullif(item ->> 'unit', ''), 'UN'),
         (item ->> 'unitPrice')::numeric,
         nullif(item ->> 'empenhoId', '')::uuid,
         nullif(item ->> 'empenhoNumero', ''),
         coalesce(nullif(item ->> 'sourceType', ''), 'manual'),
         nullif(item ->> 'sourceItemKey', ''),
         nullif(item ->> 'sourceReference', ''),
         CASE
           WHEN jsonb_typeof(item -> 'sourceSnapshot') = 'object' THEN item -> 'sourceSnapshot'
           ELSE '{}'::jsonb
         END,
         ordinality - 1
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS rows(item, ordinality);

  RETURN v_id;
END;
;

REVOKE ALL ON FUNCTION public.save_requisicao_compra(jsonb, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_requisicao_compra(jsonb, jsonb, uuid) TO authenticated;
