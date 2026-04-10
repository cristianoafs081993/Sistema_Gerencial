# TABLE_CATALOG

Este catalogo resume as tabelas e views mais relevantes para manutencao. Nao substitui as migrations.

## Orcamento e execucao

### `atividades`

Finalidade:

- planejamento orcamentario base

Campos-chave:

- `id`
- `dimensao`
- `componente_funcional`
- `atividade`
- `descricao`
- `valor_total`
- `origem_recurso`
- `natureza_despesa`
- `plano_interno`
- FKs auxiliares `*_id`

Observacoes operacionais:

- `componente_funcional` deve permanecer sem prefixo numerico inicial, por exemplo `Contratos` em vez de `11 - Contratos`
- para a dimensao `EN`, `atividade` deve armazenar apenas o nome final da atividade, sem prefixos como `44 - COMPONENTE FUNCIONAL (PROEN):` e sem repetir o componente antes do nome

Consumido por:

- [atividades.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/atividades.ts)
- [DataContext.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/contexts/DataContext.tsx)

### `empenhos`

Finalidade:

- empenhos do exercicio e RAP

Campos-chave:

- `id`
- `numero`
- `descricao`
- `valor`
- `status`
- `tipo`
- `plano_interno`
- `origem_recurso`
- `natureza_despesa`
- campos oficiais de liquidacao e pagamento

Observacoes operacionais:

- `componente_funcional` deve permanecer sem prefixo numerico inicial, seguindo o catalogo normalizado de `componentes_funcionais`

Consumido por:

- [empenhos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/empenhos.ts)
- [Dashboard.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Dashboard.tsx)
- [Empenhos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Empenhos.tsx)

### `descentralizacoes`

Finalidade:

- controle de descentralizacoes e devolucoes

Campos-chave:

- `id`
- `dimensao`
- `origem_recurso`
- `natureza_despesa`
- `plano_interno`
- `data_emissao`
- `valor`

Consumido por:

- [descentralizacoes.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/descentralizacoes.ts)
- [Descentralizacoes.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Descentralizacoes.tsx)

### `creditos_disponiveis`

Finalidade:

- saldo de credito disponivel por `ptres`

Campos-chave:

- `ptres`
- `metrica`
- `valor`
- `updated_at`

Consumido por:

- [creditosDisponiveis.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/creditosDisponiveis.ts)
- [transparencia.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/transparencia.ts)

## Dominios auxiliares

### `dimensoes`

- dicionario de dimensoes institucionais

### `componentes_funcionais`

- componentes funcionais por dimensao

Observacoes operacionais:

- o campo `nome` deve ficar normalizado sem prefixo numerico inicial
- a dimensao `EN` continua com nomes textuais completos do catalogo institucional

### `naturezas_despesa`

- catalogo de natureza de despesa

### `origens_recurso`

- catalogo de origem de recurso

Consumidos por:

- [dominio.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/dominio.ts)

## Documentos habeis e pagamentos

### `documentos_habeis`

Finalidade:

- documento habil pai

Campos-chave:

- `id`
- `data_emissao`
- `processo`
- `estado`
- `favorecido_documento`
- `favorecido_nome`
- `valor_original`
- `valor_pago`
- `fonte_sof`
- `empenho_numero`

Consumido por:

- [transparencia.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/transparencia.ts)
- [LiquidacoesPagamentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/LiquidacoesPagamentos.tsx)

### `documentos_habeis_itens`

Finalidade:

- itens filhos do documento habil, como OB e NS

Campos-chave:

- `id`
- `documento_habil_id`
- `doc_tipo`
- `data_emissao`
- `valor`
- `observacao`

### `documentos_habeis_situacoes`

Finalidade:

- situacoes detalhadas, inclusive retencoes

Campos-chave:

- `id`
- `documento_habil_id`
- `situacao_codigo`
- `valor`
- `is_retencao`

Views relacionadas:

- `vw_documentos_pendentes_pagamento`

## PFs e conciliacao

### `pf_fonte_recurso`

- lookup de fontes de recurso de PF

### `pf_solicitacao`

- etapa inicial de solicitacao

### `pf_aprovacao`

- etapa de aprovacao

### `pf_liberacao`

- etapa de liberacao

Views identificadas:

- `vw_controle_pfs_pendentes`
- `vw_documentos_pendentes_pagamento`
- `vw_conciliacao_documento_pf`
- `vw_conciliacao_diaria_pf`
- `vw_rastreabilidade_pf` precisa de confirmacao no banco

Consumido por:

- [pfImportService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/pfImportService.ts)
- [rastreabilidadePFs.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/rastreabilidadePFs.ts)

## Contratos

### `contratos`

- modulo local de contratos

Campos-chave:

- `id`
- `numero`
- `contratada`
- `valor`
- `data_inicio`
- `data_termino`

Observacoes operacionais:

- o campo `contratada` deve guardar apenas a razao social limpa, sem concatenar CNPJ e sem o sufixo textual `Pessoa Juridica`
- o runtime atual do modulo local nao depende de uma coluna `cnpj` em `contratos`; se essa separacao for retomada no banco, a migration correspondente precisa estar aplicada antes da publicacao

### `contratos_empenhos`

- relacao N:N entre contrato local e empenho

### `contratos_api`

- espelho local da API externa de contratos

### `contratos_api_empenhos`

- empenhos vinculados a cada contrato vindo da API externa

### `contratos_api_faturas`

- faturas vinculadas a cada contrato vindo da API externa

### `contratos_api_sync_runs`

- historico das sincronizacoes da API de contratos

Consumido por:

- [contratos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/contratos.ts)
- [contratosApi.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/contratosApi.ts)

## Importacoes auxiliares

### `financeiro_fonte_vinculacao`

- saldo financeiro por fonte/vinculacao carregado por arquivo

### `lc_credores`

- base da lista de credores carregada por arquivo

### `retencoes_efd_reinf`

- base dedicada de auditoria FD-Reinf

### `email_csv_ingestion_runs`

- trilha operacional da ingestao automatica de anexos CSV vindos do Gmail
- guarda `message_id`, hash do anexo, pipeline detectado, status, volumetria e erro
- usada para idempotencia e auditoria da automacao por e-mail
