-- Migration: Criação das tabelas de Portaria e Eventos para controle de acesso no campus
-- Data: 2026-09-10

CREATE TABLE IF NOT EXISTS public.portaria_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.orgs(id) ON DELETE SET NULL,
  campus_uasg TEXT NOT NULL DEFAULT '158366',
  titulo TEXT NOT NULL,
  descricao TEXT,
  local TEXT NOT NULL,
  ambiente_id UUID REFERENCES public.manutencao_ambientes(id) ON DELETE SET NULL,
  data_inicio TIMESTAMPTZ NOT NULL,
  data_fim TIMESTAMPTZ,
  responsavel_nome TEXT,
  responsavel_contato TEXT,
  tipo TEXT NOT NULL DEFAULT 'academico',
  status TEXT NOT NULL DEFAULT 'confirmado',
  observacoes_portaria TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.portaria_evento_participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id UUID NOT NULL REFERENCES public.portaria_eventos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  documento TEXT,
  instituicao TEXT,
  tipo TEXT NOT NULL DEFAULT 'participante',
  presente BOOLEAN NOT NULL DEFAULT false,
  horario_entrada TIMESTAMPTZ,
  veiculo_placa TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_portaria_eventos_campus_data ON public.portaria_eventos(campus_uasg, data_inicio);
CREATE INDEX IF NOT EXISTS idx_portaria_eventos_status ON public.portaria_eventos(status);
CREATE INDEX IF NOT EXISTS idx_portaria_participantes_evento ON public.portaria_evento_participantes(evento_id);
CREATE INDEX IF NOT EXISTS idx_portaria_participantes_presente ON public.portaria_evento_participantes(evento_id, presente);
CREATE INDEX IF NOT EXISTS idx_portaria_participantes_nome ON public.portaria_evento_participantes(nome);

-- RLS (Row Level Security)
ALTER TABLE public.portaria_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portaria_evento_participantes ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT ALL ON public.portaria_eventos TO authenticated;
GRANT ALL ON public.portaria_evento_participantes TO authenticated;
GRANT SELECT ON public.portaria_eventos TO anon;
GRANT SELECT, UPDATE ON public.portaria_evento_participantes TO anon;

-- Policies para portaria_eventos
DROP POLICY IF EXISTS "portaria_eventos_auth_all" ON public.portaria_eventos;
CREATE POLICY "portaria_eventos_auth_all" ON public.portaria_eventos
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "portaria_eventos_anon_select" ON public.portaria_eventos;
CREATE POLICY "portaria_eventos_anon_select" ON public.portaria_eventos
  FOR SELECT TO anon
  USING (true);

-- Policies para portaria_evento_participantes
DROP POLICY IF EXISTS "portaria_participantes_auth_all" ON public.portaria_evento_participantes;
CREATE POLICY "portaria_participantes_auth_all" ON public.portaria_evento_participantes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "portaria_participantes_anon_select" ON public.portaria_evento_participantes;
CREATE POLICY "portaria_participantes_anon_select" ON public.portaria_evento_participantes
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "portaria_participantes_anon_update" ON public.portaria_evento_participantes;
CREATE POLICY "portaria_participantes_anon_update" ON public.portaria_evento_participantes
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- Carga inicial (Seed) de eventos e participantes para demonstração imediata
DO $$
DECLARE
  v_org_id UUID;
  v_evento_id1 UUID := 'c1111111-1111-4111-8111-111111111111'::UUID;
  v_evento_id2 UUID := 'c2222222-2222-4222-8222-222222222222'::UUID;
  v_evento_id3 UUID := 'c3333333-3333-4333-8333-333333333333'::UUID;
  v_today_start TIMESTAMPTZ := date_trunc('day', now()) + INTERVAL '8 hours';
  v_today_afternoon TIMESTAMPTZ := date_trunc('day', now()) + INTERVAL '14 hours';
  v_tomorrow_morning TIMESTAMPTZ := date_trunc('day', now()) + INTERVAL '1 day 9 hours';
