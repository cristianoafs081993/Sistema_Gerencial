ALTER TABLE public.descentralizacoes
  ADD COLUMN IF NOT EXISTS natureza_despesa TEXT,
  ADD COLUMN IF NOT EXISTS data_emissao DATE,
  ADD COLUMN IF NOT EXISTS descricao TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS nota_credito TEXT,
  ADD COLUMN IF NOT EXISTS operacao_tipo TEXT;

CREATE INDEX IF NOT EXISTS idx_descentralizacoes_nota_credito
  ON public.descentralizacoes (nota_credito)
  WHERE nota_credito IS NOT NULL;
