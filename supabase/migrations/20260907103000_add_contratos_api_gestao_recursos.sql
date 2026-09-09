-- Recursos complementares da API Contratos.gov.br.
-- Tabela flexível para manter o payload original e os campos comuns usados pela interface.
CREATE TABLE IF NOT EXISTS public.contratos_api_recursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_api_id uuid NOT NULL REFERENCES public.contratos_api(id) ON DELETE CASCADE,
  tipo_recurso text NOT NULL CHECK (tipo_recurso IN (
    'cronograma', 'garantias', 'responsaveis', 'prepostos',
    'ocorrencias', 'despesas_acessorias', 'terceirizados'
  )),
  api_registro_id bigint NOT NULL,
  titulo text,
  descricao text,
  situacao text,
  data_inicio date,
  data_fim date,
  vencimento date,
  valor numeric(15,2),
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contrato_api_id, tipo_recurso, api_registro_id)
);

CREATE INDEX IF NOT EXISTS contratos_api_recursos_contrato_tipo_idx
  ON public.contratos_api_recursos (contrato_api_id, tipo_recurso);
CREATE INDEX IF NOT EXISTS contratos_api_recursos_vencimento_idx
  ON public.contratos_api_recursos (vencimento)
  WHERE vencimento IS NOT NULL;

CREATE TRIGGER trg_update_contratos_api_recursos_updated_at
BEFORE UPDATE ON public.contratos_api_recursos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.contratos_api_recursos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura anonima em contratos_api_recursos" ON public.contratos_api_recursos;
CREATE POLICY "Permitir leitura anonima em contratos_api_recursos"
  ON public.contratos_api_recursos FOR SELECT TO public
  USING (tipo_recurso <> 'terceirizados');

DROP POLICY IF EXISTS "Permitir todas operacoes authenticated contratos_api_recursos" ON public.contratos_api_recursos;
CREATE POLICY "Permitir todas operacoes authenticated contratos_api_recursos"
  ON public.contratos_api_recursos FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.contratos_api_faturas
  ADD COLUMN IF NOT EXISTS data_ateste date,
  ADD COLUMN IF NOT EXISTS data_protocolo date,
  ADD COLUMN IF NOT EXISTS processo text,
  ADD COLUMN IF NOT EXISTS chave_nfe text,
  ADD COLUMN IF NOT EXISTS justificativa text,
  ADD COLUMN IF NOT EXISTS informacao_complementar text,
  ADD COLUMN IF NOT EXISTS repactuacao text,
  ADD COLUMN IF NOT EXISTS juros numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS multa numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS glosa numeric(15,2) DEFAULT 0;

ALTER TABLE public.contratos_api_sync_runs
  ADD COLUMN IF NOT EXISTS arquivos_compras_upserted integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recursos_complementares_upserted integer DEFAULT 0;
