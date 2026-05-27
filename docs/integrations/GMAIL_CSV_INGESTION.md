# GMAIL CSV INGESTION

## Objetivo

Automatizar a ingestao dos CSVs recebidos por e-mail no Gmail, sem depender do upload manual na interface.

## Arquitetura

1. Um script do Google Apps Script consulta o Gmail por mensagens com anexo `.csv`.
2. Cada anexo e enviado para a Edge Function `ingest-email-csv`.
3. A function identifica o pipeline pelo assunto, nome do arquivo ou cabecalho do CSV.
4. O parser reaproveita as regras operacionais dos imports manuais e grava no Supabase.
5. Cada mensagem/anexo gera um registro em `email_csv_ingestion_runs` para idempotencia e auditoria.

## Edge Function

- local: [ingest-email-csv/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/ingest-email-csv/index.ts)
- tabela de rastreio: `email_csv_ingestion_runs`
- autenticacao adicional: header `x-email-ingest-secret`

## Pipelines suportados por e-mail

- `financeiro`
- `lc`
- `retencoes_efd_reinf`
- `descentralizacoes`
- `descentralizacoes_conta_saldos`
- `documentos_habeis`
- `liquidacoes`
- `ordens_bancarias`
- `situacoes_documentos`
- `creditos_disponiveis`
- `siafi_empenhos`

## Regras de roteamento

- prioridade 1: assunto com hint explicito, por exemplo `[pipeline:financeiro]`
- prioridade 2: nome do arquivo
- prioridade 3: cabecalho do CSV

Se a deteccao automatica falhar, a function retorna erro e o e-mail deve ficar com label de falha para revisao.

## Fluxos que continuam sensiveis

- PFs continuam fora desse fluxo porque o processo atual depende de dois arquivos correlacionados.
- Devolucoes de descentralizacoes continuam exigindo validacao operacional separada; o fluxo de e-mail automatiza o CSV principal de descentralizacoes.
- A conta de descentralizacoes e aceita como fluxo agregado separado quando o arquivo/assunto indicar conta de descentralizacoes; esse pipeline grava `descentralizacoes_conta_saldos`, nao a tabela detalhada `descentralizacoes`.
- No pipeline `descentralizacoes`, a ingestao por e-mail aplica a mesma regra do upload principal: `NC Celula - Tipo = DESTINO` entra positivo; `ORIGEM` so entra negativo em anulacao; `ORIGEM` sem anulacao e ignorado; quando a coluna de tipo nao existir, a ingestao conserva a regra historica e ignora origens inferidas em pares `339000` mais outra natureza da mesma NC/data/descricao/PTRES/PI/valor.
- Em relatorios de credito disponivel e conta de descentralizacoes, a terceira coluna de valor pode vir sem cabecalho; a ingestao so grava linhas com valor efetivamente preenchido e parseavel para evitar sobrescrever saldos com zero por coluna nao reconhecida.
- Em `retencoes_efd_reinf`, alguns exports reais deixam o nome do credor na coluna sem cabecalho apos `DH - Credor` e o valor da retencao na ultima coluna sem cabecalho; a ingestao por e-mail usa essas colunas sem nome como `dhCredorNome` e `valorRetencao`, e tambem normaliza variacoes de `DH Item - Liquidado (S/N)`.

## Script do Gmail

- local: [gmailCsvIngress.gs](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/scripts/google-apps-script/gmailCsvIngress.gs)
- propriedades esperadas no Apps Script:
  - `SUPABASE_FUNCTION_URL`
  - `SUPABASE_ANON_KEY`
  - `EMAIL_CSV_INGEST_SECRET`
  - `GMAIL_CSV_QUERY`
  - `GMAIL_CSV_SUCCESS_LABEL`
  - `GMAIL_CSV_ERROR_LABEL`
  - `GMAIL_CSV_BATCH_SIZE`
  - `GMAIL_CSV_PIPELINE_HINT`

## Diagnostico do Apps Script

O script inclui a funcao `diagnoseCsvEmailIngestion()` para isolar problemas de configuracao sem ingerir arquivo.
Ela registra no Logger:

- resumo mascarado de `SUPABASE_FUNCTION_URL`, `SUPABASE_ANON_KEY` e `EMAIL_CSV_INGEST_SECRET`
- quantidade de threads retornadas por `GMAIL_CSV_QUERY`
- quantidade de anexos CSV na primeira thread encontrada
- status HTTP e corpo retornado pela Edge Function

Resultado esperado quando URL, anon key e segredo estao corretos:

- HTTP `400` com erro de attachment ausente, porque o diagnostico nao envia arquivo real

Resultados que indicam erro de configuracao:

- HTTP `401`: `EMAIL_CSV_INGEST_SECRET` ausente/invalido ou problema no token enviado ao gateway
- HTTP `404`: `SUPABASE_FUNCTION_URL` incorreta ou function nao publicada
- `terminaComFunctionPath=false`: `SUPABASE_FUNCTION_URL` nao termina com `/functions/v1/ingest-email-csv`

## Operacao recomendada

- criar um gatilho time-driven no Apps Script para executar a cada 5 minutos
- filtrar apenas a caixa/label operacional que recebe os CSVs
- usar labels de sucesso e erro para evitar reprocessamento desnecessario
- quando necessario, forcar o pipeline pelo assunto do e-mail

## Observacoes de seguranca

- a Edge Function deve validar `EMAIL_CSV_INGEST_SECRET`
- `EMAIL_CSV_ALLOWED_SENDERS` pode restringir remetentes aceitos
- a function usa `SUPABASE_SERVICE_ROLE_KEY` para escrever no banco e registrar auditoria
