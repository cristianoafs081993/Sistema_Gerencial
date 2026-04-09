# ENVIRONMENT

## Objetivo

Documentar as variaveis e pre-requisitos reais do projeto.

## Variaveis obrigatorias para o frontend

Definidas e validadas em [env.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/env.ts):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Sem elas:

- o cliente Supabase nao inicializa
- o fallback REST nao funciona
- chamadas a Edge Functions montadas pelo frontend falham

## Variaveis opcionais usadas pelo frontend

- `VITE_SIAFI_CONTA_PAGADORA`
  - default: `408034`
- `VITE_SIAFI_MACRO_CODIGO_FINAL`
  - default: `2200`

## Variaveis necessarias em funcoes e integracoes

### `analisar-liquidacao-siafi`

Necessarias no ambiente do Supabase:

- `OPENAI_API_KEY`
- opcional: `OPENAI_VISION_MODEL`

### `ingest-email-csv`

Necessarias no ambiente do Supabase:

- `SUPABASE_SERVICE_ROLE_KEY`
- `EMAIL_CSV_INGEST_SECRET`
- opcional: `EMAIL_CSV_ALLOWED_SENDERS`

Necessarias no Apps Script que varre o Gmail:

- `SUPABASE_FUNCTION_URL`
- `SUPABASE_ANON_KEY`
- `EMAIL_CSV_INGEST_SECRET`
- opcionais:
  - `GMAIL_CSV_QUERY`
  - `GMAIL_CSV_SUCCESS_LABEL`
  - `GMAIL_CSV_ERROR_LABEL`
  - `GMAIL_CSV_BATCH_SIZE`
  - `GMAIL_CSV_PIPELINE_HINT`

### Consultor

O frontend chama a function `consultor`, mas a implementacao nao foi localizada neste repo nesta rodada.
As variaveis exatas devem ser confirmadas no ambiente onde essa function esta publicada.

### `verificar-conformidade`

O frontend chama a function `verificar-conformidade`, mas a implementacao nao foi localizada neste repo nesta rodada.

## Arquivos relevantes

- [.env.example](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/.env.example)
- [env.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/env.ts)
- [supabase.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/supabase.ts)
- [supabaseRest.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/supabaseRest.ts)

## Problemas atuais

- `.env.example` ainda mistura credenciais do projeto com variaveis de um ambiente mais amplo de automacao.
- nem todas as integracoes externas tem contrato de segredo documentado no repo.

## Recomendacao

Separar conceitualmente:

- variaveis necessarias para rodar o frontend
- variaveis necessarias para publicar Edge Functions
- variaveis de ferramentas externas que nao sao essenciais ao sistema
- propriedades do Apps Script usadas para integracoes Gmail
