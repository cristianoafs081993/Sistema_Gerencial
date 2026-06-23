-- Restrict terceirizados to purchase requisitions and save requisitions atomically with balance validation.

DELETE FROM public.user_group_screen_permissions permission
USING public.user_groups group_row
WHERE permission.group_id = group_row.id
  AND group_row.slug = 'terceirizado'
  AND permission.screen_id <> 'requisicao-compra';

INSERT INTO public.user_group_screen_permissions (group_id, screen_id, can_access)
SELECT id, 'requisicao-compra', true
FROM public.user_groups
WHERE slug = 'terceirizado'
ON CONFLICT (group_id, screen_id) DO UPDATE
SET can_access = true,
    updated_at = now();

WITH identified_users AS (
  SELECT DISTINCT user_row.id, user_row.email
  FROM auth.users user_row
  JOIN public.terceirizados terceirizado
    ON terceirizado.user_id = user_row.id
    OR public.normalize_terceirizado_matricula(terceirizado.matricula) =
       public.normalize_terceirizado_matricula(
         coalesce(
           user_row.raw_user_meta_data ->> 'matricula',
           user_row.raw_user_meta_data ->> 'username',
           user_row.raw_user_meta_data ->> 'identificacao'
         )
       )
  WHERE terceirizado.tipo = 'refeitorio'
)
DELETE FROM public.user_group_memberships membership
USING identified_users identified, public.user_groups group_row
WHERE membership.user_id = identified.id
  AND membership.group_id = group_row.id
  AND group_row.slug <> 'terceirizado';

WITH identified_users AS (
  SELECT DISTINCT user_row.id, user_row.email
  FROM auth.users user_row
  JOIN public.terceirizados terceirizado
    ON terceirizado.user_id = user_row.id
    OR public.normalize_terceirizado_matricula(terceirizado.matricula) =
       public.normalize_terceirizado_matricula(
         coalesce(
           user_row.raw_user_meta_data ->> 'matricula',
           user_row.raw_user_meta_data ->> 'username',
           user_row.raw_user_meta_data ->> 'identificacao'
         )
       )
  WHERE terceirizado.tipo = 'refeitorio'
)
INSERT INTO public.user_group_memberships (user_id, email, group_id)
SELECT identified.id, identified.email, group_row.id
FROM identified_users identified
CROSS JOIN public.user_groups group_row
WHERE group_row.slug = 'terceirizado'
ON CONFLICT (user_id, group_id) DO UPDATE
SET email = excluded.email,
    updated_at = now();

