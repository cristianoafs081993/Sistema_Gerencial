CREATE TABLE IF NOT EXISTS public.email_csv_ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,
  thread_id TEXT,
  sender_email TEXT,
  subject TEXT,
  received_at TIMESTAMPTZ,
  attachment_name TEXT NOT NULL,
  attachment_mime_type TEXT,
  attachment_sha256 TEXT NOT NULL,
  pipeline TEXT,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'succeeded', 'failed', 'skipped')),
  rows_detected INTEGER NOT NULL DEFAULT 0,
  rows_written INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, attachment_sha256)
);

CREATE INDEX IF NOT EXISTS email_csv_ingestion_runs_status_idx
  ON public.email_csv_ingestion_runs (status);

CREATE INDEX IF NOT EXISTS email_csv_ingestion_runs_pipeline_idx
  ON public.email_csv_ingestion_runs (pipeline);

CREATE INDEX IF NOT EXISTS email_csv_ingestion_runs_received_at_idx
  ON public.email_csv_ingestion_runs (received_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS email_csv_ingestion_runs_processed_at_idx
  ON public.email_csv_ingestion_runs (processed_at DESC NULLS LAST);

ALTER TABLE public.email_csv_ingestion_runs ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_update_email_csv_ingestion_runs_updated_at ON public.email_csv_ingestion_runs;
CREATE TRIGGER trg_update_email_csv_ingestion_runs_updated_at
BEFORE UPDATE ON public.email_csv_ingestion_runs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
