# API_CATALOG

Este catalogo resume as integracoes externas e internas relevantes para o frontend.

## 1. Supabase Database

Uso:

- cliente principal do app

Arquivos:

- [supabase.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/supabase.ts)
- [env.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/env.ts)

Credenciais necessarias:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Observacao:

- o app usa tanto `supabase-js` quanto fallback REST.

## 1A. Supabase Auth

Uso:

- sessao global do app
- login por e-mail e senha
- convite controlado por e-mail
- protecao global das rotas do frontend

Arquivos:

- [supabase.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/supabase.ts)
- [AuthContext.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/contexts/AuthContext.tsx)
- [Auth.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Auth.tsx)
- [ControleUsuarios.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/ControleUsuarios.tsx)
- [SetupPasswordPanel.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/auth/SetupPasswordPanel.tsx)
- [Suap.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Suap.tsx)

Configuracao operacional:

- provider `Email` habilitado no Supabase Auth
- usuarios provisionados no Supabase Auth com convite ou senha
- a rota publica de entrada e `/auth`
- o superadministrador atual do app e `cristiano.cnrn@gmail.com`

Observacao:

- o app depende de sessao persistida pelo `supabase-js` no navegador
- links de convite e recuperacao retornam para `/auth` com token na URL
- ao perder a sessao, qualquer rota protegida redireciona novamente para `/auth`
- botoes de upload/importacao no frontend so aparecem para o superadministrador autenticado

## 2. Supabase REST fallback

Uso:

- fallback quando `supabase-js` falha ou retorna vazio em alguns carregamentos

Arquivo:

- [supabaseRest.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/supabaseRest.ts)

Headers usados:

- `apikey`
- `Authorization: Bearer <anon key>`

Risco:

- se a politica RLS ou o schema mudarem, o fallback pode divergir do comportamento principal.

## 3. Portal da Transparencia

Uso:

- consulta de documentos, historicos e empenhos impactados

Proxy local:

- `/api-transparencia`

Configuracao:

- [vite.config.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/vite.config.ts)

Service:

- [transparencia.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/transparencia.ts)

Endpoints observados:

- `/api-de-dados/despesas/documentos`
- `/api-de-dados/despesas/itens-de-empenho/historico`
- `/api-de-dados/despesas/empenhos-impactados`

Credenciais:

- o service atual usa `chave-api-dados`

Observacao:

- existe chave de API embutida no service. Isso deve ser tratado como contrato operacional sensivel e idealmente sair do codigo.

## 4. API de Contratos

Uso:

- sincronizacao de contratos ativos e inativos, historico, empenhos, faturas, itens e vinculos fatura-item/fatura-empenho

Proxy local:

- `/api-contratos`

Configuracao:

- [vite.config.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/vite.config.ts)

Service:

- [contratosApi.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/contratosApi.ts)
- [contratosApiMappers.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/contratosApiMappers.ts)

Sincronizacao automatica:

- [sync-contratos-comprasnet/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/sync-contratos-comprasnet/index.ts)
- cron a cada 6 horas para a UG `158366`

Base usada:

- `/api-contratos/api`

Endpoints observados:

- `/contrato/ug/{unidadeCodigo}`
- `/contrato/inativo/ug/{unidadeCodigo}`
- `/contrato/{api_contrato_id}/empenhos`
- `/contrato/{api_contrato_id}/faturas`
- `/contrato/{api_contrato_id}/itens`
- `/contrato/{api_contrato_id}/historico`

Persistencia local:

- `contratos_api`
- `contratos_api_historico`
- `contratos_api_empenhos`
- `contratos_api_faturas`
- `contratos_api_itens`
- `contratos_api_fatura_itens`
- `contratos_api_fatura_empenhos`
- `contratos_api_sync_runs`

Observacao:

- execucao por item so deve ser exibida como oficial quando a fatura trouxer `dados_item_faturado[].id_item_contrato`; o total executado considera situacoes `Pago` e `Siafi Apropriado`
- o historico de contrato deve mostrar os valores originais da API; variacoes derivadas entre termos nao sao valor oficial de aditivo
- o Valor Total da lista deve usar `contratos_api_historico` como fonte principal, somando `valor_inicial` de cada termo. `valor_global` da API nao entra nessa metrica porque pode representar outro consolidado/periodo e distorcer a leitura. Sem historico com `valor_inicial`, usar `contratos.valor` como fallback
- em contratos com `codigo_unidade_origem = 158155`, a UI deve sinalizar origem Reitoria e diferenciar valores globais do contrato da execucao do campus `158366`
- empenhos da API alimentam o Valor Empenhado pelo campo `empenhado` na lista principal; o drawer nao exibe uma secao propria de empenhos para evitar misturar saldos da API com a regra local de `empenhos`
- nos itens do drawer, o contratado deve somar `historico_item[].valor_total` quando a API trouxer historico por item; `valor_total` do item e fallback sem historico
- quando a API trouxer o `historico_item`, o drawer deve exibir tambem seus campos operacionais por termo: `tipo_historico`, `data_termo`, `quantidade`, `valor_unitario` e `valor_total`
- no resumo de itens do drawer, `Contratado` e `Executado` tambem devem mostrar quantidade agregada: contratado pela soma de `historico_item[].quantidade` quando houver historico, e executado pela soma de `quantidade_faturado` nas faturas `Pago` ou `Siafi Apropriado`
- quando houver `dados_item_faturado`, o drawer deve exibir tambem `quantidade_faturado` e `valor_unitario_faturado` na linha da fatura
- a tela de contratos cruza a base local com a API por numero normalizado e abre os dados externos em drawer lateral

