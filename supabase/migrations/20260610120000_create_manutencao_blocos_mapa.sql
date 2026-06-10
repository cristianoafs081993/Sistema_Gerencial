-- Migration to create table for campus map blocks geometry and settings
CREATE TABLE IF NOT EXISTS manutencao_blocos_mapa (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  zona TEXT CHECK (zona IN ('academico', 'administrativo', 'esportivo', 'servicos', 'convivencia', 'apoio_tecnico')) NOT NULL,
  badge_x INTEGER NOT NULL,
  badge_y INTEGER NOT NULL,
  geometria_tipo TEXT CHECK (geometria_tipo IN ('rect', 'circle', 'polygon', 'path')) NOT NULL,
  geometria_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS setup
ALTER TABLE manutencao_blocos_mapa ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura publica em manutencao_blocos_mapa') THEN
    CREATE POLICY "Permitir leitura publica em manutencao_blocos_mapa"
    ON manutencao_blocos_mapa FOR SELECT
    TO public
    USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir todas operacoes authenticated manutencao_blocos_mapa') THEN
    CREATE POLICY "Permitir todas operacoes authenticated manutencao_blocos_mapa"
    ON manutencao_blocos_mapa FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Seed initial default blocks
INSERT INTO manutencao_blocos_mapa (id, nome, zona, badge_x, badge_y, geometria_tipo, geometria_data) VALUES
('lab_energias', 'Laboratório de Energias Renováveis e Hidroponia', 'academico', 331, 122, 'rect', '{"x": 257, "y": 85, "width": 148, "height": 75, "rx": 5}'),
('ginasio', 'Ginásio Poliesportivo', 'esportivo', 417, 316, 'rect', '{"x": 303, "y": 247, "width": 217, "height": 137, "rx": 6}'),
('bloco_central', 'Bloco Acadêmico Central', 'academico', 611, 191, 'rect', '{"x": 554, "y": 147, "width": 114, "height": 87, "rx": 5}'),
('bloco_salas', 'Bloco de Sala de Aula', 'academico', 611, 384, 'rect', '{"x": 554, "y": 309, "width": 114, "height": 150, "rx": 5}'),
('passarela', 'Área de Convivência e Passarelas', 'convivencia', 510, 300, 'rect', '{"x": 502, "y": 147, "width": 34, "height": 312, "rx": 4}'),
('administracao', 'Administração', 'administrativo', 753, 378, 'rect', '{"x": 691, "y": 347, "width": 126, "height": 62, "rx": 5}'),
('biblioteca', 'Biblioteca', 'administrativo', 862, 365, 'rect', '{"x": 828, "y": 210, "width": 68, "height": 312, "rx": 5}'),
('complexo_aquatico', 'Complexo Aquático / Piscina', 'servicos', 753, 256, 'rect', '{"x": 702, "y": 210, "width": 103, "height": 94, "rx": 5}'),
('auditorio', 'Auditório', 'convivencia', 611, 529, 'path', '{"d": "M 512 503 H 656 A 72 72 0 0 1 512 503"}'),
('torre_agua', 'Torre de Água Principal', 'apoio_tecnico', 519, 297, 'circle', '{"cx": 519, "cy": 297, "r": 16}'),
('torre_comunicacao', 'Torre de Observação / Comunicação', 'apoio_tecnico', 793, 135, 'circle', '{"cx": 793, "cy": 135, "r": 18}')
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  zona = EXCLUDED.zona,
  badge_x = EXCLUDED.badge_x,
  badge_y = EXCLUDED.badge_y,
  geometria_tipo = EXCLUDED.geometria_tipo,
  geometria_data = EXCLUDED.geometria_data;
