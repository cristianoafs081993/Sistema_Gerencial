CREATE TABLE IF NOT EXISTS public.retencoes_efd_reinf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_index INTEGER NOT NULL,
  documento_habil TEXT NOT NULL,
  dh_processo TEXT,
  dh_estado TEXT,
  dh_ug_pagadora TEXT,
  dh_item_ug_pagadora TEXT,
  dh_credor_documento TEXT,
  dh_credor_nome TEXT,
  dh_situacao TEXT,
  dh_data_emissao_doc_origem DATE,
  dh_dia_pagamento DATE,
  dh_item_dia_vencimento DATE,
  dh_item_dia_pagamento DATE,
  dh_item_liquidado BOOLEAN,
  dh_valor_doc_origem NUMERIC(16,2) NOT NULL DEFAULT 0,
  metrica TEXT,
  valor_retencao NUMERIC(16,2) NOT NULL DEFAULT 0,
  source_file TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS retencoes_efd_reinf_uniq
  ON public.retencoes_efd_reinf (
    documento_habil,
    dh_processo,
    dh_situacao,
    dh_credor_documento,
    dh_dia_pagamento,
    valor_retencao
  );

CREATE INDEX IF NOT EXISTS retencoes_efd_reinf_documento_idx
  ON public.retencoes_efd_reinf (documento_habil);

CREATE INDEX IF NOT EXISTS retencoes_efd_reinf_situacao_idx
  ON public.retencoes_efd_reinf (dh_situacao);

CREATE INDEX IF NOT EXISTS retencoes_efd_reinf_imported_at_idx
  ON public.retencoes_efd_reinf (imported_at DESC);

ALTER TABLE public.retencoes_efd_reinf ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura anonima em retencoes_efd_reinf'
  ) THEN
    CREATE POLICY "Permitir leitura anonima em retencoes_efd_reinf"
      ON public.retencoes_efd_reinf FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Permitir todas operacoes public retencoes_efd_reinf'
  ) THEN
    CREATE POLICY "Permitir todas operacoes public retencoes_efd_reinf"
      ON public.retencoes_efd_reinf FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_update_retencoes_efd_reinf_updated_at ON public.retencoes_efd_reinf;
CREATE TRIGGER trg_update_retencoes_efd_reinf_updated_at
BEFORE UPDATE ON public.retencoes_efd_reinf
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