## 5. Edge Function `analisar-liquidacao-siafi`

Uso:

- analise de prints do SIAFI para concluir processo no modulo SUAP

Chamador:

- [suapProcessos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/suapProcessos.ts)

Implementacao no repo:

- [analisar-liquidacao-siafi/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/analisar-liquidacao-siafi/index.ts)

Dependencias externas:

- `OPENAI_API_KEY`
- opcionalmente `OPENAI_VISION_MODEL`

## 6. Edge Function `consultor`

Uso:

- chat juridico e analise de PDF no modulo Consultor
- consulta base semantica de normativos ingeridos pelo pipeline local, conforme [NORMATIVOS_CONSULTOR_INGESTION.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/integrations/NORMATIVOS_CONSULTOR_INGESTION.md)

Chamador:

- [Consultor.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Consultor.tsx)
- [ConsultorSessions.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/ConsultorSessions.tsx)

Status:

- o frontend monta a URL por `getSupabaseFunctionUrl('consultor')`
- o frontend usa a `anonKey` do projeto no header `Authorization`
- a implementacao da function nao foi localizada no repo nesta rodada
- as conversas do frontend ficam em `localStorage` com chave derivada do usuario autenticado, evitando compartilhar historico entre contas no mesmo navegador
- o backlog de ingestao dos normativos que alimentam a base semantica fica em [NORMATIVOS_CONSULTOR_INGESTION.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/integrations/NORMATIVOS_CONSULTOR_INGESTION.md)

## 7. Edge Function `verificar-conformidade`

Uso:

- verificacao de conformidade documental no editor rico

Chamador:

- [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx)

Status:

- invocada pelo frontend
- nao localizada em `supabase/functions` nesta rodada

## 7B. Edge Function `gerar-contrato-licitacao`

Uso:

- geracao assistida de contrato no Editor de Documentos a partir do PDF do processo sincronizado no SUAP
- recebe do frontend o modelo contratual selecionado e trechos de apoio do mesmo PDF

Chamador:

- [contractDrafts.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/contractDrafts.ts)
- [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx)

Implementacao no repo:

- [gerar-contrato-licitacao/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/gerar-contrato-licitacao/index.ts)

Dependencias externas:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`
- opcional `GEMINI_CONTRACT_MODEL`

Observacao:

- a function usa Gemini via REST e so deve montar contrato quando o frontend conseguir localizar um modelo contratual claro no PDF
- PDFs sem texto pesquisavel ficam bloqueados no frontend; OCR ainda nao faz parte deste fluxo

## 7C. Edge Function `gerar-termo-referencia-compras`

Uso:

- geracao assistida do Termo de Referencia de compras no Editor de Documentos
- recebe do frontend o modelo DOCX ativo ja parseado localmente, o questionario revisado do modelo, as respostas ou pulos do usuario e trechos relevantes do PDF do processo sincronizado no SUAP

Chamador:

- [referenceTerms.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/referenceTerms.ts)
- [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx)

Implementacao no repo:

- [gerar-termo-referencia-compras/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/gerar-termo-referencia-compras/index.ts)

Dependencias externas:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`
- opcional `GEMINI_REFERENCE_TERM_MODEL`

Observacao:

- a function usa Gemini via REST e devolve HTML editavel e um `templatePlan` para remontar o DOCX final sobre o modelo vigente
- respostas do questionario travam escolhas do usuario antes da IA; perguntas puladas viram pendencia e nao sao decididas pelo Gemini
- o `templatePlan` pode incluir marcas de revisao para o exportador DOCX: destaque de IA, pendencia, tachado de trecho nao adotado e comentarios laterais
- sem modelo ativo em `document_templates` ou sem texto pesquisavel no PDF do processo, o bloqueio acontece no frontend

## 7D. Edge Function `sugerir-respostas-termo-referencia`

Uso:

