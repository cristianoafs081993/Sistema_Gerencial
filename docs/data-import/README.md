# DATA IMPORT

Esta pasta documenta os contratos de entrada baseados em arquivos.

## Por que esta pasta e critica

Neste sistema, varios fluxos importantes dependem de CSV, XLSX, JSON e PDF. Isso significa que o contrato de dados nao esta apenas em APIs e tabelas. Ele esta tambem:

- no cabecalho do arquivo
- na codificacao do arquivo
- no separador CSV
- na linha em que o cabecalho realmente aparece
- nas regras de limpeza e deduplicacao
- nas chaves de upsert

Sem isso, uma IA tende a errar porque tenta inferir o contrato lendo somente a UI ou o schema.

## Arquivos desta pasta

- [PIPELINE_MATRIX.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/data-import/PIPELINE_MATRIX.md)
- [FINANCEIRO.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/data-import/FINANCEIRO.md)
- [LC.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/data-import/LC.md)
- [PFS.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/data-import/PFS.md)
- [RETENCOES_EFD_REINF.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/data-import/RETENCOES_EFD_REINF.md)
- [DOCUMENTOS_HABEIS_E_LIQUIDACOES.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/data-import/DOCUMENTOS_HABEIS_E_LIQUIDACOES.md)

## Fixture files uteis

Arquivos reais de operacao presentes em [docs](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs):

- `4 - Financeiro.csv`
- `7 - LC.csv`
- `2 - Descentralizacoes.csv`
- `NC-ATUALIZADA.csv`
- `Exec_NE_Exercicio_RAP_UG_Executora.csv`
- `PFs.xlsx`
- `PFs - liberacao de recurso.xlsx`
- `Relatorio (3).xlsx`
- `Relatorio (4).xlsx`

## Observacoes importantes do dominio de descentralizacoes

- o upload principal de `Descentralizacoes.tsx` agora pode receber as colunas `NC` e `NC - Operacao (Tipo)` alem das colunas historicas
- quando a coluna `NC` vier completa, o parser consome a forma resumida no padrao `2026NC000001`
- quando `NC - Operacao (Tipo)` indicar `ANULACAO DE DESCENTRALIZACAO DE CREDITO`, o valor de `NC Celula - Valor` deve entrar como negativo no upload principal
- o botao `Importar Devolucoes` da mesma pagina continua sendo um fluxo separado e nao deve ser alterado em conjunto com o upload principal
- esse segundo fluxo pode continuar recebendo valores negativos diretamente no CSV

## Regras gerais observadas no codigo

- os parsers tentam lidar com UTF-8, UTF-16LE, UTF-16BE e em alguns casos Latin-1
- o separador pode variar entre `;`, `,` e `tab`
- alguns modulos procuram o cabecalho real pela presenca de palavras-chave
- alguns modulos aceitam XLSX na UI, mas nao necessariamente no parser real
- parte da importacao usa heuristicas de normalizacao de colunas

## Automacao por e-mail

- a automacao por Gmail foi centralizada na Edge Function `ingest-email-csv`
- o roteamento do anexo depende do assunto, do nome do arquivo e do cabecalho real do CSV
- hoje o fluxo automatizado cobre os pipelines CSV de arquivo unico
- PFs continuam fora da automacao porque exigem correlacao entre dois arquivos