CREATE OR REPLACE FUNCTION public.fn_empenho_saldo_disponivel(p_empenho_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
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

CREATE OR REPLACE FUNCTION public.save_requisicao_compra(
  p_requisicao jsonb,
  p_items jsonb,
  p_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid := p_id;
  v_status text := coalesce(nullif(p_requisicao ->> 'status', ''), 'draft');
  v_empenho_id uuid := nullif(p_requisicao ->> 'empenhoId', '')::uuid;
  v_contrato_id uuid := nullif(p_requisicao ->> 'contratoId', '')::uuid;
  v_total numeric := 0;
  v_balance numeric;
  v_reserved numeric := 0;
  v_is_terceirizado boolean := false;
  v_is_manager boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  IF v_status NOT IN ('draft', 'review', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Situação de requisição inválida.' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Adicione ao menos um item à requisição.' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(sum((item ->> 'quantity')::numeric * (item ->> 'unitPrice')::numeric), 0)
  INTO v_total
  FROM jsonb_array_elements(p_items) item;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) item
    WHERE btrim(coalesce(item ->> 'description', '')) = ''
       OR coalesce((item ->> 'quantity')::numeric, 0) <= 0
       OR coalesce((item ->> 'unitPrice')::numeric, -1) < 0
  ) THEN
    RAISE EXCEPTION 'Os itens possuem dados inválidos.' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.terceirizados terceirizado
    WHERE terceirizado.tipo = 'refeitorio'
      AND (
        terceirizado.user_id = auth.uid()
        OR public.normalize_terceirizado_matricula(terceirizado.matricula) =
           public.normalize_terceirizado_matricula(
             coalesce(
               auth.jwt() -> 'user_metadata' ->> 'matricula',
               auth.jwt() -> 'user_metadata' ->> 'username',
               auth.jwt() -> 'user_metadata' ->> 'identificacao'
             )
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

  IF v_status IN ('approved', 'rejected') AND NOT v_is_manager THEN
    RAISE EXCEPTION 'Somente fiscais ou gestores podem aprovar ou rejeitar requisições.' USING ERRCODE = '42501';
  END IF;

  IF v_is_terceirizado THEN
    IF v_status NOT IN ('draft', 'review') THEN
      RAISE EXCEPTION 'Terceirizados não podem aprovar ou rejeitar requisições.' USING ERRCODE = '42501';
    END IF;

    IF v_contrato_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.terceirizado_permissions permission
      WHERE permission.contrato_id = v_contrato_id
        AND permission.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Contrato não autorizado para este terceirizado.' USING ERRCODE = '42501';
    END IF;

    IF v_empenho_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.terceirizado_permissions permission
      WHERE permission.user_id = auth.uid()
        AND (
          permission.empenho_id = v_empenho_id
          OR (
            permission.contrato_id = v_contrato_id
            AND EXISTS (
              SELECT 1 FROM public.contratos_empenhos link
              WHERE link.contrato_id = v_contrato_id
                AND link.empenho_id = v_empenho_id
            )
          )
        )
    ) THEN
      RAISE EXCEPTION 'Empenho não autorizado para este terceirizado.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_status IN ('review', 'approved') THEN
    IF v_empenho_id IS NULL THEN
      RAISE EXCEPTION 'Selecione um empenho antes de enviar a requisição.' USING ERRCODE = '22023';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext(v_empenho_id::text));
    SELECT public.fn_empenho_saldo_disponivel(v_empenho_id) INTO v_balance;
    IF v_balance IS NULL THEN
      RAISE EXCEPTION 'Empenho selecionado não foi encontrado.' USING ERRCODE = '22023';
    END IF;

    SELECT coalesce(sum(item.quantity * item.unit_price), 0)
    INTO v_reserved
    FROM public.requisicoes_compra requisicao
    JOIN public.requisicao_compra_itens item ON item.requisicao_compra_id = requisicao.id
    WHERE requisicao.empenho_id = v_empenho_id
      AND requisicao.status = 'review'
      AND (v_id IS NULL OR requisicao.id <> v_id);

    IF v_total > greatest(0, v_balance - v_reserved) THEN
      RAISE EXCEPTION 'Saldo insuficiente no empenho. Disponível para novas requisições: R$ %.',
        to_char(greatest(0, v_balance - v_reserved), 'FM999G999G999G990D00') USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.requisicoes_compra (
      title, number, process_number, contrato_id, contrato_numero,
      empenho_id, empenho_numero, notes, status, created_by
    ) VALUES (
      coalesce(nullif(p_requisicao ->> 'title', ''), 'Requisição de Compra'),
      p_requisicao ->> 'number', nullif(p_requisicao ->> 'processNumber', ''),
      v_contrato_id, nullif(p_requisicao ->> 'contratoNumero', ''),
      v_empenho_id, nullif(p_requisicao ->> 'empenhoNumero', ''),
      nullif(p_requisicao ->> 'notes', ''), v_status, auth.uid()
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.requisicoes_compra
    SET title = coalesce(nullif(p_requisicao ->> 'title', ''), 'Requisição de Compra'),
        number = p_requisicao ->> 'number',
        process_number = nullif(p_requisicao ->> 'processNumber', ''),
        contrato_id = v_contrato_id,
        contrato_numero = nullif(p_requisicao ->> 'contratoNumero', ''),
        empenho_id = v_empenho_id,
        empenho_numero = nullif(p_requisicao ->> 'empenhoNumero', ''),
        notes = nullif(p_requisicao ->> 'notes', ''),
        status = v_status
    WHERE id = v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Requisição não encontrada ou sem permissão para edição.' USING ERRCODE = '42501';
    END IF;

    DELETE FROM public.requisicao_compra_itens WHERE requisicao_compra_id = v_id;
  END IF;

  INSERT INTO public.requisicao_compra_itens (
    requisicao_compra_id, description, quantity, unit, unit_price, sort_order
  )
  SELECT v_id,
         item ->> 'description',
         (item ->> 'quantity')::numeric,
         coalesce(nullif(item ->> 'unit', ''), 'UN'),
         (item ->> 'unitPrice')::numeric,
         ordinality - 1
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS rows(item, ordinality);

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_requisicao_compra(jsonb, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_requisicao_compra(jsonb, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_empenho_saldo_disponivel(uuid) TO authenticated;
