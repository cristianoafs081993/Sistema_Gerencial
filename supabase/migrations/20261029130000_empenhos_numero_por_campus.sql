-- A NE é identificada por UG emitente + número (ex.: 158366 + 2026NE000001), e o número resumido
-- se repete entre as UGs do IFRN. A unicidade global de empenhos.numero impedia gravar as NEs de
-- cada campus no seu próprio campus_uasg: a UG que importasse por último sobrescrevia as demais.

DO $$
DECLARE
  numero_attnum smallint;
  item record;
BEGIN
  SELECT attnum INTO numero_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.empenhos'::regclass AND attname = 'numero' AND NOT attisdropped;

  -- FKs de outras tabelas que dependem da unicidade global de empenhos.numero
  -- (hoje: documentos_habeis.fk_doc_habil_empenho, ON DELETE SET NULL).
  FOR item IN
    SELECT conrelid::regclass AS tabela, conname
    FROM pg_constraint
    WHERE contype = 'f'
      AND confrelid = 'public.empenhos'::regclass
      AND confkey = ARRAY[numero_attnum]
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', item.tabela, item.conname);
  END LOOP;

  FOR item IN
    SELECT conname
    FROM pg_constraint
    WHERE contype IN ('u', 'p')
      AND conrelid = 'public.empenhos'::regclass
      AND conkey = ARRAY[numero_attnum]
  LOOP
    EXECUTE format('ALTER TABLE public.empenhos DROP CONSTRAINT %I', item.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS empenhos_campus_numero_key
  ON public.empenhos (campus_uasg, numero);

COMMENT ON INDEX public.empenhos_campus_numero_key IS
  'NE única por campus (UG emitente). O número resumido (AAAANE000000) se repete entre UGs.';
