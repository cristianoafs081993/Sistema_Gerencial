-- 1. Normalizar transparencia_documentos
-- Adiciona a chave estrangeira para empenhos
ALTER TABLE transparencia_documentos 
ADD COLUMN IF NOT EXISTS empenho_id UUID REFERENCES empenhos(id) ON DELETE SET NULL;

-- Migra os dados baseados no fato que empenho_documento armazena o numero do empenho
UPDATE transparencia_documentos td
SET empenho_id = e.id
FROM empenhos e
WHERE td.empenho_documento = e.numero AND td.empenho_id IS NULL;


-- 2. Normalizar a tabela empenhos
-- Garante que atividade_id seja uma foreign key apontando para a tabela atividades
ALTER TABLE empenhos 
  DROP CONSTRAINT IF EXISTS empenhos_atividade_id_fkey;

ALTER TABLE empenhos 
  ADD CONSTRAINT empenhos_atividade_id_fkey FOREIGN KEY (atividade_id) REFERENCES atividades(id) ON DELETE SET NULL;

-- Como o usuário não respondeu sobre tabelas de domínio satélite, manteremos a redundância dos campos de texto (natureza_despesa, dimensao, origem_recurso) como fallback orçamentário, mas a relação prioritária passa a ser a Foreign Key.
