# PIPELINE_MATRIX

## Matriz resumida

| Dominio | Pagina | Entrada | Parser/Service | Destino | Observacoes |
|---|---|---|---|---|---|
| Financeiro | `Financeiro.tsx` | CSV/XLSX | `financeiroImportService.ts` | `financeiro_fonte_vinculacao` | Consolida saldo por fonte e vinculacao |
| LC | `LC.tsx` | CSV/XLSX | `lcImportService.ts` | `lc_credores` | Tambem compara PDFs e gera macro SIAFI |
| Descentralizacoes | `Descentralizacoes.tsx` | CSV | `handleCsvImport` em `Descentralizacoes.tsx` | `descentralizacoes` | Upload principal aceita `NC` e `NC - Operacao (Tipo)`; resume a NC para `2026NC000001`; quando a operacao for `ANULACAO DE DESCENTRALIZACAO DE CREDITO`, interpreta `NC Celula - Valor` como negativo; `NC Celula - Plano Interno` continua separando linhas distintas da mesma NC e a tabela persiste `nota_credito` e `operacao_tipo` para reconciliacao |
| Devolucoes de descentralizacoes | `Descentralizacoes.tsx` | CSV | `handleDevolucoesImport` + `descentralizacoesService.processDevolucao` | `descentralizacoes` | Fluxo separado do upload principal; insere uma nova linha negativa com `operacao_tipo = DEVOLUCAO`, nao reutiliza a logica de anulacao do CSV principal e pode receber valores negativos diretamente |
| PFs | `RastreabilidadePFs/index.tsx` | XLSX/XLS/CSV | `pfImportService.ts` | `pf_solicitacao`, `pf_aprovacao`, `pf_liberacao`, `pf_fonte_recurso` | Usa dois arquivos correlacionados |
| Contratos locais | `Contratos.tsx` | XLSX/XLS (`Relatorio.xlsx` + `Relatorio (1).xlsx`, com deteccao automatica de ordem) | `ContratosSyncDialog.tsx` + `contratos.ts` | `contratos`, `contratos_empenhos` | O relatorio de contratos ativos limpa a razao social removendo CNPJ e o sufixo `Pessoa Juridica`; contratos inativos no arquivo sao ignorados e contratos ausentes no arquivo nao devem ser removidos do banco; o relatorio de vinculos/valores atualiza o valor do contrato e os vinculos com empenhos, ignorando `Valor Liquidado` e `Valor Pago`; a persistencia deduplica por `numero` e usa fallback para `insert/update` quando o `upsert` nao e aceito pelo banco; por regra operacional, o contrato legado `00089/2016` da CAERN e ignorado no modulo local por ter sido substituido por contrato mais recente com o mesmo objeto |
| Retencoes FD-Reinf | `RetencoesFdReinfDesign.tsx` | CSV | `retencoesEfdReinfImportService.ts` | `retencoes_efd_reinf` | UI aceita XLSX, parser atual nao |
| Documentos habeis | `LiquidacoesPagamentos.tsx` | JSON/CSV tabulado | `transparencia.importDocumentosHabeis` | `documentos_habeis`, `documentos_habeis_itens`, `documentos_habeis_situacoes` | Usa `JsonImportDialog` |
| Liquidacoes / Fonte SOF | `LiquidacoesPagamentos.tsx` | JSON/CSV tabulado | `transparencia.importLiquidacoes` | `documentos_habeis` | Atualiza `fonte_sof` e vinculo com empenho |
| Ordens bancarias | `LiquidacoesPagamentos.tsx` | JSON/CSV tabulado | `transparencia.importOrdensBancarias` | `documentos_habeis_itens` e `documentos_habeis` | Atualiza pagos |
| Situacoes / Retencoes | `LiquidacoesPagamentos.tsx` | JSON/CSV tabulado | `retencoes.upsertSituacoesBatch` | `documentos_habeis_situacoes` | Regras de retencao derivadas da situacao |
| Creditos disponiveis | `Empenhos.tsx` | JSON/CSV tabulado | `transparencia.importCreditosDisponiveis` | `creditos_disponiveis` | Usa parser generico |
| Ingestao automatica por Gmail | `Gmail + Apps Script` | CSV | `ingest-email-csv` | `email_csv_ingestion_runs` + tabela final do pipeline | Roteia anexos CSV para os parsers server-side; exige `EMAIL_CSV_INGEST_SECRET`; suporta os pipelines CSV de arquivo unico |

## Dialogos e componentes reutilizados

- importacao generica: [JsonImportDialog.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/JsonImportDialog.tsx)
- importacao de PFs: [PFImportDialog.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/modals/PFImportDialog.tsx)
- sincronizacao de contratos: [ContratosSyncDialog.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/modals/ContratosSyncDialog.tsx)
- parser utilitario de CSV: [csvParser.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/utils/csvParser.ts)

## Alertas de consistencia

- A UI de FD-Reinf aceita `.xlsx,.xls`, mas o service atual lanca erro para XLSX.
- O dialogo de PF sugere principalmente XLSX/XLS, mas o service tambem trata CSV.
- A sincronizacao de contratos depende de duas planilhas XLSX distintas: `Relatorio.xlsx` para contratos ativos e `Relatorio (1).xlsx` para valor do contrato e vinculos com empenhos. O dialogo identifica automaticamente a ordem correta pelos cabecalhos.
- O parser do `Relatorio (3)` ignora `Valor Liquidado` e `Valor Pago`; esses campos nao devem alimentar o modulo local de contratos.
- A escrita no banco pode cair para `insert/update` se o `upsert onConflict(numero)` nao estiver disponivel no ambiente.
- Alguns imports operam com JSON e CSV no mesmo fluxo porque usam `JsonImportDialog`.
