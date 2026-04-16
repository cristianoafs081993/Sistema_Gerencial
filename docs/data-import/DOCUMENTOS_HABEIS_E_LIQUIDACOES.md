# DOCUMENTOS_HABEIS_E_LIQUIDACOES

## Objetivo

Documentar os imports que entram pela tela de documentos habeis e alteram execucao, situacoes, retencoes, itens e fonte SOF.

## Ponto de entrada

- pagina: [LiquidacoesPagamentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/LiquidacoesPagamentos.tsx)
- service principal: [transparencia.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/transparencia.ts)
- service de situacoes: [retencoes.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/retencoes.ts)
- dialogo de importacao: [JsonImportDialog.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/JsonImportDialog.tsx)

## Tipos de importacao nesta tela

### 1. Documentos Habeis

- entrada: JSON ou CSV tabulado
- handler: `transparenciaService.importDocumentosHabeis`
- tabelas impactadas:
  - `documentos_habeis`
  - `documentos_habeis_situacoes`
  - `documentos_habeis_itens`

Campos esperados na UI:

- `Documento Habil`
- `DH - Valor Doc.Origem`
- `DH - Processo`
- `DH - Estado`
- `DH - Credor`

### 2. Fonte SOF / Liquidacoes

- entrada: JSON ou CSV tabulado
- handler: `transparenciaService.importLiquidacoes`
- tabela impactada:
  - `documentos_habeis`

Campos esperados na UI:

- `NE CCor`
- `Documento Origem`
- `Fonte SOF`
- `Fonte`

### 3. Ordens Bancarias / Pagos

- entrada: JSON ou CSV tabulado
- handler: `transparenciaService.importOrdensBancarias`
- tabelas impactadas:
  - `documentos_habeis_itens`
  - `documentos_habeis`

Campos esperados na UI:

- `Documento`
- `Documento Origem`
- `DESPESAS PAGAS`
- `RESTOS A PAGAR PAGOS`
- `Dia Lancamento`

### 4. Situacoes / Retencoes

- entrada: JSON ou CSV tabulado
- handler: `retencoesService.upsertSituacoesBatch`
- tabela impactada:
  - `documentos_habeis_situacoes`

Campos esperados na UI:

- `Documento Habil`
- `DH - Situacao`
- `DH - Valor Doc.Origem`

## Regras gerais do dialogo generico

`JsonImportDialog` faz:

- deteccao de arquivo JSON ou CSV
- deteccao heuristica de separador: `;`, `tab`, `,`, `|`
- normalizacao de headers
- normalizacao de encoding
- validacao por semelhanca com campos esperados

## Fixtures uteis

- [Exec_NE_Exercicio_RAP_UG_Executora.csv](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/Exec_NE_Exercicio_RAP_UG_Executora.csv)
- [Empenhos (2).csv](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/Empenhos%20(2).csv)

## Observacoes de negocio

- o service tambem integra com o Portal da Transparencia por `fetch`
- parte da logica de documentos gera itens, situacoes e atualizacoes cruzadas com empenhos
- na leitura operacional dos CSVs usados para reconciliar empenhos:
  - o arquivo `Exec_NE_Exercicio_RAP_UG_Executora.csv` continua cobrindo o exercicio corrente e o contrato legado combinado
  - o saldo atual de RAP tambem pode vir em um CSV especifico com `NE CCor` + `Metrica`, que atualiza somente `saldo_rap_oficial`
- no contrato legado combinado `Exec_NE_Exercicio_RAP_UG_Executora.csv`:
  - empenhos do ano imediatamente anterior entram como `inscritos em RAP`
  - empenhos de anos anteriores entram como `reinscritos`
  - `RESTOS A PAGAR PAGOS` representa o valor executado/liquidado no exercicio atual
  - `RESTOS A PAGAR A PAGAR` representa o saldo atual remanescente do RAP
- a documentacao futura deve separar claramente:
  - import manual de arquivo
  - sincronizacao remota com API
  - enriquecimento local no banco
