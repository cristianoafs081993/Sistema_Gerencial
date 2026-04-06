# LC

## Objetivo

Importar Lista de Credores, exibir a base carregada, comparar com PDFs de pagamento e gerar macro SIAFI.

## Ponto de entrada

- pagina: [LC.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/LC.tsx)
- import service: [lcImportService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/lcImportService.ts)
- comparacao: [lcComparisonService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/lcComparisonService.ts)
- extracao PDF: [bolsistasPdfService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/bolsistasPdfService.ts)
- macro SIAFI: [siafiMacroService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/siafiMacroService.ts)

## Arquivos aceitos para LC

- `.csv`
- `.xlsx`
- `.xls`

## Regras de leitura

- tenta detectar UTF-16LE, UTF-16BE e UTF-8
- para CSV, escolhe `tab`, `;` ou `,`
- usa a primeira aba
- procura o cabecalho pela presenca de:
  - `ob - lista credores`
  - `ob/lc - sequencial`

## Colunas lidas por posicao

- `0`: `obListaCredores`
- `1`: `sequencial`
- `2`: `favorecidoDocumento`
- `3`: `favorecidoNome`
- `4`: `bancoCodigo`
- `5`: `bancoNome`
- `6`: `agenciaCodigo`
- `7`: `agenciaNome`
- `8`: `contaBancaria`

## Regras de descarte

Linhas sao descartadas quando:

- `obListaCredores` e vazio ou `-9`
- `sequencial` e vazio ou `-9`
- `favorecidoDocumento` e vazio ou `-9`
- `sequencial` nao e numerico

## Destino no banco

- tabela: `lc_credores`
- chave de upsert:
  - `ob_lista_credores,sequencial`

## Fluxos derivados

### Consolidacao por CPF

A tela monta uma visao consolidada por documento do favorecido e escolhe a melhor linha quando ha duplicidade.

### Comparacao com PDFs

O usuario envia PDFs de pagamento.
O sistema:

- extrai bolsistas e contas bancarias dos PDFs
- compara com a LC
- gera pendencias
- opcionalmente gera macro `.mac` para SIAFI

## Arquivo de exemplo

- [7 - LC.csv](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/7%20-%20LC.csv)

## Riscos e observacoes

- valores `-9` fazem parte do contrato de descarte
- a documentacao futura deve registrar explicitamente o formato esperado dos PDFs que entram na comparacao
