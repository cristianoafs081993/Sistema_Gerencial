-- =============================================
-- Migration: 20260318103000_create_view_conciliacao.sql
-- Description: Criação da view para cruzamento entre Documentos Hábeis e Solicitações de PF.
-- =============================================

CREATE OR REPLACE VIEW vw_conciliacao_documento_pf AS
WITH pf_resumo AS (
  -- Agrupamos as PFs por fonte e valor para facilitar o cruzamento
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
  d.fonte_sof = pr.fonte_recurso AND 
  ABS(d.valor_pago - pr.valor) < 0.01; -- Usando margem para evitar problemas de ponto flutuante
