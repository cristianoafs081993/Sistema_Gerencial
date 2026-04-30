ALTER TABLE public.retencoes_efd_reinf
  ADD COLUMN IF NOT EXISTS correcao_realizada BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS retencoes_efd_reinf_correcao_realizada_idx
  ON public.retencoes_efd_reinf (correcao_realizada);
