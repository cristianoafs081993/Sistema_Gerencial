-- Tabela para armazenamento de dados do arquivo 7 - LC.csv
CREATE TABLE IF NOT EXISTS public.lc_credores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ob_lista_credores TEXT NOT NULL,
  sequencial INTEGER NOT NULL,
  favorecido_documento TEXT NOT NULL,
  favorecido_nome TEXT,
  banco_codigo TEXT,
  banco_nome TEXT,
  agencia_codigo TEXT,
  agencia_nome TEXT,
  conta_bancaria TEXT,
  source_file TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lc_credores_uniq
  ON public.lc_credores (ob_lista_credores, sequencial);

CREATE INDEX IF NOT EXISTS lc_credores_lista_idx
  ON public.lc_credores (ob_lista_credores);

CREATE INDEX IF NOT EXISTS lc_credores_doc_idx
  ON public.lc_credores (favorecido_documento);

ALTER TABLE public.lc_credores ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura anonima em lc_credores'
  ) THEN
    CREATE POLICY "Permitir leitura anonima em lc_credores"
      ON public.lc_credores FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Permitir todas operacoes public lc_credores'
  ) THEN
    CREATE POLICY "Permitir todas operacoes public lc_credores"
      ON public.lc_credores FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
