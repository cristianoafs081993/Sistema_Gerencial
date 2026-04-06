-- Normaliza labels legados de componentes funcionais e atividades de Ensino.
-- Objetivo:
-- 1. remover prefixos numericos de componentes funcionais
-- 2. limpar prefixos "NN - COMPONENTE FUNCIONAL (PROEN):" em atividades de Ensino
-- 3. manter somente o nome final da atividade quando o valor de Ensino vier como "Componente - Atividade"

-- 1. Componentes funcionais de dominio
UPDATE componentes_funcionais
SET nome = btrim(regexp_replace(nome, '^\s*\d+\s*-\s*', ''))
WHERE nome IS NOT NULL
  AND nome ~ '^\s*\d+\s*-\s*';

-- 2. Texto redundante em atividades e empenhos
UPDATE atividades
SET componente_funcional = btrim(regexp_replace(componente_funcional, '^\s*\d+\s*-\s*', ''))
WHERE componente_funcional IS NOT NULL
  AND componente_funcional ~ '^\s*\d+\s*-\s*';

UPDATE empenhos
SET componente_funcional = btrim(regexp_replace(componente_funcional, '^\s*\d+\s*-\s*', ''))
WHERE componente_funcional IS NOT NULL
  AND componente_funcional ~ '^\s*\d+\s*-\s*';

-- 3. Atividades da dimensao Ensino
UPDATE atividades
SET atividade = btrim(
  regexp_replace(
    regexp_replace(atividade, '^\s*\d+\s*-\s*COMPONENTE FUNCIONAL\s*\(\s*PROEN\s*\)\s*:\s*', '', 'i'),
    '^.*\s-\s',
    ''
  )
)
WHERE atividade IS NOT NULL
  AND (
    upper(coalesce(dimensao, '')) = 'EN'
    OR upper(coalesce(dimensao, '')) LIKE 'EN -%'
  )
  AND (
    atividade ~* '^\s*\d+\s*-\s*COMPONENTE FUNCIONAL\s*\(\s*PROEN\s*\)\s*:'
    OR atividade ~ '\s-\s'
  );

-- 4. Reata o componente funcional quando o texto ja estiver normalizado, mas o *_id estiver nulo
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
