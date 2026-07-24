# SUPABASE_FUNCTIONS

> [!IMPORTANT]
> **Regra de Deploy**: Sempre que uma nova Edge Function for criada, modificada ou adicionada como dependência no projeto, **deve ser executado o deploy dela** no ambiente correspondente usando a CLI do Supabase para que as atualizações fiquem disponíveis no backend remoto:
> ```bash
> supabase functions deploy <nome-da-funcao>
> ```

## Functions identificadas no repo

### `ingest-email-csv`

Local:

- [ingest-email-csv/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/ingest-email-csv/index.ts)

Uso:

- recebe anexos CSV vindos do Gmail via Apps Script
- detecta o pipeline por hint, nome do arquivo ou cabecalho
- grava o resultado em `email_csv_ingestion_runs` e na tabela final do dominio
- tambem aceita a conta agregada de descentralizacoes como pipeline separado, gravando em `descentralizacoes_conta_saldos`
- em credito disponivel e conta de descentralizacoes, ignora linhas sem valor preenchido ou parseavel para evitar sobrescrita indevida com zero

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

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`
- opcional `GEMINI_LIQUIDACAO_MODEL`, com fallback para `gemini-2.5-flash-lite` e `gemini-2.5-flash`

### `process-pdf` e `process-pdf-worker`

Local:

- [process-pdf/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/process-pdf/index.ts)
- [process-pdf-worker/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/process-pdf-worker/index.ts)
- [_shared/process_pdf_shared.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/_shared/process_pdf_shared.ts)

Chamador:

- [suapScraperService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/suapScraperService.ts)

Uso:

- `process-pdf` autentica o usuario, valida o processo e enfileira a extracao do PDF sincronizado no bucket `suap-pdfs`
- `process-pdf-worker` processa a fila, atualiza `processos` e grava `dados_completos.extraction_job`; a ordem de provedores e Gemini com PDF, OpenAI com PDF e OpenRouter para reparo final do JSON
- o fluxo SUAP padrao envia apenas `suap_id` para a Edge Function; antes da IA o frontend persiste somente `suap_id`, `url`, `caixa` e, quando encontrado na listagem, `num_processo`. A resposta `202` confirma somente o enfileiramento; o frontend acompanha `processos.status` ate o resultado final e exibe falhas tecnicas registradas em `dados_completos.extraction_job`

Dependencias:

- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- opcional `GEMINI_MODEL`, com default `gemini-2.5-flash-lite`
- opcional `PROCESS_PDF_WORKER_SECRET`; quando ausente, usa `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` e opcional `OPENAI_MODEL`, com default `gpt-5-mini`, como segundo provedor
- opcional `OPENROUTER_API_KEY` e `OPENROUTER_MODEL` como terceiro provedor de reparo de JSON

### `suap-token-exchange`

Local:

- [suap-token-exchange/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/suap-token-exchange/index.ts)

Chamador:

- [SuapCallback.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/SuapCallback.tsx)

Uso:

- troca o `code` OAuth do SUAP por token e busca o perfil em `/api/rh/meus-dados/`
- cria ou localiza o usuario no Supabase Auth em todos os logins do SUAP (incluindo o fluxo de feedback público), associando-o ao grupo de acesso correspondente no banco para que sempre conste no controle de usuários
- gera magic link para concluir a sessao do app apenas se `loginSupabase` for verdadeiro
- grava `user_metadata.matricula` normalizada para ser a chave de terceirizados
- quando a matricula existe em `terceirizados`, sincroniza `user_id` em `terceirizados` e `terceirizado_permissions`, associa o usuario ao grupo `terceirizado` e remove memberships incompatíveis
- quando nao ha cadastro de terceirizado e o usuario ainda nao possui grupo, associa ao grupo `diretores`

Dependencias:

- `SUPABASE_SERVICE_ROLE_KEY`
- opcional `SUAP_CLIENT_ID`
- opcional `SUAP_CLIENT_SECRET`
- opcional `SUAP_DEV_CLIENT_ID`
- opcional `SUAP_DEV_CLIENT_SECRET`

Observacao:

- a chave operacional do terceirizado e a matricula SUAP; e-mail e usado apenas como fallback legado.
- para login local, o frontend pode enviar um `VITE_SUAP_CLIENT_ID` proprio; quando ele corresponde a `SUAP_DEV_CLIENT_ID`, a function usa `SUAP_DEV_CLIENT_SECRET`, mantendo o client de producao inalterado.

### `suap-proxy`

Local:

- [suap-proxy/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/suap-proxy/index.ts)

Chamador:

- [suapScraperService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/suapScraperService.ts)

Uso:

- Encaminha requisições HTTP para a API do SUAP contornando as restrições de CORS no frontend
- Utiliza o token OAuth do usuário (`suapToken`) para autenticação
- Retorna páginas HTML ou binário (PDF codificado em base64)

Dependencias:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Observação:

- Possui política de segurança interna que valida a sessão do usuário no Supabase
- Restringe o proxy aos caminhos `/processo_eletronico/*` e `/djtools/*` no SUAP

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
- o frontend bloqueia a chamada quando nao houver modelo ativo; quando iniciado a partir do fluxo ETP -> Mapa de Risco, `processo` pode ser nulo e o contexto vem de snippets `sourceType: "etp"` e `sourceType: "mapa_riscos"` sem pagina
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
- recebe dados opcionais do processo, trechos classificados do PDF, snippets do ETP editado, snippets do Mapa de Risco editado e o `questionnaireSchema` do modelo ativo
- devolve sugestoes por pergunta apenas quando houver fonte explicita; fonte de processo exige pagina, trecho-fonte, justificativa e confianca, e fontes ETP/Mapa de Risco podem omitir pagina quando trouxerem `sourceType: "etp"` ou `sourceType: "mapa_riscos"`, `sourceLabel`, `sourceExcerpt` e justificativa

Dependencias:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`
- opcional `GEMINI_REFERENCE_TERM_PREFILL_MODEL`
- opcional `GEMINI_REFERENCE_TERM_MODEL`

Observacao:

- perguntas sem fonte clara retornam como `unanswered` e seguem para revisao manual
- a function e separada da geracao final para que falhas na sugestao nao bloqueiem o fluxo manual
- o deploy atual usa `verify_jwt = false` em `supabase/config.toml`, seguindo o padrao das functions do Editor de Documentos

### `gerar-mapa-riscos-licitacao`

Local:

- [gerar-mapa-riscos-licitacao/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/gerar-mapa-riscos-licitacao/index.ts)

Chamador:

- [riskMaps.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/riskMaps.ts)

Uso:

- gera Mapa de Risco da licitacao a partir do ETP editado no editor
- recebe `processo`, `manualObject` e snippets do ETP
- devolve HTML editavel e matriz de riscos com fase, risco, causa, dano, probabilidade, impacto, nivel, acoes e responsavel

Variaveis:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`
- opcional `GEMINI_RISK_MAP_MODEL`, com default `gemini-2.5-flash-lite`

Observacoes:

- se nao houver chave ou se a function falhar, o frontend usa fallback local em `riskMapsService`
- publicada com `verify_jwt = false`, seguindo o padrao das functions do Editor de Documentos

### `gerar-etp-servicos-continuos`

Local:

- [gerar-etp-servicos-continuos/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/gerar-etp-servicos-continuos/index.ts)

Chamador:

- [preliminaryStudies.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/preliminaryStudies.ts)

Uso:

- gera rascunho editavel do Estudo Tecnico Preliminar para servicos continuos no Editor de Documentos
- recebe processo SUAP opcional, objeto manual, questionario fixo, respostas/pulos do usuario, trechos classificados do PDF do processo, snippets auxiliares extraidos localmente de anexos opcionais PDF, XLSX, XLS, ODS, CSV, TXT, MD e DOCX e contexto institucional do campus com `sourceType: "institucional"`
- devolve HTML, secoes copiaveis, alertas, pendencias e campos identificados

Dependencias:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`
- opcional `GEMINI_ETP_MODEL`

Observacao:

- se nao houver chave Gemini, a function monta um fallback local com as respostas e pendencias
- se a function ainda nao estiver publicada ou falhar por indisponibilidade/CORS, o frontend tambem monta fallback local em `preliminaryStudiesService`
- nao usa modelo DOCX para o ETP, nao persiste rascunho em banco, nao persiste anexos auxiliares e nao faz OCR
- snippets auxiliares chegam como texto com `sourceType: "anexo"`, `sourceName`, `sourceLabel`, `pageNumber` opcional, `kind` e `excerpt`; arquivos brutos nunca chegam a function; contexto institucional chega como apoio de redacao, mas nao deve ser citado como anexo, fonte ou referencia no ETP
- anexos auxiliares opcionais servem apenas para localizar dados pontuais exigidos por perguntas/secoes; eles nao devem definir o foco, o escopo ou a narrativa principal do ETP
- contexto institucional do `Campus Currais Novos` deve ser tratado como unidade demandante real, nao como exemplo a ser preservado em marcador `[CAMPO PENDENTE]`
- publicada com `verify_jwt = false`, seguindo o padrao das functions do Editor de Documentos

### `sugerir-respostas-etp-servicos-continuos`

Local:

- [sugerir-respostas-etp-servicos-continuos/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/sugerir-respostas-etp-servicos-continuos/index.ts)

Chamador:

- [preliminaryStudies.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/preliminaryStudies.ts)

Uso:

- sugere respostas para o questionario fixo do ETP de servicos continuos antes da revisao manual
- recebe trechos classificados do PDF/texto do processo; anexos auxiliares sao filtrados desse fluxo para evitar preenchimento automatico focado em CCT, planilhas ou memorias

Dependencias:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`
- opcional `GEMINI_ETP_PREFILL_MODEL`
- opcional `GEMINI_ETP_MODEL`

Observacao:

- sugestoes sem trecho-fonte, justificativa e valor sao descartadas pelo frontend; fontes de processo precisam de pagina
- anexos locais do ETP nao sao persistidos nem enviados brutos; snippets auxiliares e contexto institucional sao filtrados neste fluxo para nao serem tratados como fonte de sugestao automatica
- anexos auxiliares como CCT, planilhas ou memorias ficam apenas como apoio pontual para redacao/revisao de secoes e nao devem preencher automaticamente perguntas do questionario
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
- pode usar snippets auxiliares de anexos locais como apoio, sempre identificados por nome do arquivo e pagina, aba/linhas ou bloco quando disponivel; tambem pode usar contexto institucional como pano de fundo natural, sem cita-lo como anexo, fonte ou referencia
- anexos auxiliares opcionais devem ser usados apenas para preencher lacunas pontuais da pergunta atual; quando nao houver relacao clara, a function deve ignorar o anexo e manter o foco no objeto, processo, notas e respostas registradas
- respostas anteriores continuam servindo como contexto, mas o prompt orienta a IA a evitar repeticao excessiva de dados contextuais ja estabelecidos, reutilizando-os somente quando forem relevantes para a secao atual
- contexto institucional do `Campus Currais Novos` deve ser tratado como unidade demandante real, nao como exemplo a ser preservado em marcador `[CAMPO PENDENTE]`

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

- sincroniza contratos das UGs `158366` e `158155` a partir de `https://contratos.comprasnet.gov.br/api`
- busca contratos ativos, inativos, historico, empenhos, faturas e itens
- deriva `situacao_derivada`, `vigencia_inicio_derivada`, `vigencia_fim_derivada`, `situacao_derivada_motivo` e `campus_scope_reason` em `contratos_api`
- considera ativo somente contrato com vigencia derivada pelo historico ainda vigente; termos de rescisao/cancelamento tornam o contrato inativo; sem historico, usa `vigencia_fim` da listagem como fallback com motivo registrado. Se o historico estiver vencido mas o contrato for ativo na API com faturas nos ultimos 120 dias, e reativado com motivo `historico_vencido_com_fatura_recente`
- contratos da UG `158155` entram no escopo somente com evidencia operacional estruturada do campus `158366`, como empenho ou fatura com UG/contratante do campus
- contratos com UASG/origem `158366` cujo objeto indique atendimento a outro campus avancado, como Parelhas ou Jucurutu, sao marcados fora do escopo com `ug_campus_objeto_fora_currais_novos`
- na UG `158155`, a coleta e feita em etapas para reduzir consumo do worker: historico e empenhos primeiro; faturas e itens apenas para contratos ativos e em escopo, ou quando a fatura ainda pode comprovar escopo
- grava em `contratos_api_empenhos` somente empenhos cuja `unidade_gestora` seja `158366`; empenhos de outras unidades do contrato global nao entram nos totais nem nos badges da tela do campus
- deriva vinculos fatura-item de `dados_item_faturado`
- deriva vinculos fatura-empenho de `dados_empenho`
- grava contadores e falhas em `contratos_api_sync_runs`

Dependencias:

- `SUPABASE_SERVICE_ROLE_KEY`
- opcional `CONTRATOS_SYNC_SECRET` para exigir o header `x-contratos-sync-secret`

Observacao:

- publicada com `verify_jwt = false`, pois o cron chama a function por HTTP e a function usa service role apenas internamente
- a migration agenda `sync-contratos-comprasnet-daily` com Supabase Cron/pg_net para executar diariamente as `03:00` no horario de Brasilia
- a chamada sem `unidadeCodigo` sincroniza as UGs padrao `158366` e `158155`; valores fora desse conjunto sao rejeitados nesta versao
- o endpoint de "ativos" do Comprasnet nao e fonte de verdade de vigencia; a exibicao da UI usa `situacao_derivada`, nao `situacao`

### `sync-licitacoes-pncp`

Local:

- [sync-licitacoes-pncp/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/sync-licitacoes-pncp/index.ts)

Uso:

- sincroniza pregoes eletronicos do IFRN a partir da API de Consulta do PNCP, por CNPJ institucional ou por UASG explicita
- materializa compras em `licitacoes_pncp`
- registra execucoes em `licitacoes_pncp_sync_runs`
- atualiza o cache de UASGs em `licitacoes_pncp_uasgs` usando primeiro o catalogo interno IFRN e, para UASGs externas, Dados Abertos Compras.gov.br quando disponivel

Entrada opcional:

```json
{
  "unidadeCodigos": ["158366"],
  "objetoBusca": "combustivel",
  "itemBusca": "oleo diesel",
  "dataInicial": "2025-05-05",
  "dataFinal": "2026-05-04",
  "source": "frontend-manual"
}
```

Dependencias:

- `SUPABASE_SERVICE_ROLE_KEY`
- opcional `LICITACOES_PNCP_SYNC_SECRET`
- opcional `LICITACOES_PNCP_CNPJ`

Observacao:

- publicada com `verify_jwt = false`, pois pode ser chamada pelo cron
- se `LICITACOES_PNCP_SYNC_SECRET` for configurada, chamadas HTTP precisam enviar `x-licitacoes-pncp-sync-secret`
- sem `unidadeCodigo`/`unidadeCodigos`, consulta o CNPJ IFRN inteiro e materializa todas as UASGs retornadas pelo PNCP; esse e o escopo do cron e da busca geral da tela
- quando uma UASG e enviada, resolve seu CNPJ primeiro pelo catalogo interno `IFRN_UASG_CATALOG`; UASGs fora desse catalogo continuam sendo resolvidas via Dados Abertos Compras.gov.br antes de chamar o PNCP
- a resolucao da UASG usa preferencialmente `/modulo-uasg/1.1_consultarUasg_CSV`, pois o endpoint JSON correspondente pode falhar com `400` para `statusUasg=true`
- por padrao usa o CNPJ institucional `10877412000168` e janela dos ultimos 365 dias; a lista interna segue disponivel para a acao dirigida `Sincronizar UASGs IFRN`
- o frontend chama a sincronizacao do catalogo interno em lotes por UASG; uma chamada HTTP unica com todas as UASGs pode exceder o limite da Edge Function quando o PNCP demora
- `objetoBusca` e aplicado como pos-filtro textual sem acentos sobre `objetoCompra`, depois da consulta PNCP por UASG/data/modalidade
- `itemBusca` consulta `/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens` para cada contratacao candidata, grava os itens em `raw_data.itens` e filtra pelas descricoes/campos do item; sem `itemBusca`, os itens nao sao buscados em lote para evitar custo desnecessario
- a URL de publicacao nao inclui `tamanhoPagina`, parametro rejeitado pelo PNCP com `HTTP 400`
- chamadas ao PNCP usam timeout maior e retry curto porque algumas UASGs podem responder lentamente mesmo em intervalos pequenos
- a migration agenda `sync-licitacoes-pncp-daily` as `03:30` no horario de Brasilia
- se o navegador registrar `404` seguido de falha de CORS/preflight para `/functions/v1/sync-licitacoes-pncp`, a causa esperada e function ausente no projeto remoto; publicar a function deve fazer o `OPTIONS` voltar `HTTP 200` com headers CORS

### `sync-atas-registro-precos`

Local:

- [sync-atas-registro-precos/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/sync-atas-registro-precos/index.ts)

Uso:

- sincroniza Atas de Registro de Precos/ARP por UASG a partir dos Dados Abertos Compras.gov.br
- materializa atas em `atas_registro_precos`
- materializa itens, unidades participantes e adesoes em tabelas filhas
- registra execucoes em `atas_registro_precos_sync_runs`

Entrada opcional:

```json
{
  "unidadeCodigos": ["158366"],
  "objetoBusca": "combustivel",
  "dataInicial": "2025-05-06",
  "dataFinal": "2026-05-05",
  "includeDetalhes": true,
  "includeParticipantes": true,
  "includeAdesoes": false,
  "adesaoUnidadeCodigos": ["158366"],
  "source": "frontend-manual"
}
```

Dependencias:

- `SUPABASE_SERVICE_ROLE_KEY`
- opcional `ATAS_RP_SYNC_SECRET`
- opcional `ATAS_RP_UASGS`

Observacao:

- publicada com `verify_jwt = false`, seguindo o padrao das functions chamadas pelo frontend e por cron
- se `ATAS_RP_SYNC_SECRET` for configurada, chamadas HTTP precisam enviar `x-atas-rp-sync-secret`
- por padrao usa o catalogo interno IFRN de UASGs
- o frontend chama a sincronizacao do catalogo interno em lotes por UASG; uma chamada HTTP unica com todas as UASGs pode exceder o limite da Edge Function quando o Compras.gov.br demora
- `objetoBusca` e aplicado sobre os dados da ata antes da materializacao
- os endpoints `modulo-arp/*` podem oscilar; a function registra falhas por escopo em `details.errors` e retorna `partial_success` quando alguma parte foi materializada
- para evitar `504 Gateway Timeout` na Edge Function, a sincronizacao chamada pela tela usa `includeDetalhes=false` e materializa primeiro somente a lista de atas; itens, participantes e adesoes devem ser enriquecidos em chamadas especificas/posteriores quando necessario
- `includeParticipantes=true` materializa itens e unidades de `/modulo-arp/3_consultarUnidadesItem` sem obrigar a consulta de adesoes; a tela usa esse modo ao buscar `Participante` para uma UASG IFRN, varrendo o catalogo interno em lotes porque a API nao filtra participantes diretamente por UASG
- `includeAdesoes=true` materializa adesoes de `/modulo-arp/5_consultarAdesoesItem`; esse modo e separado de participantes para evitar custo desnecessario na consulta de atas participantes
- `adesaoUnidadeCodigos` separa a UASG que aderiu das UASGs gerenciadoras varridas; sem esse campo, a function usa `unidadeCodigos` como fallback para manter compatibilidade com chamadas antigas
- chamadas aos Dados Abertos dentro dessa function usam timeout curto; quando o Compras.gov.br fica pendurado, a function deve encerrar com `status=error` registrado em `atas_registro_precos_sync_runs`, sem esperar o limite do gateway da Supabase
- o enriquecimento sob demanda no drawer envia `numeroAta` e `includeDetalhes=true` para restringir a chamada aos itens/participantes/adesoes da ata aberta
- quando `numeroAta` e enviado com `includeDetalhes=true`, a function nao chama novamente `/modulo-arp/1_consultarARP`; ela usa a ata ja materializada no drawer como contexto e consulta diretamente os endpoints de itens/detalhes para evitar falhas JPA no endpoint de listagem

### `refresh-comprasnet-liquidacoes-cache`

Local:

- [refresh-comprasnet-liquidacoes-cache/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/refresh-comprasnet-liquidacoes-cache/index.ts)

Uso:

- atualiza o cache de liquidações/faturas do Comprasnet por empenho para o modal de detalhes do empenho
- aceita empenhos especificos enviados pelo frontend
- em modo `refreshDue`, reprocessa entradas vencidas do cache
- em modo `readCacheOnly` com `returnRows`, devolve as linhas ja materializadas no cache sem varrer novamente a API publica
- consulta contratos publicos das UGs `158366` e `158155`
- em contratos gerenciados pela Reitoria, preserva faturas com `contratante = 158155` quando o empenho correspondente no endpoint `/empenhos` pertence a UG `158366`; isso evita descartar liquidações reais do campus em contratos globais

Dependencias:

- `SUPABASE_SERVICE_ROLE_KEY`
- opcional `CONTRATOS_LIQUIDACOES_CACHE_SECRET` para exigir o header `x-contratos-sync-secret`

Observacao:

- publicada com `verify_jwt = false`, pois pode ser chamada pelo cron e pelo frontend
- responde preflight CORS com `POST, OPTIONS`; se a function ainda nao estiver publicada, o navegador pode registrar falha de CORS ao tentar chamada direta
- a migration agenda `refresh-comprasnet-liquidacoes-cache-hourly` com Supabase Cron/pg_net para executar a cada hora
- resultados encontrados recebem TTL de 12 horas
- resultados `not_found` recebem TTL de 1 hora

### `refresh-portal-transparencia-itens-cache`

Local:

- [refresh-portal-transparencia-itens-cache/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/refresh-portal-transparencia-itens-cache/index.ts)

Uso:

- atualiza o cache de subitens do Portal da Transparencia por empenho para o modal de detalhes do empenho
- aceita empenhos especificos enviados pelo frontend
- em modo `refreshDue`, reprocessa entradas vencidas do cache
- em modo `readCacheOnly` com `returnRows`, devolve as linhas ja materializadas no cache sem consultar novamente o Portal
- consulta `/api-de-dados/despesas/itens-de-empenho` usando `codigoDocumento = 158366 + 26435 + numero do empenho`
- salva dados em `portal_transparencia_empenho_itens_cache_status` e `portal_transparencia_empenho_itens_cache`

Dependencias:

- `SUPABASE_SERVICE_ROLE_KEY`
- opcional `PORTAL_TRANSPARENCIA_API_KEY`; se ausente, usa o fallback operacional atual do codigo
- opcional `PORTAL_TRANSPARENCIA_CACHE_SECRET` para exigir o header `x-portal-transparencia-cache-secret`

Observacao:

- publicada com `verify_jwt = false`, pois pode ser chamada pelo cron e pelo frontend
- responde preflight CORS com `POST, OPTIONS`
- a migration agenda `refresh-portal-transparencia-itens-cache-hourly` com Supabase Cron/pg_net para executar a cada hora
- resultados encontrados recebem TTL de 12 horas
- resultados `not_found` recebem TTL de 1 hora

### `pesquisar-precos`

Local:

- `supabase/functions/pesquisar-precos/index.ts`

Uso:

- recebe itens com descrição, quantidade, unidade e CATMAT/CATSER;
- aceita filtros avancados opcionais e aplica pos-filtro deterministico para criterios nao suportados diretamente pela API oficial;
- consulta preços homologados dos últimos 12 meses no Compras.gov.br;
- normaliza unidades determinísticas e retorna até 100 candidatos por item;
- usa Gemini opcionalmente apenas para reordenar aderência;
- devolve links da fonte oficial e pesquisa complementar no PNCP.

Dependências:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- opcional `GEMINI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`
- opcional `GEMINI_PRICE_RESEARCH_MODEL`

Observações:

- publicada com `verify_jwt = true`;
- também valida o usuário dentro da function;
- não usa service role e não grava no banco;
- limites: 25 itens por chamada e 100 candidatos por item.

### `validar-pesquisa-precos`

Local:

- `supabase/functions/validar-pesquisa-precos/index.ts`

Uso:

- recebe `id` da pesquisa e hash `auth` vindo do QR Code do relatório;
- lê `price_researches` e `price_research_items` com service role;
- recompõe o snapshot auditável usado no relatório;
- compara o hash recalculado com o hash informado;
- retorna apenas metadados mínimos da pesquisa, hash informado, hash recalculado e status de validação.

Dependências:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Observações:

- publicada com `verify_jwt = false`, porque o QR Code pode ser aberto fora da sessão dona do registro;
- não retorna a cesta completa de preços nem os candidatos da pesquisa.

### `disparar-cotacao-email`

Local:

- `supabase/functions/disparar-cotacao-email/index.ts`

Uso:

- recebe lista de destinatários (fornecedores), itens, metadados da pesquisa, identificação institucional, setor responsável, instruções customizadas e Reply-To;
- monta o HTML do e-mail de cotação no backend, com rodapé SIAGES e setor responsável configurável;
- dispara cada e-mail via Resend API;
- grava registro de auditoria em `price_research_email_dispatches`;
- suporta modalidades: `direct`, `express`, `batch`, `custom`, `manual`.

Dependências:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (para gravar dispatches e ler dados da pesquisa)
- `RESEND_API_KEY` — chave da API do provedor Resend (resend.com)
- `EMAIL_FROM` — endereço remetente verificado no Resend (ex: conta Gmail configurada)
- opcional `EMAIL_REPLY_TO` — endereço padrão de resposta; sobrescrevível por chamada

Observações:

- publicada com `verify_jwt = true`;
- valida também ownership da pesquisa (criador ou superadmin);
- o `EMAIL_FROM` precisa ser verificado no painel do Resend antes do primeiro envio;
- para Gmail pessoal como remetente, o Resend exige verificação do domínio ou uso de subdomínio;
- erros de envio por destinatário são registrados no banco sem interromper os demais.

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
