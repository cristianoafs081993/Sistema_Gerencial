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

CSV recomendado no download SIAFI: `8 - Documentos Hábeis.csv` (tabulado). O importador reconhece os cabeçalhos oficiais `Documento Hábil`, `DH - Processo`, `DH - Estado` e `DH - Valor Doc.Origem`; valores da coluna sem título após `Métrica` são usados como valor da situação/item quando presentes.

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

CSV recomendado: `9 - Liquidações.csv`. O cabeçalho oficial costuma começar na segunda linha e contém `Documento Origem`, `NE CCor` e `Fonte SOF`. O arquivo `1 - Documentos.csv` também contém campos semelhantes, mas não deve ser combinado sem comparar os vínculos: pode divergir do relatório de liquidações.

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

CSV recomendado: `12 - Ordens Bancárias (5).csv`. O arquivo `20 - Ordens Bancárias (OP).csv` é de ordens de pagamento e não traz o documento de origem nem as colunas de valores pagos exigidas por este importador.

Regras de data:

- `Dia Lancamento` e gravado em `documentos_habeis_itens.data_emissao` e representa a data de pagamento da OB vinculada a NP/RP.
- A auditoria FD-Reinf de `Prazo inconsistente` usa `DH - Dia Pagamento` do arquivo de retencoes como inicio da janela e o dia 20 do mes seguinte como limite.

### 4. Situacoes / Retencoes

- entrada: JSON ou CSV tabulado
- handler: `retencoesService.upsertSituacoesBatch`
- tabela impactada:
  - `documentos_habeis_situacoes`

Campos esperados na UI:

- `Documento Habil`
- `DH - Situacao`
- `DH - Valor Doc.Origem`

CSV recomendado: `21 -Retenções por NP.csv`. O importador converte `Documento Hábil`, `DH - Situação` e `DH - Valor Doc.Origem` para os campos de situação persistidos no banco, em vez de enviar os cabeçalhos do relatório como nomes de coluna.

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
- no import de Ordens Bancarias, o item `OB` fica vinculado ao documento habil por `Documento Origem`
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
