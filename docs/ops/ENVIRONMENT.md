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
- `VITE_SUAP_CLIENT_ID`
  - opcional; se ausente, usa o client OAuth SUAP de producao embutido no frontend
  - em desenvolvimento local, deve apontar para um client SUAP separado cujo redirect seja `http://localhost:5173/suap-callback`
- `VITE_APP_ORIGIN`
  - sem default
  - recomendada para qualquer ambiente que possa enviar convites de usuário
- `PORTAL_TRANSPARENCIA_API_KEY` ou `VITE_PORTAL_TRANSPARENCIA_API_KEY`
  - chave `chave-api-dados` do Portal da Transparencia
  - usada pelo proxy local do Vite para injetar a credencial nas chamadas `/api-transparencia`; se ausente, o proxy usa o fallback operacional atual do codigo

## Variaveis necessarias em funcoes e integracoes

### `suap-token-exchange`

Necessarias no ambiente do Supabase:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUAP_CLIENT_SECRET`

Opcionais:

- `SUAP_CLIENT_ID`
  - client OAuth SUAP padrao de producao
- `SUAP_DEV_CLIENT_ID`
  - client OAuth SUAP usado pelo frontend local via `VITE_SUAP_CLIENT_ID`
- `SUAP_DEV_CLIENT_SECRET`
  - secret correspondente ao `SUAP_DEV_CLIENT_ID`

Observacoes operacionais:

- o frontend envia o `clientId` usado no login para a function; a function escolhe `SUAP_DEV_CLIENT_SECRET` quando esse `clientId` corresponde a `SUAP_DEV_CLIENT_ID`, sem afetar o client de producao.
- o cadastro do client SUAP local deve aceitar `http://localhost:5173/suap-callback`, e o Supabase Auth tambem precisa aceitar essa URL como redirect.

### `analisar-liquidacao-siafi`

Necessarias no ambiente do Supabase:

- `OPENAI_API_KEY`
- opcional: `OPENAI_VISION_MODEL`

### `validar-pesquisa-precos`

Necessarias no ambiente do Supabase:

- `SUPABASE_SERVICE_ROLE_KEY`

Observacoes operacionais:

- a function usa service role para validar QR Code de relatório contra o snapshot salvo sem depender da RLS do usuário que abriu o link
- não exige nova variável no frontend

### `gerar-contrato-licitacao`

Necessarias no ambiente do Supabase:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`

Opcional:

- `GEMINI_CONTRACT_MODEL`
  - default no codigo: `gemini-2.0-flash`

Observacoes operacionais:

- a function consome Gemini via REST e espera receber do frontend o modelo de contrato ja extraido do PDF
- o frontend bloqueia a chamada quando o processo nao tiver `pdf_url`, quando o PDF nao trouxer texto pesquisavel ou quando nao houver minuta/termo de contrato identificavel
- esta versao ainda nao suporta OCR para PDF escaneado

### `gerar-termo-referencia-compras`

Necessarias no ambiente do Supabase:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`

Opcional:

- `GEMINI_REFERENCE_TERM_MODEL`
  - default no codigo: `gemini-2.5-flash-lite`
  - a function ainda tenta fallback automatico para `gemini-2.5-flash` quando o modelo configurado falha

Observacoes operacionais:

- a function consome Gemini via REST e espera receber do frontend o modelo DOCX ativo ja parseado em `document_templates`
- o modelo ativo tambem pode trazer `questionnaire_schema`; esse JSON e preenchido no frontend antes da chamada final e nao exige novo segredo de ambiente
- o frontend bloqueia a chamada quando nao houver modelo ativo para `termo-referencia-compras`; quando o TR nasce de ETP manual, o processo SUAP pode ser nulo e o contexto vem do ETP editado no editor
- esta versao ainda nao suporta OCR para PDF escaneado
- `supabase/config.toml` deve manter `verify_jwt = false` para `gerar-termo-referencia-compras`, conforme o deploy atual do projeto

### `gerar-etp-servicos-continuos`

