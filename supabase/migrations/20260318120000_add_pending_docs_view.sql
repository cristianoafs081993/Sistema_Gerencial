-- =============================================
-- Migration: 20260318120000_add_pending_docs_view.sql
-- Description: View para listar documentos com liquidação em aberto (liquidado > pago).
-- =============================================

CREATE OR REPLACE VIEW vw_documentos_pendentes_pagamento AS
SELECT 
  *,
  (valor_liquidado - valor_pago) as valor_pendente
FROM documentos_habeis
WHERE valor_liquidado > valor_pago;
