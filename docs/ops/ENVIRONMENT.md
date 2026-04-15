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

## Variável recomendada para convites

- `VITE_APP_ORIGIN`
  - origem pública do frontend, por exemplo `https://sistema-gerencial-gamma.vercel.app`
  - usada para montar o `redirectTo` dos convites como `/auth?mode=invite&next=/`

Sem ela:

- o app usa a origem da janela atual quando ela não for local
- se a origem atual for `localhost`, o frontend bloqueia o envio do convite para evitar e-mails com link local

## Configuracao obrigatoria no Supabase Auth

Nao ha novas variaveis de frontend para o login por e-mail e senha.
Mas o projeto Supabase precisa estar configurado com:

- provider `Email` habilitado no Supabase Auth
- o usuario `cristiano.cnrn@gmail.com` existente no Auth como superadministrador
- template e redirect URLs aceitando o retorno para `/auth`
- politicas e tabelas que exigem sessao usando o papel `authenticated`

Sem isso:

- o login por `signInWithPassword` falha
- o fluxo de convite nao conclui o primeiro acesso
- as rotas protegidas redirecionam continuamente para `/auth`

## Variaveis opcionais usadas pelo frontend

- `VITE_SIAFI_CONTA_PAGADORA`
  - default: `408034`
- `VITE_SIAFI_MACRO_CODIGO_FINAL`
  - default: `2200`
- `VITE_APP_ORIGIN`
  - sem default
  - recomendada para qualquer ambiente que possa enviar convites de usuário

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

### `invite-user`

Necessarias no ambiente do Supabase:

- `SUPABASE_SERVICE_ROLE_KEY`

Observacoes operacionais:

- o projeto Supabase precisa aceitar o `redirectTo` usado pelo app, por exemplo `https://sistema-gerencial-gamma.vercel.app/auth?mode=invite&next=/`
- o frontend usa `VITE_APP_ORIGIN` quando configurada; se ela não existir, usa a origem atual apenas quando ela não for local
- o frontend bloqueia o envio quando o `redirectTo` resultante apontar para `localhost` ou loopback
- para o usuario concluir o convite, o cliente do frontend precisa manter `detectSessionInUrl` habilitado
- no estado atual, a function aceita convites apenas do usuario `cristiano.cnrn@gmail.com`

### `admin-users`

Necessarias no ambiente do Supabase:

- `SUPABASE_SERVICE_ROLE_KEY`

Observacoes operacionais:

- a function valida o JWT recebido do frontend e aceita apenas chamadas do superadministrador
- a criacao direta de usuarios usa a senha padrao `ifrn` e marca `user_metadata.uses_default_password = true`
- `supabase/config.toml` deve manter `verify_jwt = false` para `admin-users`, pois a validacao ocorre dentro da function

### `sync-contratos-comprasnet`

Necessarias no ambiente do Supabase:

- `SUPABASE_SERVICE_ROLE_KEY`

Opcional:

- `CONTRATOS_SYNC_SECRET`
  - se configurada, chamadas HTTP precisam enviar o header `x-contratos-sync-secret`
  - se nao configurada, o cron criado pela migration consegue chamar a function sem header adicional

Pre-requisitos no banco:

- Supabase Cron (`pg_cron`)
- `pg_net`

Observacoes operacionais:

- `supabase/config.toml` deve manter `verify_jwt = false` para `sync-contratos-comprasnet`, pois a chamada periodica vem do cron
- a migration agenda chamada a cada 6 horas para a UG `158366`

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