Necessarias no ambiente do Supabase:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`

Opcional:

- `GEMINI_ETP_MODEL`
  - default no codigo: `gemini-2.5-flash-lite`
  - fallback automatico para `gemini-2.5-flash`

Observacoes operacionais:

- a function consome Gemini via REST e espera receber o questionario fixo do ETP, respostas do usuario, objeto manual opcional, trechos do PDF do processo quando houver, snippets auxiliares extraidos no navegador de anexos locais opcionais PDF, XLSX, XLS, ODS, CSV, TXT, MD e DOCX e contexto institucional do campus com `sourceType: "institucional"` para pano de fundo, sem cita-lo como anexo ou fonte
- anexos auxiliares opcionais sao apoio para localizar informacoes pontuais e nao devem redefinir foco, escopo ou narrativa principal do ETP
- quando nao houver chave Gemini, a function devolve fallback local com respostas e pendencias, permitindo revisao manual no editor
- quando a function ainda nao estiver publicada ou falhar por indisponibilidade/CORS, o frontend tambem usa fallback local com respostas e pendencias
- esta versao nao usa modelo DOCX para o ETP, nao persiste rascunhos no banco, nao persiste anexos auxiliares e nao suporta OCR
- `supabase/config.toml` deve manter `verify_jwt = false` para `gerar-etp-servicos-continuos`, conforme o padrao das functions do Editor de Documentos

### `gerar-mapa-riscos-licitacao`

Necessarias no ambiente do Supabase:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`

Opcional:

- `GEMINI_RISK_MAP_MODEL`
  - default no codigo: `gemini-2.5-flash-lite`

Observacoes operacionais:

- a function recebe snippets do ETP editado e devolve HTML editavel com matriz de riscos
- quando a function ainda nao estiver publicada ou falhar por indisponibilidade/CORS, o frontend usa fallback local em `riskMapsService`
- `supabase/config.toml` deve manter `verify_jwt = false` para `gerar-mapa-riscos-licitacao`

### Fotos de ocorrencias de manutencao

Nao exige nova variavel de ambiente.

Observacoes operacionais:

- o frontend usa as credenciais publicas ja configuradas para o Supabase
- a migration `20260612123000_add_manutencao_ocorrencia_fotos.sql` cria o bucket privado `manutencao-ocorrencias`, o limite de 5 MB e as policies de upload publico e leitura autenticada
- a tabela `manutencao_ocorrencias` guarda somente `foto_path`; o acesso administrativo usa URL assinada temporaria

### `sugerir-respostas-etp-servicos-continuos`

Necessarias no ambiente do Supabase:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`

Opcionais:

- `GEMINI_ETP_PREFILL_MODEL`
- `GEMINI_ETP_MODEL`

Observacoes operacionais:

- a function so sugere respostas quando recebe trechos do PDF/texto do processo e consegue apontar fonte, trecho-fonte e justificativa; anexos auxiliares e contexto institucional sao filtrados deste fluxo
- anexos auxiliares como CCT, planilhas ou memorias ficam apenas como apoio pontual para redacao/revisao de secoes e nao devem preencher automaticamente perguntas do questionario
- anexos auxiliares opcionais nao exigem novo segredo de ambiente: o frontend extrai texto com `pdfjs-dist`, `xlsx`, `cfb` e `TextDecoder`, nao envia o arquivo bruto, nao usa Storage e nao persiste o conteudo
- se a sugestao falhar ou a function nao estiver publicada, o frontend continua pelo questionario manual
- `supabase/config.toml` deve manter `verify_jwt = false` para `sugerir-respostas-etp-servicos-continuos`

### `gerar-texto-etp-secao`

Necessarias no ambiente do Supabase:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`

Opcional:

- `GEMINI_ETP_MODEL`
  - default no codigo: `gemini-2.5-flash-lite`
  - fallback automatico para `gemini-2.5-flash`

Observacoes operacionais:

- a function consome Gemini via REST e recebe a pergunta atual do ETP, notas opcionais do usuario, respostas ja registradas, objeto manual, trechos do PDF do processo quando existirem, snippets auxiliares de anexos locais opcionais e contexto institucional do campus para pano de fundo, sem trata-lo como anexo ou fonte
- anexos auxiliares opcionais devem ser usados apenas quando responderem diretamente a lacuna da secao atual; eles nao devem mudar o assunto do texto gerado
- quando a secao for solicitada sem notas do usuario, a function ainda deve gerar texto preliminar, marcando dados concretos ausentes como pendencia
- quando nao houver chave Gemini, a function devolve texto local de apoio
- quando a function ainda nao estiver publicada ou falhar por indisponibilidade/CORS, o frontend tambem usa texto local de apoio
- `supabase/config.toml` deve manter `verify_jwt = false` para `gerar-texto-etp-secao`

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
- a migration agenda `sync-contratos-comprasnet-daily` chamada diariamente as `03:00` no horario de Brasilia para as UGs `158366` e `158155`
- nao ha nova variavel obrigatoria para a regra derivada; a function calcula a vigencia real a partir do historico do Comprasnet e grava os motivos em `contratos_api`
- se `CONTRATOS_SYNC_SECRET` for configurada, o cron criado pela migration precisa ser ajustado para enviar o header `x-contratos-sync-secret`; sem esse segredo, a chamada diaria funciona apenas com service role interna da function

