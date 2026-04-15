# DATA_LINEAGE

## Objetivo

Mostrar a linhagem operacional dos dados de forma curta:

- origem
- parser ou service
- tabela ou view
- pagina consumidora

## Linhagens principais

### Orcamento base

- entrada manual de atividades
  - pagina: [Atividades.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Atividades.tsx)
  - service: [atividades.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/atividades.ts)
  - tabela: `atividades`
  - observacao: normaliza `componente_funcional` sem prefixo numerico, limpa labels legados de atividades da dimensao `EN` e persiste `tipo_atividade` para definir a aba de planejamento

- entrada manual de empenhos e imports auxiliares
  - pagina: [Empenhos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Empenhos.tsx)
  - service: [empenhos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/empenhos.ts)
  - tabela: `empenhos`
  - observacao: normaliza `componente_funcional` sem prefixo numerico antes de persistir

### Financeiro

- arquivo `4 - Financeiro.csv`
  - parser: [financeiroImportService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/financeiroImportService.ts)
  - tabela: `financeiro_fonte_vinculacao`
  - pagina: [Financeiro.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Financeiro.tsx)

### LC

- arquivo `7 - LC.csv`
  - parser: [lcImportService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/lcImportService.ts)
  - tabela: `lc_credores`
  - pagina: [LC.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/LC.tsx)

- PDFs de pagamento
  - extracao: [bolsistasPdfService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/bolsistasPdfService.ts)
  - comparacao: [lcComparisonService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/lcComparisonService.ts)
  - saida operacional: macro em [siafiMacroService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/siafiMacroService.ts)

### PFs

- arquivos de solicitacao e aprovacao/liberacao
  - parser e correlacao: [pfImportService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/pfImportService.ts)
  - tabelas:
    - `pf_fonte_recurso`
    - `pf_solicitacao`
    - `pf_aprovacao`
    - `pf_liberacao`
  - views de consumo:
    - `vw_controle_pfs_pendentes`
    - `vw_documentos_pendentes_pagamento`
    - `vw_rastreabilidade_pf`
  - pagina: [RastreabilidadePFs/index.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/RastreabilidadePFs/index.tsx)

### Contratos locais

- planilhas `Relatorio.xlsx` e `Relatorio (1).xlsx`
  - parser e orquestracao: [ContratosSyncDialog.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/modals/ContratosSyncDialog.tsx)
  - persistencia: [contratos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/contratos.ts)
  - tabelas:
    - `contratos`
    - `contratos_empenhos`
- observacao: o dialogo identifica automaticamente qual arquivo e o relatorio de contratos ativos e qual e o relatorio de vinculos/valores pelos cabecalhos; o relatorio de contratos ativos limpa a razao social removendo CNPJ e o sufixo `Pessoa Juridica`; contratos inativos no arquivo sao ignorados e contratos ausentes no arquivo nao devem ser removidos do banco; o relatorio de vinculos/valores atualiza o valor do contrato e os vinculos com empenhos, ignorando `Valor Liquidado` e `Valor Pago`; a escrita deduplica por `numero` e usa fallback para `insert/update` se o ambiente nao aceitar `upsert onConflict(numero)`; o contrato legado `00089/2016` da CAERN e tratado como excecao operacional e fica fora do modulo local
  - pagina: [Contratos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Contratos.tsx)

### Contratos API Comprasnet

- API `https://contratos.comprasnet.gov.br/api`
  - sincronizacao automatica: [sync-contratos-comprasnet/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/sync-contratos-comprasnet/index.ts)
  - service de leitura no frontend: [contratosApi.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/contratosApi.ts)
  - tabelas:
    - `contratos_api`
    - `contratos_api_historico`
    - `contratos_api_empenhos`
    - `contratos_api_faturas`
    - `contratos_api_itens`
    - `contratos_api_fatura_itens`
    - `contratos_api_fatura_empenhos`
    - `contratos_api_sync_runs`
  - pagina: [Contratos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Contratos.tsx)
- observacao: a tela local continua vindo de `contratos` e `contratos_empenhos`; os dados da API enriquecem a linha quando o numero normalizado casa. Valor Total usa `contratos_api_historico` como fonte principal quando houver API, somando `valor_inicial` de cada termo; `valor_global` da API nao entra nessa metrica. Sem historico com `valor_inicial`, usa `contratos.valor` como fallback. A execucao por item soma faturas com situacao `Pago` ou `Siafi Apropriado` que tenham `dados_item_faturado`. O valor contratado por item no drawer soma `contratos_api_itens.historico_item[].valor_total` quando existir e cai para `contratos_api_itens.valor_total` sem historico do item. O historico da API exibe assinatura, aditivos e apostilamentos; `codigo_unidade_origem = 158155` deve ser sinalizado como origem Reitoria. Em contratos, Valor Empenhado usa `contratos_api_empenhos.valor_empenhado` quando houver API, com fallback para o valor original do empenho local.

### Documentos habeis

- arquivo de documentos/situacoes/itens
  - parser: [JsonImportDialog.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/JsonImportDialog.tsx)
  - transformacao: [transparencia.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/transparencia.ts)
  - tabelas:
    - `documentos_habeis`
    - `documentos_habeis_itens`
    - `documentos_habeis_situacoes`
  - pagina: [LiquidacoesPagamentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/LiquidacoesPagamentos.tsx)

### Liquidacoes e fonte SOF

- arquivo de liquidacoes
  - transformacao: [transparencia.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/transparencia.ts)
  - atualiza: `documentos_habeis`
  - cruza com: `empenhos`

### Ordens bancarias

- arquivo de OBs/pagos
  - transformacao: [transparencia.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/transparencia.ts)
  - atualiza:
    - `documentos_habeis_itens`
    - `documentos_habeis`

### Retencoes FD-Reinf

- arquivo CSV de auditoria
  - parser: [retencoesEfdReinfImportService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/retencoesEfdReinfImportService.ts)
  - tabela: `retencoes_efd_reinf`
  - pagina: [RetencoesFdReinfDesign.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/RetencoesFdReinfDesign.tsx)

### Ingestao automatica por Gmail

- e-mail com anexo `.csv`
  - coleta: [gmailCsvIngress.gs](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/scripts/google-apps-script/gmailCsvIngress.gs)
  - roteamento e parse: [ingest-email-csv/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/ingest-email-csv/index.ts) + [emailCsvIngestion.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/emailCsvIngestion.ts)
  - trilha operacional: `email_csv_ingestion_runs`
  - destino: tabela do pipeline detectado

### Normativos do Consultor

- fontes HTML oficiais e PDFs locais
  - extracao: [normativos-pipeline/pipeline/extract.py](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/normativos-pipeline/pipeline/extract.py)
  - chunking e embeddings: [normativos-pipeline/pipeline/process.py](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/normativos-pipeline/pipeline/process.py)
  - persistencia e log: [normativos-pipeline/pipeline/ingest.py](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/normativos-pipeline/pipeline/ingest.py)
  - tabelas:
    - `normativos`
    - `normativos_chunks`
    - `normativos_log`
  - busca: RPC `buscar_normativos`
  - consumidor frontend: [ConsultorSessions.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/ConsultorSessions.tsx)
  - backlog: [NORMATIVOS_CONSULTOR_INGESTION.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/integrations/NORMATIVOS_CONSULTOR_INGESTION.md)
