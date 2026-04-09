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
  - observacao: normaliza `componente_funcional` sem prefixo numerico e limpa labels legados de atividades da dimensao `EN`

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