### `sync-licitacoes-pncp`

Necessarias no ambiente do Supabase:

- `SUPABASE_SERVICE_ROLE_KEY`

Opcionais:

- `LICITACOES_PNCP_SYNC_SECRET`
  - se configurada, chamadas HTTP precisam enviar o header `x-licitacoes-pncp-sync-secret`
- `LICITACOES_PNCP_CNPJ`
  - CNPJ institucional usado na sincronizacao geral e como fallback para buscas dirigidas
  - default no codigo: `10877412000168`

Pre-requisitos no banco:

- Supabase Cron (`pg_cron`)
- `pg_net`

Observacoes operacionais:

- `supabase/config.toml` deve manter `verify_jwt = false` para `sync-licitacoes-pncp`, pois a chamada periodica vem do cron
- o PNCP exige datas `yyyyMMdd` e periodo de ate 365 dias por chamada; a function divide janelas maiores automaticamente
- a chamada sem UASG do frontend e do cron consulta todas as unidades publicadas para o CNPJ institucional; quando o filtro informa UASG, a function descobre seu CNPJ pelo catalogo interno IFRN ou via Compras.gov.br antes de consultar o PNCP
- o endpoint PNCP de publicacao rejeita `tamanhoPagina`; esse parametro nao deve ser enviado
- `objetoBusca` pode reduzir a materializacao ao objeto informado

### `sync-atas-registro-precos`

Necessarias no ambiente do Supabase:

- `SUPABASE_SERVICE_ROLE_KEY`

Opcionais:

- `ATAS_RP_SYNC_SECRET`
  - se configurada, chamadas HTTP precisam enviar o header `x-atas-rp-sync-secret`
- `ATAS_RP_UASGS`
  - lista separada por virgula de UASGs sincronizadas por padrao
  - default no codigo: catalogo interno IFRN usado tambem em pregoes PNCP

Pre-requisitos no banco:

- tabelas `atas_registro_precos*`
- view `atas_registro_precos_resumo`

Observacoes operacionais:

- `supabase/config.toml` deve manter `verify_jwt = false` para `sync-atas-registro-precos`
- a chamada manual do frontend aceita UASG digitada, periodo e busca textual
- os endpoints `modulo-arp/*` do Compras.gov.br podem oscilar; falhas parciais ficam registradas no sync run

### `refresh-comprasnet-liquidacoes-cache`

Necessarias no ambiente do Supabase:

- `SUPABASE_SERVICE_ROLE_KEY`

Opcional:

- `CONTRATOS_LIQUIDACOES_CACHE_SECRET`
  - se configurada, chamadas HTTP precisam enviar o header `x-contratos-sync-secret`
  - se nao configurada, o cron criado pela migration e o frontend conseguem chamar a function sem header adicional

Pre-requisitos no banco:

- Supabase Cron (`pg_cron`)
- `pg_net`

Observacoes operacionais:

- `supabase/config.toml` deve manter `verify_jwt = false` para `refresh-comprasnet-liquidacoes-cache`, pois a chamada periodica vem do cron
- a migration agenda chamada a cada hora para revalidar cache vencido
- o TTL fica em 12 horas quando há liquidações encontradas e 1 hora para `not_found`

### `pesquisar-precos`

Necessárias no ambiente do Supabase:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Opcionais:

- `GEMINI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`
- `GEMINI_PRICE_RESEARCH_MODEL`
  - default no código: `gemini-2.5-flash-lite`

Observações operacionais:

- sem chave Gemini, a pesquisa continua usando ranking determinístico por descrição, unidade, quantidade e recência;
- a IA não gera preço e não é fonte de dado;
- `supabase/config.toml` deve manter `verify_jwt = true` para `pesquisar-precos`;
- a function depende da disponibilidade pública de `dadosabertos.compras.gov.br`.

### `disparar-cotacao-email`

Necessárias no ambiente do Supabase:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY` — Chave da API do provedor Resend (resend.com)
- `EMAIL_FROM` — Endereço de e-mail remetente verificado no Resend

Opcionais:

- `EMAIL_REPLY_TO` — Endereço de e-mail padrão para respostas dos fornecedores

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
