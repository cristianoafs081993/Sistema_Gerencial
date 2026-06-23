-- Use SUAP matricula as the operational key for terceirizados.

CREATE OR REPLACE FUNCTION public.normalize_terceirizado_matricula(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(btrim(coalesce(value, '')), '[^0-9A-Za-z]', '', 'g'));
$$;

ALTER TABLE public.terceirizados
  ADD COLUMN IF NOT EXISTS matricula text;

ALTER TABLE public.terceirizados
  ALTER COLUMN email DROP NOT NULL;

ALTER TABLE public.terceirizado_permissions
  ADD COLUMN IF NOT EXISTS user_matricula text;

ALTER TABLE public.terceirizados
  DROP CONSTRAINT IF EXISTS terceirizados_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_terceirizados_matricula
  ON public.terceirizados (public.normalize_terceirizado_matricula(matricula))
  WHERE public.normalize_terceirizado_matricula(matricula) <> '';

CREATE INDEX IF NOT EXISTS idx_terceirizado_permissions_user_matricula
  ON public.terceirizado_permissions (public.normalize_terceirizado_matricula(user_matricula));

CREATE UNIQUE INDEX IF NOT EXISTS uidx_terceirizado_matricula_contrato
  ON public.terceirizado_permissions (public.normalize_terceirizado_matricula(user_matricula), contrato_id)
  WHERE contrato_id IS NOT NULL
    AND public.normalize_terceirizado_matricula(user_matricula) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uidx_terceirizado_matricula_empenho
  ON public.terceirizado_permissions (public.normalize_terceirizado_matricula(user_matricula), empenho_id)
  WHERE empenho_id IS NOT NULL
    AND public.normalize_terceirizado_matricula(user_matricula) <> '';

UPDATE public.terceirizados t
SET matricula = public.normalize_terceirizado_matricula(
  coalesce(
    u.raw_user_meta_data ->> 'matricula',
    u.raw_user_meta_data ->> 'username',
    u.raw_user_meta_data ->> 'identificacao'
  )
)
FROM auth.users u
WHERE public.normalize_terceirizado_matricula(t.matricula) = ''
  AND (
    t.user_id = u.id
    OR (t.email IS NOT NULL AND lower(t.email) = lower(u.email))
  )
  AND public.normalize_terceirizado_matricula(
    coalesce(
      u.raw_user_meta_data ->> 'matricula',
      u.raw_user_meta_data ->> 'username',
      u.raw_user_meta_data ->> 'identificacao'
    )
  ) <> '';

UPDATE public.terceirizado_permissions p
SET user_matricula = t.matricula
FROM public.terceirizados t
WHERE public.normalize_terceirizado_matricula(p.user_matricula) = ''
  AND public.normalize_terceirizado_matricula(t.matricula) <> ''
  AND (
    (p.user_id IS NOT NULL AND p.user_id = t.user_id)
    OR (p.user_email <> '' AND t.email IS NOT NULL AND lower(p.user_email) = lower(t.email))
  );

CREATE OR REPLACE FUNCTION public.fn_sync_terceirizado_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  normalized_matricula text;
BEGIN
  normalized_matricula := public.normalize_terceirizado_matricula(NEW.matricula);
  NEW.matricula := nullif(normalized_matricula, '');

  IF NEW.user_id IS NULL AND NEW.matricula IS NOT NULL THEN
    SELECT id INTO NEW.user_id
    FROM auth.users
    WHERE public.normalize_terceirizado_matricula(raw_user_meta_data ->> 'matricula') = NEW.matricula
       OR public.normalize_terceirizado_matricula(raw_user_meta_data ->> 'username') = NEW.matricula
       OR public.normalize_terceirizado_matricula(raw_user_meta_data ->> 'identificacao') = NEW.matricula
    LIMIT 1;
  END IF;

  IF NEW.user_id IS NULL AND nullif(NEW.email, '') IS NOT NULL THEN
    SELECT id INTO NEW.user_id
    FROM auth.users
    WHERE lower(email) = lower(NEW.email)
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_sync_permission_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  normalized_matricula text;
BEGIN
  normalized_matricula := public.normalize_terceirizado_matricula(NEW.user_matricula);
  NEW.user_matricula := nullif(normalized_matricula, '');

  IF NEW.user_matricula IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT matricula INTO NEW.user_matricula
    FROM public.terceirizados
    WHERE user_id = NEW.user_id
      AND public.normalize_terceirizado_matricula(matricula) <> ''
    LIMIT 1;
  END IF;

  IF NEW.user_matricula IS NULL AND nullif(NEW.user_email, '') IS NOT NULL THEN
    SELECT matricula INTO NEW.user_matricula
    FROM public.terceirizados
    WHERE lower(email) = lower(NEW.user_email)
      AND public.normalize_terceirizado_matricula(matricula) <> ''
    LIMIT 1;
  END IF;

  IF NEW.user_id IS NULL AND NEW.user_matricula IS NOT NULL THEN
    SELECT id INTO NEW.user_id
    FROM auth.users
    WHERE public.normalize_terceirizado_matricula(raw_user_meta_data ->> 'matricula') = NEW.user_matricula
       OR public.normalize_terceirizado_matricula(raw_user_meta_data ->> 'username') = NEW.user_matricula
       OR public.normalize_terceirizado_matricula(raw_user_meta_data ->> 'identificacao') = NEW.user_matricula
    LIMIT 1;
  END IF;

  IF NEW.user_id IS NULL AND nullif(NEW.user_email, '') IS NOT NULL THEN
    SELECT id INTO NEW.user_id
    FROM auth.users
    WHERE lower(email) = lower(NEW.user_email)
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_handle_new_auth_user_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  normalized_matricula text;
BEGIN
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
$$;

DROP TRIGGER IF EXISTS trg_sync_terceirizado_user_id ON public.terceirizados;
CREATE TRIGGER trg_sync_terceirizado_user_id
BEFORE INSERT OR UPDATE ON public.terceirizados
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_terceirizado_user_id();

DROP TRIGGER IF EXISTS trg_sync_permission_user_id ON public.terceirizado_permissions;
CREATE TRIGGER trg_sync_permission_user_id
BEFORE INSERT OR UPDATE ON public.terceirizado_permissions
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_permission_user_id();

DROP TRIGGER IF EXISTS trg_handle_new_auth_user_sync ON auth.users;
CREATE TRIGGER trg_handle_new_auth_user_sync
AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_auth_user_sync();

DROP POLICY IF EXISTS "Leitura de terceirizados" ON public.terceirizados;
CREATE POLICY "Leitura de terceirizados"
  ON public.terceirizados FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
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
    OR public.is_superadmin_jwt()
    OR EXISTS (
      SELECT 1 FROM public.user_group_memberships m
      JOIN public.user_groups g ON m.group_id = g.id
      WHERE m.user_id = auth.uid()
        AND g.slug IN ('diretores', 'fiscal-contratos', 'teste')
    )
  );
