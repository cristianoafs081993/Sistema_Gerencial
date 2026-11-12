-- Listas de trabalho da LC montadas pela extensao SIAGES a partir de processos de bolsa do SUAP.
-- Cada processo tem no maximo uma lista por orgao; a extensao reaproveita a existente em vez de duplicar.

ALTER TABLE public.lc_saved_lists
  ADD COLUMN IF NOT EXISTS suap_id text
    CHECK (suap_id IS NULL OR suap_id ~ '^[0-9]{1,12}$'),
  ADD COLUMN IF NOT EXISTS process_number text
    CHECK (process_number IS NULL OR char_length(process_number) <= 64),
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual'
    CHECK (origin IN ('manual', 'extensao')),
  ADD COLUMN IF NOT EXISTS extraction jsonb
    CHECK (extraction IS NULL OR jsonb_typeof(extraction) = 'object');

CREATE UNIQUE INDEX IF NOT EXISTS lc_saved_lists_org_suap_id_key
  ON public.lc_saved_lists (org_id, suap_id)
  WHERE suap_id IS NOT NULL;

COMMENT ON COLUMN public.lc_saved_lists.suap_id IS
  'ID do processo SUAP de origem quando a lista foi montada pela extensao; unico por orgao.';
COMMENT ON COLUMN public.lc_saved_lists.process_number IS
  'Numero do processo SUAP de origem (NUP), apenas para exibicao.';
COMMENT ON COLUMN public.lc_saved_lists.origin IS
  'manual: salva na tela /lc; extensao: montada automaticamente pela extensao no SUAP.';
COMMENT ON COLUMN public.lc_saved_lists.extraction IS
  'Metadados da extracao automatica: metodo (script/ia), documentos lidos, total declarado/encontrado e avisos.';
