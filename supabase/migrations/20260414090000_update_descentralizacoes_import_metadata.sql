ALTER TABLE public.descentralizacoes
  ADD COLUMN IF NOT EXISTS natureza_despesa TEXT,
  ADD COLUMN IF NOT EXISTS data_emissao DATE,
  ADD COLUMN IF NOT EXISTS descricao TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS nota_credito TEXT,
  ADD COLUMN IF NOT EXISTS operacao_tipo TEXT;

CREATE INDEX IF NOT EXISTS idx_descentralizacoes_nota_credito
  ON public.descentralizacoes (nota_credito)
  WHERE nota_credito IS NOT NULL;

WITH legacy_duplicates AS (
  SELECT legacy.id
  FROM public.descentralizacoes legacy
  WHERE legacy.nota_credito IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.descentralizacoes enriched
      WHERE enriched.id <> legacy.id
        AND enriched.nota_credito IS NOT NULL
        AND enriched.data_emissao IS NOT DISTINCT FROM legacy.data_emissao
        AND upper(btrim(coalesce(enriched.plano_interno, ''))) = upper(btrim(coalesce(legacy.plano_interno, '')))
        AND btrim(coalesce(enriched.origem_recurso, '')) = btrim(coalesce(legacy.origem_recurso, ''))
        AND btrim(coalesce(enriched.natureza_despesa, '')) = btrim(coalesce(legacy.natureza_despesa, ''))
        AND enriched.valor = legacy.valor
    )
)
DELETE FROM public.descentralizacoes d
USING legacy_duplicates duplicate
WHERE d.id = duplicate.id;

CREATE UNIQUE INDEX IF NOT EXISTS ux_descentralizacoes_import_with_nc
  ON public.descentralizacoes (
    data_emissao,
    upper(btrim(coalesce(plano_interno, ''))),
    btrim(coalesce(origem_recurso, '')),
    btrim(coalesce(natureza_despesa, '')),
    valor,
    btrim(nota_credito)
  )
  WHERE nota_credito IS NOT NULL;
