-- Migration: Tabela de documentos de contratos do PNCP e cron job de sincronização diária às 05:00 BRT (08:00 UTC)

-- 1. Colunas de rastreamento do PNCP na tabela contratos_api
ALTER TABLE contratos_api
  ADD COLUMN IF NOT EXISTS pncp_sequencial INTEGER,
  ADD COLUMN IF NOT EXISTS pncp_ano INTEGER,
  ADD COLUMN IF NOT EXISTS pncp_control_number TEXT,
  ADD COLUMN IF NOT EXISTS pncp_has_record BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pncp_documentos_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pncp_documentos_count INTEGER DEFAULT 0;

-- 2. Tabela de documentos oficiais vinculados aos contratos da API
CREATE TABLE IF NOT EXISTS contratos_api_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_api_id UUID NOT NULL REFERENCES contratos_api(id) ON DELETE CASCADE,
  sequencial_documento INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  tipo_documento_id INTEGER,
  tipo_documento_nome TEXT,
  url TEXT NOT NULL,
  uri TEXT,
  data_publicacao_pncp TIMESTAMPTZ,
  tamanho BIGINT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contrato_api_id, sequencial_documento, url)
);

CREATE INDEX IF NOT EXISTS idx_contratos_api_documentos_contrato_api_id
  ON contratos_api_documentos(contrato_api_id);

CREATE INDEX IF NOT EXISTS idx_contratos_api_documentos_data_pub
  ON contratos_api_documentos(data_publicacao_pncp DESC NULLS LAST);

-- 3. Habilita RLS e políticas de leitura pública/autenticada
ALTER TABLE contratos_api_documentos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'contratos_api_documentos' AND policyname = 'Permitir leitura de documentos de contratos para todos'
  ) THEN
    CREATE POLICY "Permitir leitura de documentos de contratos para todos"
      ON contratos_api_documentos FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'contratos_api_documentos' AND policyname = 'Permitir gerenciamento de documentos de contratos para service_role'
  ) THEN
    CREATE POLICY "Permitir gerenciamento de documentos de contratos para service_role"
      ON contratos_api_documentos FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 4. Extensões pg_cron e pg_net para agendamento periódico
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 5. Agendamento do cron diário de sincronização de documentos do PNCP às 08:00 UTC (05:00 no Horário de Brasília)
SELECT cron.unschedule('sync-contratos-pncp-documentos-daily')
WHERE EXISTS (
  SELECT 1
  FROM cron.job
  WHERE jobname = 'sync-contratos-pncp-documentos-daily'
);

SELECT cron.schedule(
  'sync-contratos-pncp-documentos-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mnqhwyrzhgykjlyyqodd.supabase.co/functions/v1/sync-contratos-pncp-documentos',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"source": "supabase-cron-daily", "unidadeCodigo": "158366"}'::jsonb,
    timeout_milliseconds := 600000
  );
  $$
);
