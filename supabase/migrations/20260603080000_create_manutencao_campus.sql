-- Migration to create Campus Cleaning and Maintenance module tables
CREATE TABLE IF NOT EXISTS manutencao_ambientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  bloco TEXT,
  tipo TEXT CHECK (tipo IN ('sala', 'banheiro', 'laboratorio', 'corredor', 'outros')) DEFAULT 'sala',
  status TEXT CHECK (status IN ('ativo', 'inativo')) DEFAULT 'ativo',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS manutencao_ocorrencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambiente_id UUID REFERENCES manutencao_ambientes(id) ON DELETE CASCADE NOT NULL,
  respondente_tipo TEXT DEFAULT 'anonimo',
  avaliacao INTEGER CHECK (avaliacao >= 1 AND avaliacao <= 5) NOT NULL,
  problemas TEXT[] DEFAULT '{}'::text[],
  observacao TEXT,
  status TEXT CHECK (status IN ('pendente', 'em_andamento', 'resolvido', 'arquivado')) DEFAULT 'pendente',
  resolvido_em TIMESTAMPTZ,
  resolvido_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS manutencao_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambiente_id UUID REFERENCES manutencao_ambientes(id) ON DELETE CASCADE NOT NULL,
  responsavel_nome TEXT NOT NULL,
  acao_realizada TEXT CHECK (acao_realizada IN ('limpeza_padrao', 'reposicao_insumos', 'inspecao', 'manutencao_corretiva')) DEFAULT 'limpeza_padrao',
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index creation
CREATE INDEX IF NOT EXISTS idx_manutencao_ambientes_codigo ON manutencao_ambientes(codigo);
CREATE INDEX IF NOT EXISTS idx_manutencao_ocorrencias_ambiente_id ON manutencao_ocorrencias(ambiente_id);
CREATE INDEX IF NOT EXISTS idx_manutencao_ocorrencias_status ON manutencao_ocorrencias(status);
CREATE INDEX IF NOT EXISTS idx_manutencao_checkins_ambiente_id ON manutencao_checkins(ambiente_id);

-- Triggers for updated_at
CREATE TRIGGER trg_update_manutencao_ambientes_updated_at
BEFORE UPDATE ON manutencao_ambientes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_manutencao_ocorrencias_updated_at
BEFORE UPDATE ON manutencao_ocorrencias
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- RLS setup
ALTER TABLE manutencao_ambientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE manutencao_ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE manutencao_checkins ENABLE ROW LEVEL SECURITY;

-- Policies for manutencao_ambientes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura publica em manutencao_ambientes') THEN
    CREATE POLICY "Permitir leitura publica em manutencao_ambientes"
    ON manutencao_ambientes FOR SELECT
    TO public
    USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir todas operacoes authenticated manutencao_ambientes') THEN
    CREATE POLICY "Permitir todas operacoes authenticated manutencao_ambientes"
    ON manutencao_ambientes FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Policies for manutencao_ocorrencias
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir insercao anonima em manutencao_ocorrencias') THEN
    CREATE POLICY "Permitir insercao anonima em manutencao_ocorrencias"
    ON manutencao_ocorrencias FOR INSERT
    TO public
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir todas operacoes authenticated manutencao_ocorrencias') THEN
    CREATE POLICY "Permitir todas operacoes authenticated manutencao_ocorrencias"
    ON manutencao_ocorrencias FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Policies for manutencao_checkins
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir insercao anonima em manutencao_checkins') THEN
    CREATE POLICY "Permitir insercao anonima em manutencao_checkins"
    ON manutencao_checkins FOR INSERT
    TO public
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura authenticated em manutencao_checkins') THEN
    CREATE POLICY "Permitir leitura authenticated em manutencao_checkins"
    ON manutencao_checkins FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;

-- Seed some standard environment data
INSERT INTO manutencao_ambientes (codigo, nome, bloco, tipo) VALUES
('SALA-101', 'Sala de Aula 101', 'Bloco A', 'sala'),
('SALA-102', 'Sala de Aula 102', 'Bloco A', 'sala'),
('LAB-INFO-1', 'Laboratório de Informática 1', 'Bloco B', 'laboratorio'),
('BANHEIRO-MASC-A', 'Banheiro Masculino Bloco A', 'Bloco A', 'banheiro'),
('BANHEIRO-FEM-A', 'Banheiro Feminino Bloco A', 'Bloco A', 'banheiro'),
('CORREDOR-CENTRAL', 'Corredor Central', 'Bloco Principal', 'corredor')
ON CONFLICT (codigo) DO NOTHING;
