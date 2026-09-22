-- Migration: Correção de vínculo de órgão para terceirizados e ajuste de RLS/RPC de requisições de compra
-- Garante que todos os usuários autenticados possuam org_id válido e que o salvamento de requisições
-- com status 'enviada_fornecedor' funcione sem bloqueios indevidos de RLS.

-- 1. Backfill de usuários existentes que ainda não constam em org_users
INSERT INTO public.org_users (org_id, user_id, role)
SELECT public.default_org_id(), u.id, 'member'
FROM auth.users u
LEFT JOIN public.org_users o ON o.user_id = u.id
WHERE o.org_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- 2. Resiliência em current_user_org_id(): fallback para default_org_id()
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

-- 3. Trigger de sincronização de novos usuários da autenticação
CREATE OR REPLACE FUNCTION public.fn_handle_new_auth_user_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  normalized_matricula text;
BEGIN
  -- Garante o vínculo do novo usuário ao órgão padrão caso não exista
  INSERT INTO public.org_users (org_id, user_id, role)
  VALUES (public.default_org_id(), NEW.id, 'member')
  ON CONFLICT (user_id) DO NOTHING;

  normalized_matricula := public.normalize_terceirizado_matricula(
    coalesce(
      NEW.raw_user_meta_data ->> 'matricula',
      NEW.raw_user_meta_data ->> 'username',
      NEW.raw_user_meta_data ->> 'identificacao'
    )
  );

  IF normalized_matricula <> '' THEN
    UPDATE public.terceirizados
    SET user_id = NEW.id
    WHERE public.normalize_terceirizado_matricula(matricula) = normalized_matricula
      AND (user_id IS NULL OR user_id <> NEW.id);

    UPDATE public.terceirizado_permissions
    SET user_id = NEW.id
    WHERE public.normalize_terceirizado_matricula(user_matricula) = normalized_matricula
      AND (user_id IS NULL OR user_id <> NEW.id);
  END IF;

  IF NEW.email IS NOT NULL THEN
    UPDATE public.terceirizados
    SET user_id = NEW.id
    WHERE lower(email) = lower(NEW.email)
      AND user_id IS NULL;

    UPDATE public.terceirizado_permissions
    SET user_id = NEW.id
    WHERE lower(user_email) = lower(NEW.email)
      AND user_id IS NULL;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Função auxiliar de saldo disponível empenhado: SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.fn_empenho_saldo_disponivel(p_empenho_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT greatest(
    0,
    CASE
      WHEN tipo = 'rap' THEN coalesce(
        saldo_rap_oficial,
        greatest(0, coalesce(rap_a_liquidar, rap_inscrito, valor, 0) - coalesce(rap_pago, 0))
      )
      ELSE coalesce(valor, 0)
        - coalesce(valor_liquidado_a_pagar, 0)
        - coalesce(valor_pago_oficial, 0)
    END
  )
  FROM public.empenhos
  WHERE id = p_empenho_id
$$;

GRANT EXECUTE ON FUNCTION public.fn_empenho_saldo_disponivel(uuid) TO authenticated;

-- 5. Atualizar políticas RLS de requisição para aceitar status 'enviada_fornecedor'
DROP POLICY IF EXISTS "Atualizar requisicoes_compra" ON public.requisicoes_compra;
CREATE POLICY "Atualizar requisicoes_compra"
  ON public.requisicoes_compra FOR UPDATE TO authenticated
  USING (
    (created_by = auth.uid() AND status IN ('draft', 'review', 'enviada_fornecedor'))
    OR public.is_superadmin_jwt()
    OR EXISTS (
      SELECT 1
      FROM public.user_group_memberships membership
      JOIN public.user_groups group_row ON group_row.id = membership.group_id
      WHERE membership.user_id = auth.uid()
        AND group_row.slug IN ('diretores', 'fiscal-contratos', 'fiscais-de-contratos', 'teste')
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
          (parent.created_by = auth.uid() AND parent.status IN ('draft', 'review', 'enviada_fornecedor'))
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
          (parent.created_by = auth.uid() AND parent.status IN ('draft', 'review', 'enviada_fornecedor'))
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
          (parent.created_by = auth.uid() AND parent.status IN ('draft', 'review', 'enviada_fornecedor'))
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
          (parent.created_by = auth.uid() AND parent.status IN ('draft', 'review', 'enviada_fornecedor'))
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

-- 6. RPC save_requisicao_compra: SECURITY DEFINER para garantir atomicidade e isolamento
CREATE OR REPLACE FUNCTION public.save_requisicao_compra(
  p_requisicao jsonb,
  p_items jsonb,
  p_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      AND group_row.slug IN ('diretores', 'fiscal-contratos', 'fiscais-de-contratos', 'teste')
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
$function$;

REVOKE ALL ON FUNCTION public.save_requisicao_compra(jsonb, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_requisicao_compra(jsonb, jsonb, uuid) TO authenticated;
