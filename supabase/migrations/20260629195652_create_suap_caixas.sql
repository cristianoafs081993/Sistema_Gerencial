-- Migration para criar a tabela de cadastro de caixas de processos do SUAP
CREATE TABLE IF NOT EXISTS public.suap_caixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  nome text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Garantir que as novas colunas existam mesmo se a tabela já existia antes
ALTER TABLE public.suap_caixas ADD COLUMN IF NOT EXISTS sync_automatica boolean NOT NULL DEFAULT true;
ALTER TABLE public.suap_caixas ADD COLUMN IF NOT EXISTS last_sync_at timestamptz NULL;

-- Ativar RLS
ALTER TABLE public.suap_caixas ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Users can manage their own SUAP boxes" ON public.suap_caixas;
CREATE POLICY "Users can manage their own SUAP boxes"
  ON public.suap_caixas
  FOR ALL
  TO authenticated
  USING (auth.uid() = tenant_id)
  WITH CHECK (auth.uid() = tenant_id);
