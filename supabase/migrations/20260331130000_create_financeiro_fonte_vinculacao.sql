-- Tabela para armazenar saldos financeiros por fonte e vinculacao
CREATE TABLE IF NOT EXISTS public.financeiro_fonte_vinculacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ug_codigo TEXT NOT NULL,
  ug_nome TEXT,
  mes_lancamento TEXT NOT NULL,
  fonte_codigo TEXT NOT NULL,
  fonte_descricao TEXT,
  vinculacao_codigo TEXT NOT NULL,
  vinculacao_descricao TEXT,
  saldo_disponivel NUMERIC(16,2) NOT NULL DEFAULT 0,
  source_file TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS financeiro_fonte_vinculacao_uniq
  ON public.financeiro_fonte_vinculacao (ug_codigo, mes_lancamento, fonte_codigo, vinculacao_codigo);

CREATE INDEX IF NOT EXISTS financeiro_fonte_vinculacao_fonte_idx
  ON public.financeiro_fonte_vinculacao (fonte_codigo);

CREATE INDEX IF NOT EXISTS financeiro_fonte_vinculacao_vinc_idx
  ON public.financeiro_fonte_vinculacao (vinculacao_codigo);

CREATE INDEX IF NOT EXISTS financeiro_fonte_vinculacao_mes_idx
  ON public.financeiro_fonte_vinculacao (mes_lancamento);

ALTER TABLE public.financeiro_fonte_vinculacao ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura anonima em financeiro_fonte_vinculacao'
  ) THEN
    CREATE POLICY "Permitir leitura anonima em financeiro_fonte_vinculacao"
      ON public.financeiro_fonte_vinculacao FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Permitir todas operacoes public financeiro_fonte_vinculacao'
  ) THEN
    CREATE POLICY "Permitir todas operacoes public financeiro_fonte_vinculacao"
      ON public.financeiro_fonte_vinculacao FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
