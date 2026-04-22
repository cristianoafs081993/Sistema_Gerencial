ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS questionnaire_schema jsonb;
