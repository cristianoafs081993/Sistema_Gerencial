ALTER TABLE manutencao_ocorrencias
  ADD COLUMN IF NOT EXISTS foto_path TEXT;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'manutencao-ocorrencias',
  'manutencao-ocorrencias',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy
    WHERE polname = 'Permitir envio publico de fotos de manutencao'
      AND polrelid = 'storage.objects'::regclass
  ) THEN
    CREATE POLICY "Permitir envio publico de fotos de manutencao"
    ON storage.objects
    FOR INSERT
    TO public
    WITH CHECK (
      bucket_id = 'manutencao-ocorrencias'
      AND array_length(storage.foldername(name), 1) = 1
      AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy
    WHERE polname = 'Permitir leitura autenticada de fotos de manutencao'
      AND polrelid = 'storage.objects'::regclass
  ) THEN
    CREATE POLICY "Permitir leitura autenticada de fotos de manutencao"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'manutencao-ocorrencias');
  END IF;
END $$;
