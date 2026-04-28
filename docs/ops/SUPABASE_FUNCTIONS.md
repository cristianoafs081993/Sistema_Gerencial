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

### `gerar-contrato-licitacao`

Local:

- [gerar-contrato-licitacao/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/gerar-contrato-licitacao/index.ts)

Chamador:

- [contractDrafts.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/contractDrafts.ts)

Uso:

- gera minuta de contrato administrativo no Editor de Documentos a partir do PDF sincronizado do processo no SUAP
- recebe o modelo contratual selecionado pelo frontend e trechos de apoio extraidos localmente do mesmo PDF
- devolve HTML editavel, campos identificados, paginas-fonte, alertas e campos obrigatorios ausentes

Dependencias:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`
- opcional `GEMINI_CONTRACT_MODEL`

Observacao:

- a function so deve ser chamada depois que o frontend localizar uma minuta ou termo de contrato claro no PDF
- quando o PDF nao tiver texto pesquisavel ou nao trouxer modelo contratual identificavel, o bloqueio acontece no frontend; OCR ainda nao faz parte deste fluxo

### `gerar-termo-referencia-compras`

Local:

- [gerar-termo-referencia-compras/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/gerar-termo-referencia-compras/index.ts)

Chamador:

- [referenceTerms.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/referenceTerms.ts)

Uso:

- gera rascunho do Termo de Referencia de compras a partir do PDF sincronizado do processo e do modelo DOCX ativo, ou a partir de um ETP editado quando o fluxo nasce de ETP manual sem processo
- recebe blocos editaveis do template, questionario do modelo, respostas do usuario, trechos classificados do PDF quando houver, snippets do ETP editado e metadados opcionais do processo
- devolve HTML editavel, campos identificados, alertas, pendencias e `templatePlan` para montar o DOCX final com marcas de revisao

Dependencias:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`
- opcional `GEMINI_REFERENCE_TERM_MODEL`

Observacao:

- a function pressupoe que o modelo vigente ja foi publicado em `document_templates`
- o frontend bloqueia a chamada quando nao houver modelo ativo; quando iniciado a partir de ETP manual, `processo` pode ser nulo e o contexto vem de snippets `sourceType: "etp"` sem pagina
- o deploy atual usa `verify_jwt = false` em `supabase/config.toml`, seguindo o padrao de functions publicadas pelo frontend neste projeto
- a geracao e dividida em partes por blocos editaveis para evitar truncamento/JSON invalido em modelos DOCX grandes
- perguntas puladas pelo usuario ficam como `[CAMPO PENDENTE]` ou blocos pendentes; a IA nao escolhe alternativas puladas
- alternativas nao adotadas permanecem no DOCX com tachado e comentario lateral para revisao juridica
- conteudo preenchido pela IA recebe marca de revisao no HTML e no DOCX
- o modelo padrao e `gemini-2.5-flash-lite`, com fallback automatico para `gemini-2.5-flash`

### `sugerir-respostas-termo-referencia`

Local:

- [sugerir-respostas-termo-referencia/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/sugerir-respostas-termo-referencia/index.ts)

Chamador:

- [referenceTerms.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/referenceTerms.ts)

Uso:

- sugere respostas para o questionario do Termo de Referencia antes da revisao manual
- recebe dados opcionais do processo, trechos classificados do PDF, snippets do ETP editado e o `questionnaireSchema` do modelo ativo
- devolve sugestoes por pergunta apenas quando houver fonte explicita; fonte de processo exige pagina, trecho-fonte, justificativa e confianca, e fonte ETP pode omitir pagina quando trouxer `sourceType: "etp"`, `sourceLabel`, `sourceExcerpt` e justificativa

Dependencias:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`
- opcional `GEMINI_REFERENCE_TERM_PREFILL_MODEL`
- opcional `GEMINI_REFERENCE_TERM_MODEL`

Observacao:

- perguntas sem fonte clara retornam como `unanswered` e seguem para revisao manual
- a function e separada da geracao final para que falhas na sugestao nao bloqueiem o fluxo manual
- o deploy atual usa `verify_jwt = false` em `supabase/config.toml`, seguindo o padrao das functions do Editor de Documentos

### `gerar-etp-servicos-continuos`

Local:

- [gerar-etp-servicos-continuos/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/gerar-etp-servicos-continuos/index.ts)

Chamador:

- [preliminaryStudies.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/preliminaryStudies.ts)

Uso:

- gera rascunho editavel do Estudo Tecnico Preliminar para servicos continuos no Editor de Documentos
- recebe processo SUAP opcional, objeto manual, questionario fixo, respostas/pulos do usuario, trechos classificados do PDF do processo e snippets auxiliares extraidos localmente de PDFs opcionais
- devolve HTML, secoes copiaveis, alertas, pendencias e campos identificados

Dependencias:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`
- opcional `GEMINI_ETP_MODEL`

Observacao:

- se nao houver chave Gemini, a function monta um fallback local com as respostas e pendencias
- se a function ainda nao estiver publicada ou falhar por indisponibilidade/CORS, o frontend tambem monta fallback local em `preliminaryStudiesService`
- nao usa modelo DOCX, nao persiste rascunho em banco, nao persiste PDFs auxiliares e nao faz OCR
- snippets auxiliares chegam como texto com `sourceType: "anexo"`, `sourceName`, `sourceLabel`, `pageNumber`, `kind` e `excerpt`; o PDF bruto nunca chega a function
- publicada com `verify_jwt = false`, seguindo o padrao das functions do Editor de Documentos

### `sugerir-respostas-etp-servicos-continuos`

Local:

- [sugerir-respostas-etp-servicos-continuos/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/sugerir-respostas-etp-servicos-continuos/index.ts)

Chamador:

- [preliminaryStudies.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/preliminaryStudies.ts)

Uso:

- sugere respostas para o questionario fixo do ETP de servicos continuos antes da revisao manual
- recebe trechos classificados do PDF do processo e snippets auxiliares extraidos localmente; so retorna sugestoes quando houver fonte explicita

Dependencias:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`
- opcional `GEMINI_ETP_PREFILL_MODEL`
- opcional `GEMINI_ETP_MODEL`

Observacao:

- sugestoes sem pagina, trecho-fonte, justificativa e valor sao descartadas pelo frontend
- anexos locais do ETP nao sao persistidos nem enviados brutos; apenas snippets extraidos no navegador entram no payload
- quando o processo nao tem PDF pesquisavel ou a function nao responde, o frontend segue pelo questionario manual

### `gerar-texto-etp-secao`

Local:

- [gerar-texto-etp-secao/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/gerar-texto-etp-secao/index.ts)

Chamador:

- [preliminaryStudies.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/preliminaryStudies.ts)
- [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx)

Uso:

- gera texto para uma secao individual do questionario do ETP de servicos continuos
- aceita notas curtas do usuario, mas tambem gera um texto preliminar quando a secao e solicitada sem digitacao previa
- deve marcar dados concretos ausentes como pendencia, sem inventar numeros, datas, valores ou fatos especificos
- pode usar snippets auxiliares de PDFs locais como apoio, sempre identificados por nome do arquivo e pagina quando disponivel

Dependencias:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`
- opcional `GEMINI_ETP_MODEL`

Observacao:

- se nao houver chave Gemini, a function devolve texto local de apoio
- se a function ainda nao estiver publicada ou falhar por indisponibilidade/CORS, o frontend tambem usa texto local de apoio em `preliminaryStudiesService.generateQuestionText`
- publicada com `verify_jwt = false`, seguindo o padrao das functions do Editor de Documentos

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
