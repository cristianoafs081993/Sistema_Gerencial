-- Migration to add 'caixa' column to the 'processos' table
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS caixa text;

-- Add a comment explaining the column
COMMENT ON COLUMN public.processos.caixa IS 'Nome da caixa de processos de origem do SUAP (ex: Caixa de Entrada, Meus Processos, Como Interessado, Aguardando Recebimento)';
