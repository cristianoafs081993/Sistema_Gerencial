-- =============================================
-- Migration: 0006_domain_tables.sql
-- Hierarquia: Dimensão → Componente Funcional → Atividade → Empenho
-- =============================================

-- =============================================
-- 1. TABELAS DE DOMÍNIO
-- =============================================

-- 1.1 Dimensões
CREATE TABLE IF NOT EXISTS dimensoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.2 Componentes Funcionais (pertence a uma Dimensão)
CREATE TABLE IF NOT EXISTS componentes_funcionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dimensao_id UUID NOT NULL REFERENCES dimensoes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(dimensao_id, nome)
);

-- 1.3 Naturezas de Despesa
CREATE TABLE IF NOT EXISTS naturezas_despesa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.4 Origens de Recurso
CREATE TABLE IF NOT EXISTS origens_recurso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  descricao TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 2. FKs NAS TABELAS EXISTENTES
-- =============================================

-- 2.1 Atividades: pertence a um Componente Funcional (que pertence a uma Dimensão)
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS dimensao_id UUID REFERENCES dimensoes(id);
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS componente_funcional_id UUID REFERENCES componentes_funcionais(id);
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS natureza_despesa_id UUID REFERENCES naturezas_despesa(id);
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS origem_recurso_id UUID REFERENCES origens_recurso(id);

-- 2.2 Empenhos: pertence a uma Dimensão, Componente Funcional e (opcionalmente) Atividade
ALTER TABLE empenhos ADD COLUMN IF NOT EXISTS dimensao_id UUID REFERENCES dimensoes(id);
ALTER TABLE empenhos ADD COLUMN IF NOT EXISTS componente_funcional_id UUID REFERENCES componentes_funcionais(id);
ALTER TABLE empenhos ADD COLUMN IF NOT EXISTS natureza_despesa_id UUID REFERENCES naturezas_despesa(id);
ALTER TABLE empenhos ADD COLUMN IF NOT EXISTS origem_recurso_id UUID REFERENCES origens_recurso(id);

-- 2.3 Descentralizações
ALTER TABLE descentralizacoes ADD COLUMN IF NOT EXISTS dimensao_id UUID REFERENCES dimensoes(id);
ALTER TABLE descentralizacoes ADD COLUMN IF NOT EXISTS origem_recurso_id UUID REFERENCES origens_recurso(id);

-- =============================================
-- 3. SEED: DIMENSÕES
-- =============================================
INSERT INTO dimensoes (codigo, nome) VALUES
  ('AD', 'AD - Administração'),
  ('AE', 'AE - Atividades Estudantis'),
  ('CI', 'CI - Comunicação Institucional'),
  ('EN', 'EN - Ensino'),
  ('EX', 'EX - Extensão'),
  ('GE', 'GE - Gestão Estratégica e Desenvolvimento Institucional'),
  ('GO', 'GO - Governança'),
  ('GP', 'GP - Gestão de Pessoas'),
  ('IE', 'IE - Infraestrutura'),
  ('IN', 'IN - Internacionalização'),
  ('PI', 'PI - Pesquisa, Pós-Graduação e Inovação'),
  ('TI', 'TI - Tecnologia da Informação e Comunicação')
ON CONFLICT (codigo) DO NOTHING;

-- =============================================
-- 4. SEED: COMPONENTES FUNCIONAIS (por dimensão)
-- =============================================

-- AD
INSERT INTO componentes_funcionais (dimensao_id, nome)
SELECT d.id, comp FROM dimensoes d,
  unnest(ARRAY[
    '8 - Orçamento','9 - Contabilidade e Finanças','10 - Compras e Licitações',
    '11 - Contratos','12 - Material','13 - Patrimônio'
  ]) AS comp
WHERE d.codigo = 'AD'
ON CONFLICT (dimensao_id, nome) DO NOTHING;

-- AE
INSERT INTO componentes_funcionais (dimensao_id, nome)
SELECT d.id, comp FROM dimensoes d,
  unnest(ARRAY[
    '1 - Política de Atividades Estudantis','2 - Serviço Social','3 - Saúde Estudantil',
    '4 - Psicologia Escolar','5 - Alimentação e Nutrição',
    'Programas e Projetos de Protagonismo Estudantil'
  ]) AS comp
