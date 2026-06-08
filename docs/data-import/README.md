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
- [ENERGIA.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/data-import/ENERGIA.md)
- [CREDITOS_DISPONIVEIS.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/data-import/CREDITOS_DISPONIVEIS.md)

## Fixture files uteis

Arquivos reais de operacao presentes em [docs](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs):

- `4 - Financeiro.csv`
- `7 - LC.csv`
- `2 - Descentralizacoes.csv`
- `NC-ATUALIZADA.csv`
- `Exec_NE_Exercicio_RAP_UG_Executora.csv`
- `3 - Credito Disponivel.csv`
- `PFs.xlsx`
- `PFs - liberacao de recurso.xlsx`
- `Relatorio.xlsx`
- `Relatorio (1).xlsx`

## Observacoes importantes do dominio de descentralizacoes

- o upload principal de `Descentralizacoes.tsx` agora pode receber as colunas `NC`, `NC Celula - Tipo` e `NC - Operacao (Tipo)` alem das colunas historicas
- quando a coluna `NC` vier completa, o parser consome a forma resumida no padrao `2026NC000001`
- quando `NC Celula - Tipo` existir, ela tem precedencia sobre descricao e operacao: rotulos que contenham `DESTINO` sempre entram positivos; rotulos que contenham `ORIGEM` so entram negativos quando `NC - Operacao (Tipo)` indicar `ANULACAO DE DESCENTRALIZACAO DE CREDITO`; `ORIGEM` sem anulacao e ignorado
- quando `NC Celula - Tipo` nao existir, o parser preserva a regra historica de anulacao/devolucao negativa; em exports sem tipo que tragam o mesmo par de NC/data/descricao/PTRES/PI/valor em `339000` e outra natureza numa descentralizacao normal, a linha `339000` e tratada como destino e a outra natureza e ignorada como origem inferida
- o `NC Celula - Plano Interno` continua fazendo parte da identidade de cada linha importada; a mesma NC pode gerar mais de um registro quando vier quebrada em planos internos diferentes
- o upload principal persiste `nota_credito` e `operacao_tipo` para reconciliar reimportacoes sem perder a distincao entre linhas com o mesmo valor
- se uma reimportacao nova encontrar um lancamento legado com a mesma data, PTRES, natureza, PI e valor, mas ainda sem `nota_credito`, o import deve atualizar esse registro legado com a NC em vez de criar uma segunda linha
- o botao `Importar Devolucoes` da mesma pagina continua sendo um fluxo separado e nao deve ser alterado em conjunto com o upload principal
- esse segundo fluxo grava uma nova linha negativa em `descentralizacoes`, com `operacao_tipo = DEVOLUCAO`, em vez de recalcular ou sobrescrever um lancamento anterior
- esse segundo fluxo pode continuar recebendo valores negativos diretamente no CSV, mas o service normaliza o valor para negativo antes de persistir
- o botao `Importar Conta` da mesma pagina aceita o relatorio `PTRES / Metrica / Valor` e grava os saldos agregados em `descentralizacoes_conta_saldos`
- no export real dessa conta, o cabecalho pode vir apenas com `PTRES` e `Metrica`, deixando o valor na terceira coluna sem nome; o parser precisa aceitar esse formato
- o parser desse upload so considera linhas com `PTRES` e `Valor` realmente preenchidos e parseaveis; linhas vazias ou com valor invalido sao descartadas para evitar gravacao indevida de saldo `0`
- esses saldos de conta servem apenas para os somatorios geral, por PTRES e por dimensao; a tabela de lancamentos individuais continua vindo de `descentralizacoes`
- quando um mesmo `PTRES` aparecer em mais de uma dimensao nos lancamentos detalhados, o saldo da conta e repartido proporcionalmente entre elas para montar o agregado por dimensao

## Regras gerais observadas no codigo

