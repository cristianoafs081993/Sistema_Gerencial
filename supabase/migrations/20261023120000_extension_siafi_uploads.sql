-- Capturas SIAFI do comando printup da extensão aguardando o upload no SUAP.
-- O PDF fica no bucket privado siafi-capturas e a linha liga o arquivo ao número do processo.
-- Os dois são lidos por qualquer perfil do Chrome logado na mesma conta SIAGES.
-- São temporários: a extensão apaga ao salvar no SUAP e a limpeza diária remove o restante do dia.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('siafi-capturas', 'siafi-capturas', false, 41943040, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Caminho: <usuário>/<NUP com 17 dígitos>/<DH>.pdf
CREATE POLICY siafi_capturas_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'siafi-capturas' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY siafi_capturas_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'siafi-capturas'
    AND array_length(storage.foldername(name), 1) = 2
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (storage.foldername(name))[2] ~ '^[0-9]{17}$'
    AND storage.filename(name) ~ '^[0-9A-Za-z-]{1,60}\.pdf$'
  );
CREATE POLICY siafi_capturas_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'siafi-capturas' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (
    bucket_id = 'siafi-capturas'
    AND array_length(storage.foldername(name), 1) = 2
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (storage.foldername(name))[2] ~ '^[0-9]{17}$'
    AND storage.filename(name) ~ '^[0-9A-Za-z-]{1,60}\.pdf$'
  );
CREATE POLICY siafi_capturas_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'siafi-capturas' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE TABLE public.extension_siafi_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  process_key text NOT NULL CHECK (process_key ~ '^[0-9]{17}$'),
  document_key text NOT NULL CHECK (document_key ~ '^[0-9A-Za-z-]{1,60}$'),
  document_label text NOT NULL DEFAULT '' CHECK (length(document_label) <= 80),
  file_name text NOT NULL CHECK (length(file_name) BETWEEN 5 AND 200 AND file_name ~* '\.pdf$'),
  storage_path text NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 41943040),
  capture_id text NOT NULL DEFAULT '' CHECK (length(capture_id) <= 80),
  open_requested boolean NOT NULL DEFAULT false,
  opened_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, process_key, document_key),
  CHECK (storage_path = tenant_id::text || '/' || process_key || '/' || document_key || '.pdf')
);
CREATE INDEX extension_siafi_uploads_process_idx ON public.extension_siafi_uploads(tenant_id, process_key, updated_at DESC);

ALTER TABLE public.extension_siafi_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY extension_siafi_uploads_select ON public.extension_siafi_uploads FOR SELECT TO authenticated
  USING (tenant_id = auth.uid());
CREATE POLICY extension_siafi_uploads_insert ON public.extension_siafi_uploads FOR INSERT TO authenticated
  WITH CHECK (tenant_id = auth.uid());
CREATE POLICY extension_siafi_uploads_update ON public.extension_siafi_uploads FOR UPDATE TO authenticated
  USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
CREATE POLICY extension_siafi_uploads_delete ON public.extension_siafi_uploads FOR DELETE TO authenticated
  USING (tenant_id = auth.uid());

REVOKE ALL ON public.extension_siafi_uploads FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extension_siafi_uploads TO authenticated;
GRANT ALL ON public.extension_siafi_uploads TO service_role;

-- O relógio do servidor define a janela de abertura automática e o dia da limpeza.
CREATE FUNCTION public.stamp_extension_siafi_uploads() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END $$;
CREATE TRIGGER extension_siafi_uploads_stamp BEFORE INSERT OR UPDATE ON public.extension_siafi_uploads
  FOR EACH ROW EXECUTE FUNCTION public.stamp_extension_siafi_uploads();

-- Arquivos do bucket anteriores ao corte, inclusive órfãos sem linha. A exclusão é feita pela API do
-- Storage na Edge Function cleanup-siafi-capturas; o SQL só lista.
CREATE FUNCTION public.siafi_capturas_cleanup_candidates(p_cutoff timestamptz, p_limit integer DEFAULT 100)
RETURNS TABLE(name text) LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT o.name FROM storage.objects o
  WHERE o.bucket_id = 'siafi-capturas' AND greatest(o.created_at, o.updated_at) < p_cutoff
  ORDER BY o.name
  LIMIT greatest(1, least(coalesce(p_limit, 100), 1000));
$$;
REVOKE ALL ON FUNCTION public.siafi_capturas_cleanup_candidates(timestamptz, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.siafi_capturas_cleanup_candidates(timestamptz, integer) TO service_role;
