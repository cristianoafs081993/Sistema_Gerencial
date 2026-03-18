ALTER TABLE transparencia_documentos
ADD COLUMN IF NOT EXISTS "valorLiquidado" NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "valorRestoPago" NUMERIC(15, 2) DEFAULT 0;

COMMENT ON COLUMN transparencia_documentos."valorLiquidado" IS 'Valor liquidado associado ao documento';
COMMENT ON COLUMN transparencia_documentos."valorRestoPago" IS 'Valor de restos a pagar pago associado ao documento';