WHERE d.codigo = 'AE'
ON CONFLICT (dimensao_id, nome) DO NOTHING;

-- CI
INSERT INTO componentes_funcionais (dimensao_id, nome)
SELECT d.id, comp FROM dimensoes d,
  unnest(ARRAY['13 - Apoio a Eventos Institucionais']) AS comp
WHERE d.codigo = 'CI'
ON CONFLICT (dimensao_id, nome) DO NOTHING;

-- EN
INSERT INTO componentes_funcionais (dimensao_id, nome)
SELECT d.id, comp FROM dimensoes d,
  unnest(ARRAY[
    'Política de Ensino - Política de Ensino',
    'Política de Ensino - Planejamento do Ensino',
    'Política de Ensino - Corpo Docente e Técnico do Ensino',
    'Política de Ensino - Representação e Divulgação Institucional',
    'Supervisão Técnica do Ensino - Supervisão Técnica do Ensino',
    'Supervisão Técnica do Ensino - Monitoramento do Ensino',
    'Supervisão Técnica do Ensino - Informações Institucionais do Ensino',
    'Supervisão Técnica do Ensino - Legislação Educacional',
    'Gestão Pedagógica e Desenvolvimento Curricular - Gestão Pedagógica e Desenvolvimento Curricular',
    'Gestão Pedagógica e Desenvolvimento Curricular - Criação e Adequação de Cursos',
    'Gestão Pedagógica e Desenvolvimento Curricular - Acompanhamento do Trabalho Pedagógico',
    'Gestão Pedagógica e Desenvolvimento Curricular - EJA integrada à EPT',
    'Gestão Pedagógica e Desenvolvimento Curricular - Permanência na Graduação',
    'Gestão Pedagógica e Desenvolvimento Curricular - Atividades Acadêmico-Pedagógicas',
    'Avaliação e Regulação do Ensino - Avaliação e Regulação do Ensino',
    'Avaliação e Regulação do Ensino - Procuração e Interlocução Institucional',
    'Avaliação e Regulação do Ensino - Monitoramento institucional e de cursos',
    'Avaliação e Regulação do Ensino - Autorização de Funcionamento de Cursos',
    'Avaliação e Regulação do Ensino - Avaliações e Exames Educacionais Externos',
    'Avaliação e Regulação do Ensino - Revalidação de Diplomas',
    'Educação e Interseccionalidades em Direitos Humanos - Educação e Interseccionalidades em Direitos Humanos',
    'Educação e Interseccionalidades em Direitos Humanos - Educação Especial Inclusiva',
    'Educação e Interseccionalidades em Direitos Humanos - Educação para as Relações Étnico-Raciais',
    'Educação e Interseccionalidades em Direitos Humanos - Educação em Gênero e Diversidades',
    'Tecnologias Educacionais e Educação a Distância - Tecnologias Educacionais e Educação a Distância',
    'Tecnologias Educacionais e Educação a Distância - Programas de Educação a Distância e Ensino Híbrido',
    'Tecnologias Educacionais e Educação a Distância - Recursos e Tecnologias Educacionais',
    'Administração Acadêmica - Administração Acadêmica',
    'Administração Acadêmica - Sistemas de Administração Acadêmica',
    'Administração Acadêmica - Rotinas e Processos Acadêmicos',
    'Administração Acadêmica - Auditorias e Censos Educacionais',
    'Acesso Discente - Acesso Discente',
    'Recursos de Informação e Bibliotecas - Recursos de Informação e Bibliotecas',
    'Recursos de Informação e Bibliotecas - Sistema Integrado de Bibliotecas',
    'Recursos de Informação e Bibliotecas - Repositórios Digitais',
    'Recursos de Informação e Bibliotecas - Arquivos Institucionais',
    'Programas e Projetos de Ensino',
    'Apoio ao Ensino - Apoio ao Ensino',
    'Apoio ao Ensino - Administração Escolar',
    'Apoio ao Ensino - Laboratórios Acadêmicos',
    'Gestão de Esportes Estudantis'
  ]) AS comp
WHERE d.codigo = 'EN'
ON CONFLICT (dimensao_id, nome) DO NOTHING;

