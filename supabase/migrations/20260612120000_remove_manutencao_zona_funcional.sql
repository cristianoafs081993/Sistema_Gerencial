-- Remove the obsolete functional-zone grouping from the maintenance module.
ALTER TABLE manutencao_ambientes
  DROP COLUMN IF EXISTS zona;

ALTER TABLE manutencao_blocos_mapa
  DROP COLUMN IF EXISTS zona;
