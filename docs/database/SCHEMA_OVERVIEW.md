# SCHEMA_OVERVIEW

## Aviso importante

Este documento e um mapa operacional do schema, nao um dicionario exaustivo de colunas.
Para mudancas sensiveis, confirme sempre nas migrations em [supabase/migrations](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/migrations).

## Grupos principais

### Orcamento e execucao

- `atividades`
- `empenhos`
- `descentralizacoes`
- `creditos_disponiveis`

### Dominios auxiliares

- `dimensoes`
- `componentes_funcionais`
- `naturezas_despesa`
- `origens_recurso`

### Documentos e pagamentos

- `documentos_habeis`
- `documentos_habeis_itens`
- `documentos_habeis_situacoes`
- `liquidacoes`
- `liquidacoes_empenhos`

### PFs

- `pf_fonte_recurso`
- `pf_solicitacao`
- `pf_aprovacao`
- `pf_liberacao`

### Contratos

- `contratos`
- `contratos_empenhos`
- `contratos_api`
- `contratos_api_empenhos`
- `contratos_api_faturas`
- `contratos_api_sync_runs`

### Importacoes auxiliares

- `financeiro_fonte_vinculacao`
- `lc_credores`
- `retencoes_efd_reinf`

## Views identificadas nas migrations

- `vw_conciliacao_documento_pf`
- `vw_conciliacao_diaria_pf`
- `vw_controle_pfs_pendentes`
- `vw_documentos_pendentes_pagamento`

## Views consumidas no frontend que exigem confirmacao

- `vw_rastreabilidade_pf`

Esta view aparece no frontend em [rastreabilidadePFs.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/rastreabilidadePFs.ts), mas nao foi localizada nas migrations inspecionadas nesta rodada.

## Functions identificadas no repo

- `analisar-liquidacao-siafi`

## Functions invocadas no frontend que exigem confirmacao

- `verificar-conformidade`

Esta function aparece em [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx), mas nao foi localizada em `supabase/functions` nesta rodada.
