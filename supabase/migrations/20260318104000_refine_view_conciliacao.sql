-- =============================================
-- Migration: 20260318104000_refine_view_conciliacao.sql
-- Description: Refinamento da view de conciliação para tratar formatos de fonte diferentes.
-- =============================================

CREATE OR REPLACE VIEW vw_conciliacao_documento_pf AS
WITH pf_resumo AS (
  SELECT 
    fonte_recurso,
    valor,
    array_agg(numero_pf) as pfs,
    count(*) as qtd
  FROM pf_solicitacao
  GROUP BY fonte_recurso, valor
)
SELECT 
  d.id as documento_id,
  d.id as documento_numero,
  d.data_emissao,
  d.favorecido_nome,
  d.valor_pago,
  d.fonte_sof,
  pr.pfs as pfs_relacionadas,
  CASE 
    WHEN pr.pfs IS NOT NULL THEN 'CONCILIADO'
    ELSE 'PENDENTE_PF'
  END as status_conciliacao
FROM documentos_habeis d
LEFT JOIN pf_resumo pr ON 
  -- Comparação flexível para fontes (ex: 1000 vs 1000000000)
  (d.fonte_sof = pr.fonte_recurso OR 
   d.fonte_sof = LEFT(pr.fonte_recurso, LENGTH(d.fonte_sof)) OR
   LEFT(d.fonte_sof, LENGTH(pr.fonte_recurso)) = pr.fonte_recurso) AND 
  ABS(d.valor_pago - pr.valor) < 0.01
WHERE d.valor_pago > 0;
