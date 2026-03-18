-- Adiciona constraint UNIQUE nas colunas numero_pf das tabelas de PFs
-- Necessário para que o upsert com on_conflict funcione corretamente

ALTER TABLE pf_solicitacao
  ADD CONSTRAINT IF NOT EXISTS pf_solicitacao_numero_pf_unique UNIQUE (numero_pf);

ALTER TABLE pf_aprovacao
  ADD CONSTRAINT IF NOT EXISTS pf_aprovacao_numero_pf_unique UNIQUE (numero_pf);

ALTER TABLE pf_liberacao
  ADD CONSTRAINT IF NOT EXISTS pf_liberacao_numero_pf_unique UNIQUE (numero_pf);
