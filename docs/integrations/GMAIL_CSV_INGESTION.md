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

## Operacao recomendada

- criar um gatilho time-driven no Apps Script para executar a cada 5 minutos
- filtrar apenas a caixa/label operacional que recebe os CSVs
- usar labels de sucesso e erro para evitar reprocessamento desnecessario
- quando necessario, forcar o pipeline pelo assunto do e-mail

## Observacoes de seguranca

- a Edge Function deve validar `EMAIL_CSV_INGEST_SECRET`
- `EMAIL_CSV_ALLOWED_SENDERS` pode restringir remetentes aceitos
- a function usa `SUPABASE_SERVICE_ROLE_KEY` para escrever no banco e registrar auditoria
