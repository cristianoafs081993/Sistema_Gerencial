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

Observacao: contas bancarias podem conter digito verificador alfanumerico, como `7456-X`. O valor bruto continua importado como texto; para comparacao, copia e macro SIAFI, o fluxo remove pontuacao e usa `7456X`, preservando o `X`.

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
O sistema extrai os bolsistas e compara com a base carregada na LC. Suporta estes formatos de PDFs:

1. **Layout com Rótulos (Format A)**:
   - Apresenta informações de 1 bolsista por bloco com rótulos descritivos (ex: `CPF`, `Dados bancários Banco`, `Agência`, `Conta`).
   - O valor da bolsa é uniforme para o documento e extraído de frases como `corresponde a R$ [valor]`.
2. **Layout de Tabela (Format B)**:
   - Apresenta os bolsistas listados em uma grade com cabeçalho (contendo `MATRÍCULA`, `VALOR REFERÊNCIA` ou similar).
   - Extrai automaticamente CPF, Banco, Agencia, Operacao opcional, Conta e Valor individual de cada linha. A Operacao do PDF nao compoe a conta e e ignorada no fluxo operacional.

3. **Layout PAFE com dados bancarios (Format C)**:
   - Apresenta cabecalho com `NOME`, `MATRICULA`, `SETOR`, `TURNO`, `VR R$`, `CPF` e `DADOS BANCARIOS`.
   - Extrai valor antes do CPF e, depois dele, Banco, Agencia, Operacao opcional e Conta. A Operacao do PDF e ignorada; a conta e preservada com pontuacao e `X`.

O fluxo de comparação gera pendências de cruzamento e permite ao usuário:
- Copiar blocos formatados de 7 alunos (com destaque em amarelo na 7ª linha) no mesmo padrão de leiaute da macro `.mac` para colagem direta (via Shift+Insert). Os campos são concatenados continuamente sem nenhum espaçador ou tabulador (CPF com 14, Banco com 3, Agência com 4, Operação/Resto com 24, Conta preenchida com 20 caracteres com zeros à esquerda, e Valor em centavos como última coluna). Isso garante o preenchimento exato de cada coluna limite do emulador, ativando o recurso de "auto-tab" nativo do SIAFI em cada transição de campo sem risco de pulos ou desalinhamentos.
- Gerar e baixar arquivo de macro `.mac` para preenchimento automatizado no SIAFI.

## Arquivo de exemplo

- [7 - LC.csv](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/7%20-%20LC.csv)

## Riscos e observacoes

- valores `-9` fazem parte do contrato de descarte
- a especificação de formatos de PDFs suportados foi unificada e integrada ao parser dinâmico.
