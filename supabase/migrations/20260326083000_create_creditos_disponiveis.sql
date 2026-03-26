-- Migração para Criar a Tabela de Créditos Disponíveis
CREATE TABLE IF NOT EXISTS public.creditos_disponiveis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ptres TEXT UNIQUE NOT NULL,
    metrica TEXT,
    valor NUMERIC NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.creditos_disponiveis ENABLE ROW LEVEL SECURITY;

-- Política de leitura para todos os usuários autenticados
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir leitura para todos' AND tablename = 'creditos_disponiveis') THEN
        CREATE POLICY "Permitir leitura para todos" ON public.creditos_disponiveis FOR SELECT USING (true);
    END IF;
END $$;

-- Política de inserção/atualização para todos (simplificado para este projeto)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir tudo para todos' AND tablename = 'creditos_disponiveis') THEN
        CREATE POLICY "Permitir tudo para todos" ON public.creditos_disponiveis FOR ALL USING (true);
    END IF;
END $$;
