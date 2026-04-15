# SUPABASE_FUNCTIONS

## Functions identificadas no repo

### `ingest-email-csv`

Local:

- [ingest-email-csv/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/ingest-email-csv/index.ts)

Uso:

- recebe anexos CSV vindos do Gmail via Apps Script
- detecta o pipeline por hint, nome do arquivo ou cabecalho
- grava o resultado em `email_csv_ingestion_runs` e na tabela final do dominio

Dependencias:

- `SUPABASE_SERVICE_ROLE_KEY`
- `EMAIL_CSV_INGEST_SECRET`
- opcional `EMAIL_CSV_ALLOWED_SENDERS`

### `analisar-liquidacao-siafi`

Local:

- [analisar-liquidacao-siafi/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/analisar-liquidacao-siafi/index.ts)

Chamador:

- [suapProcessos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/suapProcessos.ts)

Entrada esperada:

- dados do processo
- `nsNumero`
- screenshots em `dataUrl`

Saida:

- objeto de analise com `statusGeral`, `resumo`, `recomendacao` e `itens`

Dependencias:

- `OPENAI_API_KEY`
- opcional `OPENAI_VISION_MODEL`

### `invite-user`

Local:

- [invite-user/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/invite-user/index.ts)

Chamador:

- [authInvites.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/authInvites.ts)

Uso:

- envia convite de acesso por e-mail via `auth.admin.inviteUserByEmail`
- valida o usuario autenticado a partir do JWT recebido pelo frontend
- restringe o disparo ao superadministrador `cristiano.cnrn@gmail.com`
- e publicada com `verify_jwt = false`, porque a validacao do token ocorre dentro da function
- recebe do frontend um `redirectTo` montado com `VITE_APP_ORIGIN` quando configurado

Dependencias:

- `SUPABASE_SERVICE_ROLE_KEY`

Observacao:

- se `VITE_APP_ORIGIN` não estiver configurada e a aplicação estiver aberta em `localhost` ou loopback, o frontend bloqueia o envio para impedir convites com link local

### `admin-users`

Local:

- [admin-users/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/admin-users/index.ts)

Chamador:

- [userAdmin.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/userAdmin.ts)

Uso:

- lista usuarios do Supabase Auth e seus grupos
- cria usuarios por e-mail com senha padrao `ifrn`
- envia convite opcional e associa o usuario ao grupo escolhido
- cria ou atualiza grupos de usuarios e permissoes de tela

Dependencias:

- `SUPABASE_SERVICE_ROLE_KEY`

Observacao:

- e publicada com `verify_jwt = false`, porque a validacao do token ocorre dentro da function
- somente o superadministrador pode executar acoes administrativas
- usuarios criados diretamente recebem `user_metadata.uses_default_password = true`

### `sync-contratos-comprasnet`

Local:

- [sync-contratos-comprasnet/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/sync-contratos-comprasnet/index.ts)

Uso:

- sincroniza contratos da UG `158366` a partir de `https://contratos.comprasnet.gov.br/api`
- busca contratos ativos, inativos, historico, empenhos, faturas e itens
- deriva vinculos fatura-item de `dados_item_faturado`
- deriva vinculos fatura-empenho de `dados_empenho`
- grava contadores e falhas em `contratos_api_sync_runs`

Dependencias:

- `SUPABASE_SERVICE_ROLE_KEY`
- opcional `CONTRATOS_SYNC_SECRET` para exigir o header `x-contratos-sync-secret`

Observacao:

- publicada com `verify_jwt = false`, pois o cron chama a function por HTTP e a function usa service role apenas internamente
- a migration agenda `sync-contratos-comprasnet-6h` com Supabase Cron/pg_net para executar a cada 6 horas
- a primeira versao aceita apenas a UG `158366`

## Functions chamadas pelo frontend, mas nao localizadas neste repo

### `consultor`

Chamador:

- [Consultor.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Consultor.tsx)

Observacao:

- o frontend monta a URL para `functions/v1/consultor`
- a implementacao nao foi localizada em `supabase/functions`
- a base semantica de normativos consumida pelo Consultor e o backlog de ingestao estao documentados em [NORMATIVOS_CONSULTOR_INGESTION.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/integrations/NORMATIVOS_CONSULTOR_INGESTION.md)

### `verificar-conformidade`

Chamador:

- [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx)

Observacao:

- a function e invocada por `supabase.functions.invoke`
- a implementacao nao foi localizada em `supabase/functions`

## Recomendacao operacional

Antes de manutencao em modulos dependentes de IA:

1. confirmar quais functions existem no projeto Supabase real
2. confirmar segredos configurados em cada function
3. alinhar repo e ambiente publicado para evitar drift

Para a automacao do Gmail:

1. confirmar que a function `ingest-email-csv` foi publicada
2. confirmar que o Apps Script aponta para a URL correta da function
3. validar se `verify_jwt` e a estrategia de chamada externa estao alinhados com o ambiente real