BEGIN
  SELECT id INTO v_org_id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1;
  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id FROM public.orgs LIMIT 1;
  END IF;

  -- Evento 1 (Hoje de Manhã - Auditório)
  INSERT INTO public.portaria_eventos (
    id, org_id, campus_uasg, titulo, descricao, local,
    data_inicio, data_fim, responsavel_nome, responsavel_contato,
    tipo, status, observacoes_portaria
  ) VALUES (
    v_evento_id1, v_org_id, '158366',
    'Semana de Tecnologia e Ciência - Abertura Oficial',
    'Cerimônia de abertura da Semana de Ciência e Tecnologia com presença de convidados externos e reitoria.',
    'Auditório Principal',
    v_today_start, v_today_start + INTERVAL '4 hours',
    'Prof. Carlos Eduardo Andrade', '(84) 99822-1020',
    'academico', 'em_andamento',
    'Liberar entrada prioritária de veículos de palestrantes e autoridades no Estacionamento A.'
  ) ON CONFLICT (id) DO NOTHING;

  -- Participantes do Evento 1
  INSERT INTO public.portaria_evento_participantes (
    evento_id, nome, documento, instituicao, tipo, presente, horario_entrada, veiculo_placa, observacao
  ) VALUES
    (v_evento_id1, 'Dra. Mariana Vasconcelos', '3.123.456', 'UFRN', 'palestrante', true, v_today_start - INTERVAL '20 minutes', 'ABC-1D23', 'Palestrante magna - Sala VIP reservada'),
    (v_evento_id1, 'Prof. Roberto Silveira', '2.845.912', 'IFRN Campus Natal', 'palestrante', true, v_today_start - INTERVAL '15 minutes', 'XYZ-9E87', 'Palestrante mesa redonda'),
    (v_evento_id1, 'Carla Cristina Fonseca', '054.123.894-00', 'Comunidade Externa', 'participante', true, v_today_start - INTERVAL '5 minutes', NULL, 'Inscrição confirmada'),
    (v_evento_id1, 'Lucas Gabriel Medeiros', '089.443.211-12', 'IFRN Currais Novos', 'participante', false, NULL, 'MNO-3321', 'Aluno bolsista'),
    (v_evento_id1, 'Ana Beatriz Dantas', '077.332.119-45', 'UFRN Seridó', 'participante', false, NULL, NULL, 'Participante ouvinte'),
    (v_evento_id1, 'Felipe Augusto Bezerra', '062.991.432-88', 'Empresa TechSeridó', 'convidado', true, v_today_start + INTERVAL '10 minutes', 'KJH-4B56', 'Expositor da feira de tecnologia')
  ON CONFLICT DO NOTHING;

  -- Evento 2 (Hoje à Tarde - Miniauditório)
  INSERT INTO public.portaria_eventos (
    id, org_id, campus_uasg, titulo, descricao, local,
    data_inicio, data_fim, responsavel_nome, responsavel_contato,
    tipo, status, observacoes_portaria
  ) VALUES (
    v_evento_id2, v_org_id, '158366',
    'Reunião do Conselho Comunitário e Direção-Geral',
    'Encontro bimestral com representantes da comunidade civil e direção do campus.',
    'Miniauditório do Bloco Administrativo',
    v_today_afternoon, v_today_afternoon + INTERVAL '3 hours',
    'Diretor Administrativo Silva', '(84) 98711-5544',
    'reuniao', 'confirmado',
    'Conferir documento na recepção. Convidar para assinar o livro de atas na portaria.'
  ) ON CONFLICT (id) DO NOTHING;

  -- Participantes do Evento 2
  INSERT INTO public.portaria_evento_participantes (
    evento_id, nome, documento, instituicao, tipo, presente, horario_entrada, veiculo_placa, observacao
  ) VALUES
    (v_evento_id2, 'Sebastião Alves de Lima', '1.456.789', 'Associação de Moradores', 'convidado', false, NULL, 'KLR-9012', 'Presidente da associação'),
    (v_evento_id2, 'Tereza Cristina Neves', '2.114.652', 'CDL Currais Novos', 'convidado', false, NULL, 'NOH-5412', 'Representante do comércio local'),
    (v_evento_id2, 'Marcos Vinicius Barros', '045.876.123-99', 'Prefeitura Municipal', 'autoridade', false, NULL, 'OFG-8A90', 'Secretário municipal de educação')
  ON CONFLICT DO NOTHING;

  -- Evento 3 (Amanhã de Manhã - Ginásio)
  INSERT INTO public.portaria_eventos (
    id, org_id, campus_uasg, titulo, descricao, local,
    data_inicio, data_fim, responsavel_nome, responsavel_contato,
    tipo, status, observacoes_portaria
  ) VALUES (
    v_evento_id3, v_org_id, '158366',
    'Torneio Integração Esportiva Intercampi',
    'Jogos amistosos de futsal e voleibol com delegações dos campi Parelhas e Jucurutu.',
    'Ginásio Poliesportivo',
    v_tomorrow_morning, v_tomorrow_morning + INTERVAL '5 hours',
    'Prof. Almir Rogério (Ed. Física)', '(84) 99123-4567',
    'esportivo', 'confirmado',
    'Ônibus e vans das delegações autorizados a estacionar no pátio dos fundos.'
  ) ON CONFLICT (id) DO NOTHING;

  -- Participantes do Evento 3
  INSERT INTO public.portaria_evento_participantes (
    evento_id, nome, documento, instituicao, tipo, presente, horario_entrada, veiculo_placa, observacao
  ) VALUES
    (v_evento_id3, 'Delegação Campus Parelhas (25 atletas)', 'OFÍCIO-2026/04', 'IFRN Campus Parelhas', 'participante', false, NULL, 'BUS-1920', 'Ônibus oficial institucional'),
    (v_evento_id3, 'Delegação Campus Jucurutu (22 atletas)', 'OFÍCIO-2026/07', 'IFRN Campus Jucurutu', 'participante', false, NULL, 'VAN-4488', 'Van institucional')
  ON CONFLICT DO NOTHING;

END $$;