- os parsers tentam lidar com UTF-8, UTF-16LE, UTF-16BE e em alguns casos Latin-1
- o separador pode variar entre `;`, `,` e `tab`
- alguns modulos procuram o cabecalho real pela presenca de palavras-chave
- alguns modulos aceitam XLSX na UI, mas nao necessariamente no parser real
- parte da importacao usa heuristicas de normalizacao de colunas
- o upload de `Empenhos.tsx` agora tambem aceita um CSV especifico de saldo de RAP com cabecalho `NE CCor` + `Metrica`; nesse formato o parser atualiza apenas `saldo_rap_oficial`

## Historico anual de RAP

- a aba `RAP` do dashboard possui uma importacao propria para o CSV historico agregado de restos a pagar
- esse fluxo usa `src/services/rapHistoricoAnual.ts` e `src/utils/rapHistoricoAnual.ts`
- o parser localiza o cabecalho real com `UG Executora`, `NE CCor - Ano Emissao`, `Metrica` e `Item Informacao`, mesmo quando o arquivo traz titulo e filtro antes da tabela
- a coluna de valor pode vir sem nome, logo apos o nome do item de informacao
- linhas de total geral sao ignoradas; linhas validas exigem UG, ano numerico, item de informacao e valor parseavel
- o destino e `rap_historico_anual`; cada upload cria um novo `import_batch_id` e a UI sempre le o lote mais recente
- essa pipeline e separada do upload de saldos por NE em `Empenhos.tsx` e nao altera os campos RAP da tabela `empenhos`
- a visao anual do dashboard usa item `50` como total quando existir; se o total nao vier no ano, usa a soma dos componentes `35`, `40` e `41`

## Saldos SIAFI de empenhos

- o upload manual em `Empenhos.tsx` usa `src/lib/siafi-parser.ts`
- a ingestao automatica por e-mail usa `src/lib/emailCsvIngestion.ts`
- os dois fluxos devem aceitar o layout `Exec_NE_Exercicio_RAP_UG_Executora.csv` e o layout virgulado com colunas `RESTOS A PAGAR ... (PROC E N PROC)`
- o valor liquidado do exercicio vem de `DESPESAS LIQUIDADAS (CONTROLE EMPENHO)`
- o valor pago do exercicio vem de `DESPESAS PAGAS (CONTROLE EMPENHO)`
- quando o CSV traz coluna de emissao do empenho (`Data Emissao`, `Data de Emissao`, `Dia Emissao` ou variacoes com prefixo `NE CCor -`), os fluxos manual e automatico gravam esse valor em `empenhos.data_empenho`
- se o CSV SIAFI nao trouxer data de emissao, empenhos criados pelo reprocessamento usam `01/01` do ano da NE apenas como fallback; para o grafico de evolucao mensal ficar correto, reimporte com a coluna de emissao ou faca backfill de `empenhos.data_empenho`
- empenhos de exercicio ausentes no banco devem ser criados no reprocessamento, nao apenas os RAP

## Automacao por e-mail

- a automacao por Gmail foi centralizada na Edge Function `ingest-email-csv`
- o roteamento do anexo depende do assunto, do nome do arquivo e do cabecalho real do CSV
- hoje o fluxo automatizado cobre os pipelines CSV de arquivo unico
- o CSV de conta agregada de descentralizacoes recebido por e-mail e tratado como pipeline proprio e grava `descentralizacoes_conta_saldos`; a terceira coluna de valor pode vir sem cabecalho
- nos CSVs de credito disponivel recebidos por e-mail, linhas sem valor preenchido ou parseavel sao ignoradas para nao sobrescrever saldos com zero
- o upload manual em `/credito-disponivel` tambem aceita o relatorio detalhado `PTRES / PI / descricao / Metrica / Valor`, ainda que descricao e valor venham em colunas sem cabecalho; ele persiste snapshots em `creditos_disponiveis_detalhes` e mantem o agregado legado por PTRES
- PFs continuam fora da automacao porque exigem correlacao entre dois arquivos
