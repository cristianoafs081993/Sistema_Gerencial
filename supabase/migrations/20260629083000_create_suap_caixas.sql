-- Migration to create suap_caixas table
CREATE TABLE IF NOT EXISTS public.suap_caixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT suap_caixas_tenant_nome_unique UNIQUE (tenant_id, nome)
);

-- Enable RLS
ALTER TABLE public.suap_caixas ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can manage own suap_caixas" ON public.suap_caixas;

-- Create policy for all operations
CREATE POLICY "Users can manage own suap_caixas"
  ON public.suap_caixas
  FOR ALL
  TO authenticated
  USING (auth.uid() = tenant_id)
  WITH CHECK (auth.uid() = tenant_id);

-- Add comment explaining the table
COMMENT ON TABLE public.suap_caixas IS 'Caixas de processos do SUAP cadastradas pelo usuário (ex: Caixa de Entrada, Meus Processos, etc)';
