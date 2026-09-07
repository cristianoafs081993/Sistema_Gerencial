-- Arquivos vinculados diretamente ao contrato na API Contratos.gov.br.
-- Mantidos separados dos documentos PNCP para preservar origem e rastreabilidade.
CREATE TABLE IF NOT EXISTS public.contratos_api_compras_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_api_id uuid NOT NULL REFERENCES public.contratos_api(id) ON DELETE CASCADE,
  api_arquivo_id bigint NOT NULL,
  tipo text,
  processo text,
  descricao text,
  url text NOT NULL,
  origem text,
  link_sei text,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contrato_api_id, api_arquivo_id)
);

CREATE INDEX IF NOT EXISTS contratos_api_compras_documentos_contrato_idx
  ON public.contratos_api_compras_documentos (contrato_api_id);

CREATE TRIGGER trg_update_contratos_api_compras_documentos_updated_at
BEFORE UPDATE ON public.contratos_api_compras_documentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.contratos_api_compras_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura anonima em contratos_api_compras_documentos" ON public.contratos_api_compras_documentos;
CREATE POLICY "Permitir leitura anonima em contratos_api_compras_documentos"
  ON public.contratos_api_compras_documentos FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Permitir todas operacoes authenticated contratos_api_compras_documentos" ON public.contratos_api_compras_documentos;
CREATE POLICY "Permitir todas operacoes authenticated contratos_api_compras_documentos"
  ON public.contratos_api_compras_documentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