-- EX
INSERT INTO componentes_funcionais (dimensao_id, nome)
SELECT d.id, comp FROM dimensoes d,
  unnest(ARRAY[
    '1 - Política de Extensão','2 - Interação com a Sociedade',
    '3 - Relações com o Mundo do Trabalho','4 - Difusão e Cultura',
    '5 - Gestão da Formação Inicial e Continuada'
  ]) AS comp
WHERE d.codigo = 'EX'
ON CONFLICT (dimensao_id, nome) DO NOTHING;

-- GE
INSERT INTO componentes_funcionais (dimensao_id, nome)
SELECT d.id, comp FROM dimensoes d,
  unnest(ARRAY['7 - Gestão da Unidade Agrícola/ Industrial-Escola']) AS comp
WHERE d.codigo = 'GE'
ON CONFLICT (dimensao_id, nome) DO NOTHING;

-- GO
INSERT INTO componentes_funcionais (dimensao_id, nome)
SELECT d.id, comp FROM dimensoes d,
  unnest(ARRAY['19 - Suporte aos Colegiados de Apoio à Governança do IFRN']) AS comp
WHERE d.codigo = 'GO'
ON CONFLICT (dimensao_id, nome) DO NOTHING;

-- GP
INSERT INTO componentes_funcionais (dimensao_id, nome)
SELECT d.id, comp FROM dimensoes d,
  unnest(ARRAY[
    '25 - Cadastro e pagamento de Pessoal','27 - Desenvolvimento de Pessoal',
    '28 - Atenção à Saúde do Servidor'
  ]) AS comp
WHERE d.codigo = 'GP'
ON CONFLICT (dimensao_id, nome) DO NOTHING;

-- IE
INSERT INTO componentes_funcionais (dimensao_id, nome)
SELECT d.id, comp FROM dimensoes d,
  unnest(ARRAY[
    '14 - Gestão de Manutenção e Engenharia',
    '15 - Gestão de Serviços de Infraestrutura, Logística e Sustentabilidade'
  ]) AS comp
WHERE d.codigo = 'IE'
ON CONFLICT (dimensao_id, nome) DO NOTHING;

-- IN
INSERT INTO componentes_funcionais (dimensao_id, nome)
SELECT d.id, comp FROM dimensoes d,
  unnest(ARRAY['5 - Relações Internacionais']) AS comp
WHERE d.codigo = 'IN'
ON CONFLICT (dimensao_id, nome) DO NOTHING;

-- PI
INSERT INTO componentes_funcionais (dimensao_id, nome)
SELECT d.id, comp FROM dimensoes d,
  unnest(ARRAY['2 - Inovação Tecnológica']) AS comp
WHERE d.codigo = 'PI'
ON CONFLICT (dimensao_id, nome) DO NOTHING;

-- TI
INSERT INTO componentes_funcionais (dimensao_id, nome)
SELECT d.id, comp FROM dimensoes d,
  unnest(ARRAY[
    '1 - Política de Tecnologia da Informação e Comunicação',
    '2 - Governança de TIC',
    '4 - Infraestrutura e Operações de TIC'
  ]) AS comp
WHERE d.codigo = 'TI'
ON CONFLICT (dimensao_id, nome) DO NOTHING;

-- =============================================
-- 5. SEED: NATUREZAS DE DESPESA
-- =============================================

-- 5.1 Seed fixo: todas as naturezas conhecidas (API + planejamento)
INSERT INTO naturezas_despesa (codigo, nome) VALUES
  ('339000', 'Não Especificado'),
  ('339014', 'Diárias - Civil'),
  ('339018', 'Auxílio Financeiro a Estudantes'),
  ('339020', 'Auxílio Financeiro a Pesquisadores'),
  ('339030', 'Material de Consumo'),
  ('339032', 'Material de Distribuição Gratuita'),
  ('339033', 'Passagens e Despesas com Locomoção'),
  ('339036', 'Outros Serviços de Terceiros - Pessoa Física'),
  ('339037', 'Locação de Mão-de-Obra'),
  ('339039', 'Outros Serviços de Terceiros - Pessoa Jurídica'),
  ('339040', 'Serviços de Tecnologia da Informação e Comunicação'),
  ('339047', 'Obrigações Tributárias e Contributivas'),
  ('449052', 'Equipamentos e Material Permanente')
