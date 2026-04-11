ALTER TABLE atividades
ADD COLUMN IF NOT EXISTS tipo_atividade TEXT;

UPDATE atividades
SET tipo_atividade = CASE
  WHEN upper(trim(split_part(COALESCE(dimensao, ''), ' - ', 1))) = 'EN' THEN 'sistemico'
  ELSE 'campus'
END
WHERE tipo_atividade IS NULL;

ALTER TABLE atividades
ALTER COLUMN tipo_atividade SET DEFAULT 'campus';

ALTER TABLE atividades
ALTER COLUMN tipo_atividade SET NOT NULL;

ALTER TABLE atividades
DROP CONSTRAINT IF EXISTS atividades_tipo_atividade_check;

ALTER TABLE atividades
ADD CONSTRAINT atividades_tipo_atividade_check
CHECK (tipo_atividade IN ('campus', 'sistemico', 'emendas-parlamentares'));
