-- Autorizações de acesso por matrícula SUAP, campus vindo do SUAP e foto do servidor.
--
-- Migration exclusivamente aditiva: nenhum usuário, grupo, vínculo ou campus existente é alterado.
-- O comportamento atual do login SUAP continua igual enquanto suap_access_settings.require_grant = false
-- e nenhuma matrícula for cadastrada em user_access_grants.

-- ---------------------------------------------------------------------------
-- Configuração global do login SUAP (linha única)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suap_access_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  -- false: quem entra pelo SUAP sem autorização segue a regra antiga (terceirizado ou Diretores).
  -- true: quem entra pelo SUAP sem autorização e sem nenhum grupo fica com acesso pendente.
  require_grant boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.suap_access_settings (id, require_grant)
VALUES (true, false)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Mapa sigla de campus do SUAP -> UASG
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suap_campus_map (
  sigla text PRIMARY KEY CHECK (sigla = upper(btrim(sigla)) AND sigla <> ''),
  campus_uasg text NOT NULL REFERENCES public.licitacoes_pncp_uasgs(codigo_uasg),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Siglas usuais dos campi do IFRN no SUAP. Siglas ausentes são resolvidas pelo nome do campus
-- e, se nada casar, o login segue sem campus definido pelo SUAP. A tabela é editável.
INSERT INTO public.suap_campus_map (sigla, campus_uasg)
SELECT v.sigla, v.campus_uasg
FROM (VALUES
  ('CAL', '152711'),
  ('PAR', '152756'),
  ('NC', '152757'),
  ('SGA', '154582'),
  ('CM', '154838'),
  ('CANG', '154839'),
  ('SPP', '154840'),
  ('RE', '158155'),
  ('ZL', '158155'),
  ('MO', '158365'),
  ('CN', '158366'),
  ('IP', '158367'),
  ('ZN', '158368'),
  ('CNAT', '158369'),
  ('CA', '158370'),
  ('AP', '158371'),
  ('SC', '158372'),
  ('JC', '158373'),
  ('PF', '158374'),
  ('MC', '158375')
) AS v(sigla, campus_uasg)
WHERE EXISTS (SELECT 1 FROM public.licitacoes_pncp_uasgs u WHERE u.codigo_uasg = v.campus_uasg)
ON CONFLICT (sigla) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Autorização por matrícula
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_access_grants (
  matricula text PRIMARY KEY
    CHECK (matricula = public.normalize_terceirizado_matricula(matricula) AND matricula <> ''),
  nome text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'suspenso')),
  valid_until date,
  notes text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email_suap text,
  suap_campus_sigla text,
  last_login_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_access_grants_user_id_idx ON public.user_access_grants (user_id);

CREATE TABLE IF NOT EXISTS public.user_access_grant_groups (
  matricula text NOT NULL REFERENCES public.user_access_grants(matricula) ON DELETE CASCADE ON UPDATE CASCADE,
  group_id uuid NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (matricula, group_id)
);

CREATE TABLE IF NOT EXISTS public.user_access_grant_campi (
  matricula text NOT NULL REFERENCES public.user_access_grants(matricula) ON DELETE CASCADE ON UPDATE CASCADE,
  campus_uasg text NOT NULL REFERENCES public.licitacoes_pncp_uasgs(codigo_uasg),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (matricula, campus_uasg)
);

