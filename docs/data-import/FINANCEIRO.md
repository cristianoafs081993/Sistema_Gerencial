# FINANCEIRO

## Objetivo

Importar saldo disponivel por fonte e vinculacao para alimentar a tela [Financeiro.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Financeiro.tsx).

## Ponto de entrada

- pagina: [Financeiro.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Financeiro.tsx)
- service: [financeiroImportService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/financeiroImportService.ts)
- teste: [financeiroImportService.test.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/__tests__/financeiroImportService.test.ts)

## Arquivos aceitos

- `.csv`
- `.xlsx`
- `.xls`

## Regras de leitura

- tenta detectar UTF-16LE, UTF-16BE e UTF-8
- para CSV, escolhe `tab`, `;` ou `,`
- usa a primeira aba da planilha
- procura a linha de cabecalho pela presenca simultanea de:
  - `ug executora`
  - `saldo - r$`

## Colunas lidas por posicao

Depois que o cabecalho e encontrado, as colunas usadas sao:

- `0`: UG codigo
- `1`: UG nome
- `2`: mes lancamento
- `3`: fonte codigo
- `4`: fonte descricao
- `5`: vinculacao codigo
- `6`: vinculacao descricao
- `7`: saldo

## Transformacoes

- saldo monetario em padrao brasileiro e convertido para numero
- linhas sem UG, mes, fonte ou vinculacao sao descartadas
- para persistencia, o service consolida por:
  - `ug_codigo`
  - `mes_lancamento`
  - `fonte_codigo`
  - `vinculacao_codigo`

## Destino no banco

- tabela: `financeiro_fonte_vinculacao`
- chave de upsert:
  - `ug_codigo,mes_lancamento,fonte_codigo,vinculacao_codigo`

## Leitura para exibicao

- a tela carrega o `imported_at` mais recente
- reagrupa os dados por:
  - `fonteCodigo`
  - `vinculacaoCodigo`

## Arquivo de exemplo

- [4 - Financeiro.csv](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/4%20-%20Financeiro.csv)

## Riscos e observacoes

- o arquivo de exemplo salvo no repo parece ter cabecalho fora das primeiras linhas visiveis, entao a busca heuristica do cabecalho e parte do contrato
- a documentacao do layout do arquivo deve registrar a linha real do cabecalho e um exemplo validado
