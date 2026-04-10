-- Remove prefixos legados "COMPONENTE FUNCIONAL (PROEN):" ainda presentes em labels persistidos.

UPDATE componentes_funcionais
SET nome = btrim(
  regexp_replace(nome, '^\s*(?:\d+\s*-\s*)?COMPONENTE FUNCIONAL\s*\(\s*PROEN\s*\)\s*:\s*', '', 'i')
)
WHERE nome IS NOT NULL
  AND nome ~* '^\s*(?:\d+\s*-\s*)?COMPONENTE FUNCIONAL\s*\(\s*PROEN\s*\)\s*:';

UPDATE atividades
SET componente_funcional = btrim(
  regexp_replace(componente_funcional, '^\s*(?:\d+\s*-\s*)?COMPONENTE FUNCIONAL\s*\(\s*PROEN\s*\)\s*:\s*', '', 'i')
)
WHERE componente_funcional IS NOT NULL
  AND componente_funcional ~* '^\s*(?:\d+\s*-\s*)?COMPONENTE FUNCIONAL\s*\(\s*PROEN\s*\)\s*:';

UPDATE empenhos
SET componente_funcional = btrim(
  regexp_replace(componente_funcional, '^\s*(?:\d+\s*-\s*)?COMPONENTE FUNCIONAL\s*\(\s*PROEN\s*\)\s*:\s*', '', 'i')
)
WHERE componente_funcional IS NOT NULL
  AND componente_funcional ~* '^\s*(?:\d+\s*-\s*)?COMPONENTE FUNCIONAL\s*\(\s*PROEN\s*\)\s*:';

UPDATE atividades a
SET componente_funcional_id = cf.id
FROM componentes_funcionais cf
JOIN dimensoes d ON d.id = cf.dimensao_id
WHERE a.componente_funcional_id IS NULL
  AND a.componente_funcional = cf.nome
  AND (
    a.dimensao_id = d.id
    OR a.dimensao = d.nome
    OR a.dimensao LIKE d.codigo || ' -%'
  );

UPDATE empenhos e
SET componente_funcional_id = cf.id
FROM componentes_funcionais cf
JOIN dimensoes d ON d.id = cf.dimensao_id
WHERE e.componente_funcional_id IS NULL
  AND e.componente_funcional = cf.nome
  AND (
    e.dimensao_id = d.id
    OR e.dimensao = d.nome
    OR e.dimensao LIKE d.codigo || ' -%'
  );
