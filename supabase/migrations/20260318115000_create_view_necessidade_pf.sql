-- =============================================
-- Migration: 20260318115000_create_view_necessidade_pf.sql
-- Description: View para controle de necessidade de novas solicitações de PF.
-- =============================================

CREATE OR REPLACE VIEW vw_controle_pfs_pendentes AS
WITH base_pfs AS (
  -- Total de PFs solicitadas por fonte (normalizada)
  SELECT 
    LEFT(fonte_recurso, 4) as fonte_base,
    SUM(valor) as total_solicitado,
    COUNT(*) as qtd_pfs
  FROM pf_solicitacao
  GROUP BY 1
),
base_docs AS (
  -- Agrupamento de documentos pagos e pendentes por fonte
  SELECT 
    LEFT(fonte_sof, 4) as fonte_base,
    fonte_sof as fonte_original,
    SUM(valor_pago) as total_pago,
    SUM(CASE WHEN valor_liquidado > valor_pago THEN valor_liquidado - valor_pago ELSE 0 END) as total_a_pagar,
    COUNT(CASE WHEN valor_liquidado > valor_pago THEN 1 END) as qtd_docs_pendentes
  FROM documentos_habeis
  GROUP BY 1, 2
),
agregado AS (
  SELECT 
    d.fonte_base,
    d.fonte_original,
    COALESCE(p.total_solicitado, 0) as total_solicitado,
    d.total_pago,
    d.total_a_pagar,
    d.qtd_docs_pendentes,
    (COALESCE(p.total_solicitado, 0) - d.total_pago) as saldo_pf_disponivel
  FROM base_docs d
  LEFT JOIN base_pfs p ON d.fonte_base = p.fonte_base
)
SELECT 
  fonte_original as fonte,
  total_solicitado,
  total_pago,
  total_a_pagar,
  saldo_pf_disponivel,
  qtd_docs_pendentes,
  GREATEST(0, total_a_pagar - saldo_pf_disponivel) as necessidade_pf,
  CASE 
    WHEN total_a_pagar = 0 THEN 'REGULAR'
    WHEN saldo_pf_disponivel >= total_a_pagar - 0.01 THEN 'SUFICIENTE'
    ELSE 'NECESSITA_PF'
  END as status_analise
FROM agregado;
