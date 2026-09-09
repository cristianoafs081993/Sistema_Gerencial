-- Validação somente leitura para executar no SQL Editor do Supabase.
-- Rode a seção PRÉ antes da migration 20260907150000 e a seção PÓS depois.

-- PRÉ: linha de base de Currais Novos (o schema ainda não possui campus_uasg).
SELECT 'atividades' AS tabela, count(*) AS linhas, coalesce(sum(valor_total), 0) AS total
FROM public.atividades
UNION ALL
SELECT 'empenhos', count(*), coalesce(sum(valor), 0) FROM public.empenhos
UNION ALL
SELECT 'descentralizacoes', count(*), coalesce(sum(valor), 0) FROM public.descentralizacoes
UNION ALL
SELECT 'contratos', count(*), coalesce(sum(valor), 0) FROM public.contratos;

-- PÓS: a migração deve deixar todos os legados em 158366, sem nulos.
SELECT table_name, campus_uasg, count(*) AS linhas
FROM (
  SELECT 'atividades' AS table_name, campus_uasg FROM public.atividades
  UNION ALL SELECT 'empenhos', campus_uasg FROM public.empenhos
  UNION ALL SELECT 'descentralizacoes', campus_uasg FROM public.descentralizacoes
  UNION ALL SELECT 'contratos', campus_uasg FROM public.contratos
) scoped
GROUP BY table_name, campus_uasg
ORDER BY table_name, campus_uasg;

SELECT table_name, count(*) AS nulos
FROM (
  SELECT 'atividades' AS table_name, campus_uasg FROM public.atividades
  UNION ALL SELECT 'empenhos', campus_uasg FROM public.empenhos
  UNION ALL SELECT 'descentralizacoes', campus_uasg FROM public.descentralizacoes
  UNION ALL SELECT 'contratos', campus_uasg FROM public.contratos
) scoped
WHERE campus_uasg IS NULL
GROUP BY table_name;

-- PÓS: as métricas de Currais Novos devem ser iguais à saída PRÉ.
SELECT 'atividades' AS tabela, count(*) AS linhas, coalesce(sum(valor_total), 0) AS total
FROM public.atividades WHERE campus_uasg = '158366'
UNION ALL
SELECT 'empenhos', count(*), coalesce(sum(valor), 0) FROM public.empenhos WHERE campus_uasg = '158366'
UNION ALL
SELECT 'descentralizacoes', count(*), coalesce(sum(valor), 0) FROM public.descentralizacoes WHERE campus_uasg = '158366'
UNION ALL
SELECT 'contratos', count(*), coalesce(sum(valor), 0) FROM public.contratos WHERE campus_uasg = '158366';

-- PÓS: amostra contratual preservada e escopo operacional por campus.
SELECT numero, objeto, valor_global, unidade_codigo, unidade_origem_codigo
FROM public.contratos_api
WHERE id IN (
  SELECT contrato_api_id
  FROM public.contratos_api_campus_scope
  WHERE campus_uasg = '158366'
)
ORDER BY numero
LIMIT 50;