- pre-preenchimento assistido do questionario do Termo de Referencia
- chama Gemini antes da etapa manual para sugerir respostas com fonte explicita no PDF do processo
- devolve respostas aprovaveis pelo usuario e pendencias sem resposta quando nao houver evidencia suficiente

Chamador:

- [referenceTerms.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/referenceTerms.ts)
- [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx)

Implementacao no repo:

- [sugerir-respostas-termo-referencia/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/sugerir-respostas-termo-referencia/index.ts)

Dependencias externas:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`
- opcional `GEMINI_REFERENCE_TERM_PREFILL_MODEL`

Observacao:

- sugestoes sem `sourcePage`, `sourceExcerpt` e `justification` sao descartadas e tratadas como pendentes
- a geracao final continua em `gerar-termo-referencia-compras`

## 7E. Edge Function `gerar-etp-servicos-continuos`

Uso:

- geracao assistida do Estudo Tecnico Preliminar para servicos continuos no Editor de Documentos
- recebe metadados do processo SUAP quando disponiveis, objeto digitado manualmente, questionario fixo do ETP, respostas ou pulos do usuario e trechos relevantes do PDF sincronizado

Chamador:

- [preliminaryStudies.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/preliminaryStudies.ts)
- [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx)

Implementacao no repo:

- [gerar-etp-servicos-continuos/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/gerar-etp-servicos-continuos/index.ts)

Dependencias externas:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`
- opcional `GEMINI_ETP_MODEL`

Observacao:

- a function devolve HTML editavel, secoes copiaveis, campos, alertas e pendencias; se nao houver chave Gemini, monta um fallback local com as respostas e pendencias recebidas
- se a chamada a function falhar no frontend por indisponibilidade, CORS ou function ainda nao publicada, `preliminaryStudiesService` monta o mesmo tipo de rascunho por fallback local para nao bloquear o usuario
- a versao atual nao usa modelo DOCX, nao grava rascunhos no banco e nao faz OCR de PDF escaneado

## 7F. Edge Function `sugerir-respostas-etp-servicos-continuos`

Uso:

- pre-preenchimento assistido do questionario fixo do ETP de servicos continuos
- chama Gemini antes da etapa manual para sugerir respostas com fonte explicita no PDF do processo

Chamador:

- [preliminaryStudies.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/preliminaryStudies.ts)
- [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx)

Implementacao no repo:

- [sugerir-respostas-etp-servicos-continuos/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/sugerir-respostas-etp-servicos-continuos/index.ts)

Dependencias externas:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`
- opcional `GEMINI_ETP_PREFILL_MODEL`
- opcional `GEMINI_ETP_MODEL`

Observacao:

- sugestoes sem `sourcePage`, `sourceExcerpt`, `justification` e `value` sao descartadas e tratadas como pendentes
- quando nao houver trechos do PDF ou quando a function nao responder, o fluxo segue pelo questionario manual

## 7G. Edge Function `gerar-texto-etp-secao`

Uso:

- geracao assistida de texto para uma secao individual do questionario fixo do ETP de servicos continuos
- recebe a pergunta atual, notas digitadas pelo usuario quando houver, objeto manual, metadados do processo, respostas ja registradas e trechos do PDF sincronizado
- pode gerar texto mesmo quando `userNotes` vier vazio; dados concretos ausentes devem ser marcados como pendencia, sem inventar numeros, datas, valores ou fatos

Chamador:

- [preliminaryStudies.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/preliminaryStudies.ts)
- [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx)

Implementacao no repo:

- [gerar-texto-etp-secao/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/gerar-texto-etp-secao/index.ts)

Dependencias externas:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`
- opcional `GEMINI_ETP_MODEL`

Observacao:

- se nao houver chave Gemini, a function devolve texto local de apoio para revisao
- se a chamada a function falhar no frontend por indisponibilidade, CORS ou function ainda nao publicada, `preliminaryStudiesService.generateQuestionText` devolve texto local de apoio para nao bloquear o preenchimento da secao

## 7A. Edge Function `invite-user`

Uso:

- envio legado de convites de usuario
- validacao server-side do e-mail autorizador
- disparo do `auth.admin.inviteUserByEmail` com `redirectTo` para `/auth?mode=invite`

Chamador:

- [authInvites.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/authInvites.ts)

Implementacao no repo:

- [invite-user/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/invite-user/index.ts)

Dependencias externas:

- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_APP_ORIGIN` no frontend, quando convites puderem ser enviados fora da URL pública de produção

Observacao:

- a function valida localmente o convidante e so aceita convites disparados por `cristiano.cnrn@gmail.com`
- o deploy atual usa `verify_jwt = false` para evitar rejeicao do gateway e deixar a validacao do token sob controle da propria function
- o frontend bloqueia o envio quando o `redirectTo` calculado aponta para `localhost` ou loopback, evitando convites com link local

## 7B. Edge Function `admin-users`

Uso:

- administracao de usuarios, grupos e permissoes por tela a partir de `/controle-usuarios`
- criacao direta de usuarios com senha padrao `ifrn`
- envio opcional de convite com associacao de grupo
- listagem dos usuarios do Supabase Auth com os grupos vinculados

Chamador:

- [userAdmin.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/userAdmin.ts)

Implementacao no repo:

- [admin-users/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/admin-users/index.ts)

Dependencias externas:

- `SUPABASE_SERVICE_ROLE_KEY`

Observacao:

- a function valida localmente o JWT recebido pelo frontend e so aceita chamadas do superadministrador
- usuarios criados diretamente recebem `user_metadata.uses_default_password = true`, usado pelo frontend para exibir aviso de troca de senha

## 8. Supabase Storage

Uso:

- PDFs do modulo SUAP

Chamador:

- [suapProcessos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/suapProcessos.ts)

Bucket observado:

- `suap-pdfs`

## 9. Bibliotecas com contrato operacional relevante

### `pdfjs-dist`

Uso:

- leitura de PDFs no frontend
- extracao textual do PDF sincronizado do processo para os fluxos de contrato e Termo de Referencia no editor

Arquivo:

- [Consultor.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Consultor.tsx)
- [contractProcessPdf.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/contractProcessPdf.ts)
- [referenceTermProcessPdf.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/referenceTermProcessPdf.ts)

### `cfb`

Uso:

- leitura e regravacao do container ZIP do DOCX para preservar o modelo oficial do Termo de Referencia

Arquivos:

- [docxDocumentTemplate.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/docxDocumentTemplate.ts)

### `xlsx`

Uso:

- leitura de CSV/XLSX em importacoes

Arquivos:

- `financeiroImportService.ts`
- `lcImportService.ts`
- `pfImportService.ts`
- `retencoesEfdReinfImportService.ts`

## 10. Gmail + Google Apps Script + Edge Function `ingest-email-csv`

Uso:

- leitura automatica de e-mails com anexo `.csv`
- roteamento do arquivo para o parser correto
- persistencia com idempotencia e trilha de execucao

Documentacao detalhada:

- [GMAIL_CSV_INGESTION.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/integrations/GMAIL_CSV_INGESTION.md)

Arquivos:

- [ingest-email-csv/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/ingest-email-csv/index.ts)
- [emailCsvIngestion.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/emailCsvIngestion.ts)
- [gmailCsvIngress.gs](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/scripts/google-apps-script/gmailCsvIngress.gs)

Credenciais/segredos:

- `SUPABASE_ANON_KEY` no Apps Script para invocar a function
- `EMAIL_CSV_INGEST_SECRET` no Apps Script e na Edge Function
- `SUPABASE_SERVICE_ROLE_KEY` na Edge Function para gravacao no banco
- opcional `EMAIL_CSV_ALLOWED_SENDERS` para restringir remetentes

## 11. Extensao SUAP Scraper

Uso:

- sincronizacao da caixa de processos do SUAP para a tabela `processos`
- envio de PDFs para o bucket `suap-pdfs`

Repositorio:

- `https://github.com/cristianoafs081993/suap-scraper`

Consumidores no app:

- [Suap.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Suap.tsx)
- [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx)

Observacao:

- o link no app aparece no header das telas consumidoras com o rotulo `Baixar extensão` e aponta para o GitHub da extensao.

## 12. Edge Function `record-automation-savings-event`

Uso:

- registro de eventos reais de automacao para alimentar a tela `/economia-tempo`
- chamada por extensoes, automacoes externas ou pelo app autenticado

Chamador:

- [automationSavingsService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/automationSavingsService.ts)
- [suap-atividades-extension/popup.js](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/suap-atividades-extension/popup.js)

Implementacao no repo:

- [record-automation-savings-event/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/record-automation-savings-event/index.ts)

Credenciais/segredos:

- `SUPABASE_SERVICE_ROLE_KEY` para gravar `automation_savings_events`
- `AUTOMATION_EVENT_SECRET` para chamadas feitas por extensoes sem sessao do app
- chamadas internas podem usar `Authorization: Bearer <jwt_do_usuario>`

Payload:

```json
{
  "scenarioId": "suap-processos",
  "source": "suap-scraper",
  "eventName": "processos_sincronizados",
  "occurredAt": "2026-04-25T12:00:00.000Z",
  "userEmail": "usuario@ifrn.edu.br",
  "metadata": { "count": 3 }
}
```

Observacao:

- a function busca o cenario ativo em `automation_savings_scenarios`, copia os tempos vigentes para o evento e calcula `saved_minutes`
- `metadata.count` representa execucoes em lote e e aplicado pelo agregador do frontend
