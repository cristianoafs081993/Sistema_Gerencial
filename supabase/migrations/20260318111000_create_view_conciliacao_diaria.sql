-- =============================================
-- Migration: 20260318111000_create_view_conciliacao_diaria.sql
-- Description: View agregada por dia e fonte para conciliação global.
-- =============================================

CREATE OR REPLACE VIEW vw_conciliacao_diaria_pf AS
WITH doc_diario AS (
  SELECT 
    data_emissao,
    fonte_sof,
    SUM(valor_pago) as total_documentos,
    COUNT(*) as qtd_documentos
  FROM documentos_habeis
  WHERE valor_pago > 0
  GROUP BY data_emissao, fonte_sof
),
pf_diaria AS (
  SELECT 
    data_emissao,
    -- Normalização da fonte para comparação flexível (mantém apenas o prefixo numérico significativo)
    CASE 
      WHEN fonte_recurso ~ '^[0-9]+$' THEN LEFT(fonte_recurso, 4) -- Assume que os primeiros 4 dígitos são a fonte base
      ELSE LEFT(fonte_recurso, 4)
    END as fonte_normalizada,
    fonte_recurso, -- mantém a original para exibição
    SUM(valor) as total_pfs,
    COUNT(*) as qtd_pfs,
    array_agg(numero_pf) as pfs
  FROM pf_solicitacao
  GROUP BY data_emissao, fonte_normalizada, fonte_recurso
),
pf_agregada_dia_fonte AS (
  -- Agrupamos as PFs normalizadas por dia para bater com o documento
  SELECT 
    data_emissao,
    fonte_normalizada,
    SUM(total_pfs) as total_pfs,
    SUM(qtd_pfs) as qtd_pfs,
    array_agg(pfs) as todas_pfs
  FROM pf_diaria
  GROUP BY data_emissao, fonte_normalizada
)
SELECT 
  d.data_emissao,
  d.fonte_sof,
  d.total_documentos,
  d.qtd_documentos,
  COALESCE(p.total_pfs, 0) as total_pfs,
  COALESCE(p.qtd_pfs, 0) as qtd_pfs,
  COALESCE(p.todas_pfs, ARRAY[]::text[]) as pfs_relacionadas,
  (COALESCE(p.total_pfs, 0) - d.total_documentos) as saldo,
  CASE 
    WHEN COALESCE(p.total_pfs, 0) >= d.total_documentos - 0.01 THEN 'CONCILIADO'
    WHEN COALESCE(p.total_pfs, 0) > 0 THEN 'INSUFICIENTE'
    ELSE 'PENDENTE'
  END as status_conciliacao
FROM doc_diario d
LEFT JOIN pf_agregada_dia_fonte p ON 
  d.data_emissao = p.data_emissao AND 
  (d.fonte_sof = p.fonte_normalizada OR LEFT(d.fonte_sof, 4) = p.fonte_normalizada);