ON CONFLICT (codigo) DO NOTHING;

-- 5.2 Seed dinâmico: naturezas adicionais dos dados existentes
INSERT INTO naturezas_despesa (codigo, nome)
SELECT DISTINCT
  TRIM(split_part(natureza_despesa, ' - ', 1)),
  TRIM(substring(natureza_despesa from position(' - ' in natureza_despesa) + 3))
FROM empenhos
WHERE natureza_despesa IS NOT NULL AND natureza_despesa != '' AND TRIM(split_part(natureza_despesa, ' - ', 1)) != ''
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO naturezas_despesa (codigo, nome)
SELECT DISTINCT
  TRIM(split_part(natureza_despesa, ' - ', 1)),
  TRIM(substring(natureza_despesa from position(' - ' in natureza_despesa) + 3))
FROM atividades
WHERE natureza_despesa IS NOT NULL AND natureza_despesa != '' AND TRIM(split_part(natureza_despesa, ' - ', 1)) != ''
ON CONFLICT (codigo) DO NOTHING;

-- =============================================
-- 6. SEED: ORIGENS DE RECURSO (dos dados existentes)
-- =============================================
INSERT INTO origens_recurso (codigo)
SELECT DISTINCT origem_recurso FROM empenhos
WHERE origem_recurso IS NOT NULL AND origem_recurso != '' AND origem_recurso != 'NÃO DEFINIDA'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO origens_recurso (codigo)
SELECT DISTINCT origem_recurso FROM atividades
WHERE origem_recurso IS NOT NULL AND origem_recurso != ''
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO origens_recurso (codigo)
SELECT DISTINCT origem_recurso FROM descentralizacoes
WHERE origem_recurso IS NOT NULL AND origem_recurso != ''
ON CONFLICT (codigo) DO NOTHING;

-- =============================================
-- 7. VINCULAR REGISTROS EXISTENTES
-- =============================================

-- 7.1 Dimensões
UPDATE empenhos e SET dimensao_id = d.id
FROM dimensoes d WHERE e.dimensao LIKE d.codigo || ' -%' AND e.dimensao_id IS NULL;

UPDATE atividades a SET dimensao_id = d.id
FROM dimensoes d WHERE a.dimensao LIKE d.codigo || ' -%' AND a.dimensao_id IS NULL;

UPDATE descentralizacoes dc SET dimensao_id = d.id
FROM dimensoes d WHERE dc.dimensao LIKE d.codigo || ' -%' AND dc.dimensao_id IS NULL;

-- 7.2 Componentes Funcionais
UPDATE empenhos e SET componente_funcional_id = cf.id
FROM componentes_funcionais cf WHERE e.componente_funcional = cf.nome AND e.componente_funcional_id IS NULL;

UPDATE atividades a SET componente_funcional_id = cf.id
FROM componentes_funcionais cf WHERE a.componente_funcional = cf.nome AND a.componente_funcional_id IS NULL;

-- 7.3 Naturezas de despesa
UPDATE empenhos e SET natureza_despesa_id = nd.id
FROM naturezas_despesa nd WHERE TRIM(split_part(e.natureza_despesa, ' - ', 1)) = nd.codigo AND e.natureza_despesa_id IS NULL;

UPDATE atividades a SET natureza_despesa_id = nd.id
FROM naturezas_despesa nd WHERE TRIM(split_part(a.natureza_despesa, ' - ', 1)) = nd.codigo AND a.natureza_despesa_id IS NULL;

-- 7.4 Origens de recurso
UPDATE empenhos e SET origem_recurso_id = o.id
FROM origens_recurso o WHERE e.origem_recurso = o.codigo AND e.origem_recurso_id IS NULL;

UPDATE atividades a SET origem_recurso_id = o.id
FROM origens_recurso o WHERE a.origem_recurso = o.codigo AND a.origem_recurso_id IS NULL;

UPDATE descentralizacoes dc SET origem_recurso_id = o.id
FROM origens_recurso o WHERE dc.origem_recurso = o.codigo AND dc.origem_recurso_id IS NULL;
