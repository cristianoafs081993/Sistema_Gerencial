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
- considera ativo somente contrato com vigencia derivada pelo historico ainda vigente; termos de rescisao/cancelamento tornam o contrato inativo; sem historico, usa `vigencia_fim` da listagem como fallback com motivo registrado
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

- sincroniza pregoes eletronicos IFRN a partir da API de Consulta do PNCP
- materializa compras em `licitacoes_pncp`
- registra execucoes em `licitacoes_pncp_sync_runs`
- atualiza o cache de UASGs em `licitacoes_pncp_uasgs` via Dados Abertos Compras.gov.br quando disponivel

Entrada opcional:

```json
{
  "cnpjOrgao": "10877412000168",
  "unidadeCodigos": ["158366"],
  "dataInicial": "2025-05-05",
  "dataFinal": "2026-05-04",
  "source": "frontend-manual"
}
```

Dependencias:

- `SUPABASE_SERVICE_ROLE_KEY`
- opcional `LICITACOES_PNCP_SYNC_SECRET`
- opcional `LICITACOES_PNCP_UASGS`
- opcional `LICITACOES_PNCP_CNPJ`

Observacao:

- publicada com `verify_jwt = false`, pois pode ser chamada pelo cron
- se `LICITACOES_PNCP_SYNC_SECRET` for configurada, chamadas HTTP precisam enviar `x-licitacoes-pncp-sync-secret`
- por padrao usa CNPJ IFRN `10877412000168`, UASG `158366` e janela dos ultimos 365 dias
- a migration agenda `sync-licitacoes-pncp-daily` as `03:30` no horario de Brasilia
- se o navegador registrar `404` seguido de falha de CORS/preflight para `/functions/v1/sync-licitacoes-pncp`, a causa esperada e function ausente no projeto remoto; publicar a function deve fazer o `OPTIONS` voltar `HTTP 200` com headers CORS

### `refresh-comprasnet-liquidacoes-cache`

Local:

- [refresh-comprasnet-liquidacoes-cache/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/refresh-comprasnet-liquidacoes-cache/index.ts)

Uso:

- atualiza o cache de liquidações/faturas do Comprasnet por empenho para o modal de detalhes do empenho
- aceita empenhos especificos enviados pelo frontend
- em modo `refreshDue`, reprocessa entradas vencidas do cache
- em modo `readCacheOnly` com `returnRows`, devolve as linhas ja materializadas no cache sem varrer novamente a API publica
- consulta contratos publicos das UGs `158366` e `158155`

Dependencias:

- `SUPABASE_SERVICE_ROLE_KEY`
- opcional `CONTRATOS_LIQUIDACOES_CACHE_SECRET` para exigir o header `x-contratos-sync-secret`

Observacao:

- publicada com `verify_jwt = false`, pois pode ser chamada pelo cron e pelo frontend
- responde preflight CORS com `POST, OPTIONS`; se a function ainda nao estiver publicada, o navegador pode registrar falha de CORS ao tentar chamada direta
- a migration agenda `refresh-comprasnet-liquidacoes-cache-hourly` com Supabase Cron/pg_net para executar a cada hora
- resultados encontrados recebem TTL de 12 horas
- resultados `not_found` recebem TTL de 1 hora

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
