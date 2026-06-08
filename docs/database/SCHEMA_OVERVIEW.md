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
- `creditos_disponiveis_detalhes`

### Dominios auxiliares

- `dimensoes`
- `componentes_funcionais`
- `naturezas_despesa`
- `origens_recurso`

### Documentos e pagamentos

- `documentos_habeis`
- `documentos_habeis_itens`
- `documentos_habeis_situacoes`
- `document_templates`
- `licitacao_document_artifacts`
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
- `contratos_api_historico`
- `contratos_api_empenhos`
- `contratos_api_faturas`
- `contratos_api_itens`
- `contratos_api_fatura_itens`
- `contratos_api_fatura_empenhos`
- `contratos_api_empenho_liquidacoes_cache_status`
- `contratos_api_empenho_liquidacoes_cache`
- `contratos_api_sync_runs`

### Licitacoes, pregoes PNCP e ARP

- `licitacoes_pncp`
- `licitacoes_pncp_sync_runs`
- `licitacoes_pncp_uasgs`
- `atas_registro_precos`
- `atas_registro_precos_itens`
- `atas_registro_precos_unidades`
- `atas_registro_precos_adesoes`
- `atas_registro_precos_sync_runs`
- view `atas_registro_precos_resumo`

### Importacoes auxiliares

- `financeiro_fonte_vinculacao`
- `lc_credores`
- `retencoes_efd_reinf`
- `email_csv_ingestion_runs`

### Energia Campus

- `energia_import_runs`
- `energia_consumo_faturas`
- `energia_solar_geracao`
- `energia_contratos`
- `energia_contrato_execucoes`

### Limpeza e Manutenção

- `manutencao_ambientes`
- `manutencao_ocorrencias`
- `manutencao_checkins`

### Automacoes e economia de tempo

- `automation_savings_scenarios`
- `automation_savings_events`

### Base semantica do Consultor

- `normativos`
- `normativos_chunks`
- `normativos_log`
- RPC `buscar_normativos`

Observacao: esses objetos sao criados pelo SQL embutido em [normativos-pipeline/pipeline/ingest.py](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/normativos-pipeline/pipeline/ingest.py), nao pelas migrations principais inspecionadas nesta rodada. O fluxo e o backlog ficam em [NORMATIVOS_CONSULTOR_INGESTION.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/integrations/NORMATIVOS_CONSULTOR_INGESTION.md).

### Autorizacao de telas

- `screen_groups`
- `app_screens`
- `user_groups`
- `user_group_screen_permissions`
- `user_group_memberships`

### Preferencias de usuario

- `user_favorites`

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
- `gerar-contrato-licitacao`
- `gerar-mapa-riscos-licitacao`
- `gerar-termo-referencia-compras`
- `record-automation-savings-event`
- `refresh-comprasnet-liquidacoes-cache`
- `sync-atas-registro-precos`
- `sync-licitacoes-pncp`

## Functions invocadas no frontend que exigem confirmacao

- `verificar-conformidade`

Esta function aparece em [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx), mas nao foi localizada em `supabase/functions` nesta rodada.
