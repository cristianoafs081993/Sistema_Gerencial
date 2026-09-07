-- A API de Contratos pode retornar quantidades acima do limite de dez dígitos
-- inteiros. Mantemos cinco casas decimais, mas ampliamos a parte inteira para
-- evitar que uma sincronização completa seja interrompida por um único item.
ALTER TABLE public.contratos_api_itens
  ALTER COLUMN quantidade TYPE numeric(20,5);

ALTER TABLE public.contratos_api_fatura_itens
  ALTER COLUMN quantidade_faturado TYPE numeric(20,5);