-- Quem entrou pelo SUAP sem autorização enquanto require_grant = true.
CREATE TABLE IF NOT EXISTS public.suap_access_requests (
  matricula text PRIMARY KEY,
  nome text,
  email text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  vinculo text,
  suap_campus_sigla text,
  suap_campus_uasg text,
  attempts integer NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Perfil do usuário: foto e campus vindos do SUAP
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  foto_url text,
  foto_visivel boolean NOT NULL DEFAULT true,
  suap_matricula text,
  suap_campus_sigla text,
  suap_campus_uasg text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- RLS: administração só pelo superadmin; leitura do próprio perfil
-- ---------------------------------------------------------------------------
ALTER TABLE public.suap_access_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suap_campus_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_access_grant_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_access_grant_campi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suap_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suap_access_settings_superadmin ON public.suap_access_settings;
CREATE POLICY suap_access_settings_superadmin ON public.suap_access_settings
  FOR ALL TO authenticated USING (public.is_superadmin_jwt()) WITH CHECK (public.is_superadmin_jwt());

DROP POLICY IF EXISTS suap_campus_map_read ON public.suap_campus_map;
CREATE POLICY suap_campus_map_read ON public.suap_campus_map
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS suap_campus_map_superadmin ON public.suap_campus_map;
CREATE POLICY suap_campus_map_superadmin ON public.suap_campus_map
  FOR ALL TO authenticated USING (public.is_superadmin_jwt()) WITH CHECK (public.is_superadmin_jwt());

DROP POLICY IF EXISTS user_access_grants_superadmin ON public.user_access_grants;
CREATE POLICY user_access_grants_superadmin ON public.user_access_grants
  FOR ALL TO authenticated USING (public.is_superadmin_jwt()) WITH CHECK (public.is_superadmin_jwt());

DROP POLICY IF EXISTS user_access_grant_groups_superadmin ON public.user_access_grant_groups;
CREATE POLICY user_access_grant_groups_superadmin ON public.user_access_grant_groups
  FOR ALL TO authenticated USING (public.is_superadmin_jwt()) WITH CHECK (public.is_superadmin_jwt());

DROP POLICY IF EXISTS user_access_grant_campi_superadmin ON public.user_access_grant_campi;
CREATE POLICY user_access_grant_campi_superadmin ON public.user_access_grant_campi
  FOR ALL TO authenticated USING (public.is_superadmin_jwt()) WITH CHECK (public.is_superadmin_jwt());

DROP POLICY IF EXISTS suap_access_requests_superadmin ON public.suap_access_requests;
CREATE POLICY suap_access_requests_superadmin ON public.suap_access_requests
  FOR ALL TO authenticated USING (public.is_superadmin_jwt()) WITH CHECK (public.is_superadmin_jwt());

-- O próprio usuário lê o seu perfil. A escrita é feita pela Edge Function (service role)
-- e pela RPC set_my_photo_visibility, para que ninguém troque a própria foto por uma URL qualquer.
DROP POLICY IF EXISTS user_profiles_select_own ON public.user_profiles;
CREATE POLICY user_profiles_select_own ON public.user_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_superadmin_jwt());

-- ---------------------------------------------------------------------------
-- RPCs de foto
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_my_photo_visibility(visible boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão ausente.' USING ERRCODE = '28000';
  END IF;

  INSERT INTO public.user_profiles (user_id, foto_visivel)
  VALUES (auth.uid(), coalesce(visible, true))
  ON CONFLICT (user_id) DO UPDATE
    SET foto_visivel = EXCLUDED.foto_visivel, updated_at = now();

  RETURN coalesce(visible, true);
END;
$$;
REVOKE ALL ON FUNCTION public.set_my_photo_visibility(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_photo_visibility(boolean) TO authenticated;

-- Fotos visíveis de outros usuários (fotos ocultas não saem, nem para o superadmin).
CREATE OR REPLACE FUNCTION public.get_visible_user_photos(target_user_ids uuid[])
RETURNS TABLE (user_id uuid, foto_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.foto_url
  FROM public.user_profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.user_id = ANY (coalesce(target_user_ids, ARRAY[]::uuid[]))
    AND p.foto_visivel = true
    AND p.foto_url IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.get_visible_user_photos(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_visible_user_photos(uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- Campus: quem tem autorização com campi definidos só troca entre esses campi.
-- Usuários sem autorização (todos os atuais) continuam exatamente como antes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_campus_uasg(target_uasg text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed_campi text[];
BEGIN
  IF target_uasg IS NULL OR target_uasg !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'Campus IFRN inválido.' USING ERRCODE = '22023';
  END IF;

  IF target_uasg NOT IN (
    '152711', '152756', '152757', '154582', '154838', '154839', '154840',
    '158155', '158365', '158366', '158367', '158368', '158369', '158370',
    '158371', '158372', '158373', '158374', '158375',
    '158882', '158887', '158896', '158897', '158898'
  ) OR NOT EXISTS (SELECT 1 FROM public.licitacoes_pncp_uasgs WHERE codigo_uasg = target_uasg) THEN
    RAISE EXCEPTION 'Campus IFRN não cadastrado.' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_superadmin_jwt() THEN
    SELECT array_agg(c.campus_uasg)
      INTO allowed_campi
    FROM public.user_access_grants g
    JOIN public.user_access_grant_campi c ON c.matricula = g.matricula
    WHERE g.user_id = auth.uid();

    IF allowed_campi IS NOT NULL AND NOT (target_uasg = ANY (allowed_campi)) THEN
      RAISE EXCEPTION 'Campus não liberado para a sua matrícula.' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.user_campus_preferences (user_id, campus_uasg)
  VALUES (auth.uid(), target_uasg)
  ON CONFLICT (user_id) DO UPDATE
    SET campus_uasg = EXCLUDED.campus_uasg, updated_at = now();

  RETURN target_uasg;
END;
$$;
REVOKE ALL ON FUNCTION public.set_user_campus_uasg(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_campus_uasg(text) TO authenticated;
