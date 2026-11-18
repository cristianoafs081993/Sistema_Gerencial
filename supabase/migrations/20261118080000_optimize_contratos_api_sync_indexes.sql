-- Otimiza a substituicao de filhos em sync-contratos-comprasnet (evitando statement_timeout 57014)
-- e encerra execucoes antigas presas em 'running'.

CREATE INDEX IF NOT EXISTS contratos_api_empenhos_contrato_idx
  ON public.contratos_api_empenhos (contrato_api_id);

CREATE INDEX IF NOT EXISTS contratos_api_faturas_contrato_idx
  ON public.contratos_api_faturas (contrato_api_id);

CREATE INDEX IF NOT EXISTS contratos_api_itens_contrato_idx
  ON public.contratos_api_itens (contrato_api_id);

CREATE INDEX IF NOT EXISTS contratos_api_historico_contrato_idx
  ON public.contratos_api_historico (contrato_api_id);

CREATE INDEX IF NOT EXISTS contratos_api_fatura_itens_fatura_idx
  ON public.contratos_api_fatura_itens (contrato_api_fatura_id);

CREATE INDEX IF NOT EXISTS contratos_api_fatura_itens_contrato_idx
  ON public.contratos_api_fatura_itens (contrato_api_id);

CREATE INDEX IF NOT EXISTS contratos_api_fatura_empenhos_fatura_idx
  ON public.contratos_api_fatura_empenhos (contrato_api_fatura_id);

CREATE INDEX IF NOT EXISTS contratos_api_fatura_empenhos_empenho_idx
  ON public.contratos_api_fatura_empenhos (contrato_api_empenho_id);

CREATE INDEX IF NOT EXISTS contratos_api_fatura_empenhos_contrato_idx
  ON public.contratos_api_fatura_empenhos (contrato_api_id);

UPDATE public.contratos_api_sync_runs
SET status = 'error',
    finished_at = COALESCE(finished_at, now()),
    error_message = COALESCE(error_message, 'Execucao interrompida por limite de tempo da Edge Function.')
WHERE status = 'running'
  AND started_at < now() - interval '15 minutes';
