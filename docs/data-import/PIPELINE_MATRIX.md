# PIPELINE_MATRIX

## Matriz resumida

| Dominio | Pagina | Entrada | Parser/Service | Destino | Observacoes |
|---|---|---|---|---|---|
| Financeiro | `Financeiro.tsx` | CSV/XLSX | `financeiroImportService.ts` | `financeiro_fonte_vinculacao` | Consolida saldo por fonte e vinculacao |
| LC | `LC.tsx` | CSV/XLSX | `lcImportService.ts` | `lc_credores` | Tambem compara PDFs e gera macro SIAFI |
| Descentralizacoes | `Descentralizacoes.tsx` | CSV | `handleCsvImport` em `Descentralizacoes.tsx` | `descentralizacoes` | Upload principal aceita `NC` e `NC - Operacao (Tipo)`; resume a NC para `2026NC000001`; quando a operacao for `ANULACAO DE DESCENTRALIZACAO DE CREDITO`, interpreta `NC Celula - Valor` como negativo |
| Devolucoes de descentralizacoes | `Descentralizacoes.tsx` | CSV | `handleDevolucoesImport` + `descentralizacoesService.processDevolucao` | `descentralizacoes` | Fluxo separado do upload principal; nao reutiliza a logica de anulação do CSV principal e pode receber valores negativos diretamente |
| PFs | `RastreabilidadePFs/index.tsx` | XLSX/XLS/CSV | `pfImportService.ts` | `pf_solicitacao`, `pf_aprovacao`, `pf_liberacao`, `pf_fonte_recurso` | Usa dois arquivos correlacionados |
| Retencoes FD-Reinf | `RetencoesFdReinfDesign.tsx` | CSV | `retencoesEfdReinfImportService.ts` | `retencoes_efd_reinf` | UI aceita XLSX, parser atual nao |
| Documentos habeis | `LiquidacoesPagamentos.tsx` | JSON/CSV tabulado | `transparencia.importDocumentosHabeis` | `documentos_habeis`, `documentos_habeis_itens`, `documentos_habeis_situacoes` | Usa `JsonImportDialog` |
| Liquidacoes / Fonte SOF | `LiquidacoesPagamentos.tsx` | JSON/CSV tabulado | `transparencia.importLiquidacoes` | `documentos_habeis` | Atualiza `fonte_sof` e vinculo com empenho |
| Ordens bancarias | `LiquidacoesPagamentos.tsx` | JSON/CSV tabulado | `transparencia.importOrdensBancarias` | `documentos_habeis_itens` e `documentos_habeis` | Atualiza pagos |
| Situacoes / Retencoes | `LiquidacoesPagamentos.tsx` | JSON/CSV tabulado | `retencoes.upsertSituacoesBatch` | `documentos_habeis_situacoes` | Regras de retencao derivadas da situacao |
| Creditos disponiveis | `Empenhos.tsx` | JSON/CSV tabulado | `transparencia.importCreditosDisponiveis` | `creditos_disponiveis` | Usa parser generico |

## Dialogos e componentes reutilizados

- importacao generica: [JsonImportDialog.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/JsonImportDialog.tsx)
- importacao de PFs: [PFImportDialog.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/modals/PFImportDialog.tsx)
- parser utilitario de CSV: [csvParser.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/utils/csvParser.ts)

## Alertas de consistencia

- A UI de FD-Reinf aceita `.xlsx,.xls`, mas o service atual lanca erro para XLSX.
- O dialogo de PF sugere principalmente XLSX/XLS, mas o service tambem trata CSV.
- Alguns imports operam com JSON e CSV no mesmo fluxo porque usam `JsonImportDialog`.
