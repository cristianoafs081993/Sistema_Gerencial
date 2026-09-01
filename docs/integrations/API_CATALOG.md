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
- artefatos gerados no fluxo de licitacao usam a tabela `licitacao_document_artifacts`, lida e escrita por `licitacaoArtifactsService`; ela nao reutiliza `documentos_gerados`.

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
- o login SUAP via `suap-token-exchange` grava `user_metadata.matricula`; para usuarios cadastrados em `terceirizados`, essa matricula e usada para sincronizar `user_id`, aplicar permissoes e atribuir o grupo `terceirizado` em vez de `Diretores`
- o redirect OAuth do login SUAP e montado por `getSuapRedirectUri`: usa `VITE_APP_ORIGIN` quando configurada e cai para `window.location.origin` apenas como fallback; a mesma URI precisa ser enviada no authorize e na troca de token para evitar `Mismatching redirect URI`
- o login SUAP em localhost deve usar um client OAuth separado via `VITE_SUAP_CLIENT_ID`; a Edge Function seleciona `SUAP_DEV_CLIENT_SECRET` quando o `clientId` recebido corresponde a `SUAP_DEV_CLIENT_ID`, sem alterar o client de producao
- links de convite e recuperacao retornam para `/auth` com token na URL
- ao perder a sessao, qualquer rota protegida redireciona novamente para `/auth`
- botoes de upload/importacao no frontend so aparecem para o superadministrador autenticado

## 1B. Validação de relatório de pesquisa de preços

Uso:

- validação do QR Code emitido nos relatórios de pesquisa de preços

Arquivos:

- [PriceResearchValidation.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/PriceResearchValidation.tsx)
- [priceResearch.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/priceResearch.ts)
- [validar-pesquisa-precos/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/validar-pesquisa-precos/index.ts)

Contrato:

- o frontend chama a Edge Function `validar-pesquisa-precos` com `id` e `auth`
- a function usa service role para ler o snapshot salvo, recalcular o hash e devolver somente o resultado da conferência
- a rota `/pesquisa-precos/validar` não exige que o usuário autenticado seja o dono da pesquisa

Credenciais necessárias:

- `SUPABASE_SERVICE_ROLE_KEY` no ambiente da Edge Function

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
- `/api-de-dados/despesas/itens-de-empenho`
- `/api-de-dados/despesas/itens-de-empenho/historico`
- `/api-de-dados/despesas/empenhos-impactados`

Credenciais:

- o service atual usa `chave-api-dados`
- no desenvolvimento local, o proxy do Vite tambem injeta/sobrescreve `chave-api-dados` no servidor, usando `PORTAL_TRANSPARENCIA_API_KEY`, `VITE_PORTAL_TRANSPARENCIA_API_KEY` ou o fallback operacional atual do codigo

Observacao:

- existe chave de API embutida no service. Isso deve ser tratado como contrato operacional sensivel e idealmente sair do codigo.
- o modal de empenho e `/requisicao-compra` consultam subitens via cache Supabase em `portal_transparencia_empenho_itens_cache*`; quando o cache nao existe, esta vazio ou esta com erro, o frontend solicita a atualizacao server-side com `returnRows: true` e cai para `/despesas/itens-de-empenho` diretamente se a Edge Function nao responder. Quando o cache vencido possui linhas, elas permanecem visiveis enquanto a atualizacao roda em background. Em Requisicao de Compra, `valorAtual` do item e liquidacoes oficiais alimentam o saldo por item; o contrato e apenas enriquecimento opcional. A mesma function possui pre-aquecimento diario separado para todas as NEs com saldo positivo, em dois estagios: RAP e empenhos do exercicio.

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
- cron diario `sync-contratos-comprasnet-daily`, as `03:00` no horario de Brasilia, para as UGs `158366` e `158155`
- o botao administrativo "Atualizar Comprasnet" apenas antecipa a mesma sincronizacao automatica

Base usada:

- `/api-contratos/api`

Endpoints observados:

- `/contrato/ug/{unidadeCodigo}`
- `/contrato/inativo/ug/{unidadeCodigo}`
- `/contrato/{api_contrato_id}/empenhos`
- `/contrato/{api_contrato_id}/faturas`
- `/contrato/{api_contrato_id}/itens`
- `/contrato/{api_contrato_id}/historico`

Descoberta publica em tempo real no modal de empenho:

- o modal de [EmpenhoDialog.tsx](/C:/Users/3128880/Desktop/Programação/Sistema_Gerencial/src/components/modals/EmpenhoDialog.tsx) consulta a API publica via `contratosApiService.getLiquidacoesPublicasPorEmpenho`
- o fluxo nao usa `contratos_api*` como fonte
- a leitura do modal usa primeiro o cache Supabase em `contratos_api_empenho_liquidacoes_cache_status` e `contratos_api_empenho_liquidacoes_cache`
- enquanto as tabelas de cache ainda nao existirem em um ambiente, o frontend nao aciona a Edge Function a partir do modal; isso evita erros 404/CORS durante bootstrap antes da migration e do deploy da function
- se o status publico indicar linhas mas a leitura publica das linhas voltar vazia por problema de policy/RLS, o service usa a Edge Function em modo `readCacheOnly` como fallback de leitura com service role
- a Edge Function `refresh-comprasnet-liquidacoes-cache` faz a descoberta dinamica quando chamada pelo frontend ou cron, buscando contratos publicos ativos e inativos das UGs `158366` e `158155`, cobrindo empenhos emitidos pelo campus que estejam vinculados a contratos gerenciados pela Reitoria; depois filtra os contratos cujo endpoint `/empenhos` contenha o empenho alvo da UG `158366` e so entao consulta `/faturas`
- a vinculacao final usa `dados_empenho[]` dentro da fatura para decidir quais liquidações apareceram no modal; faturas com `contratante = 158155` continuam validas quando o empenho correspondente no endpoint `/empenhos` pertence a UG `158366`, e faturas de outros campi sao escondidas quando a API permite identificar essa divergencia
- `data_liquidacao` pode aparecer em payloads reais de `faturas`, mas nao esta garantida pelo schema OpenAPI; a UI deve tratá-la como opcional
- o cache usa TTL de 12 horas para resultados encontrados e 1 hora para `not_found`; o cron horario reprocessa entradas vencidas
- quando ha linhas vencidas, o frontend as entrega imediatamente e dispara a renovacao em background; a tela nao bloqueia o saldo por item esperando a consulta publica

Endpoints v1 avaliados nesta rodada:

- `/api/v1/contrato/faturas`
- `/api/v1/contrato/empenhoporuasg/{codigo_unidade_emitente}/{numero_empenho}`

Observacao operacional:

- os endpoints `v1` acima exigem `bearerAuth` no Swagger e responderam `401` nas chamadas diretas validadas em 23 de abril de 2026
- por isso, a descoberta de liquidações no modal ficou restrita aos endpoints publicos sob `/api/contrato/*`

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

- o endpoint `/contrato/ug/{unidadeCodigo}` nao e fonte confiavel de vigencia ativa sozinho; em maio/2026 ele ainda retornava como ativos contratos com `vigencia_fim` vencida
- a fonte de verdade operacional para exibicao de ativos e `contratos_api.situacao_derivada = true`, calculada pela maior `vigencia_fim` valida do historico; termos de rescisao/cancelamento tornam o contrato inativo. Como excecao, se o historico estiver vencido mas o contrato for ativo na API com faturas nos ultimos 120 dias, e reativado com motivo `historico_vencido_com_fatura_recente`
- quando nao ha termo com `vigencia_fim`, a sincronizacao preserva como ativo o contrato que a API informa ativo, desde que sua `vigencia_inicio` ja tenha ocorrido; esse caso fica registrado como `fallback_sem_historico_vigente_sem_data_final`. Nos demais casos sem historico, usa `vigencia_fim` da listagem como fallback
- contratos da UG `158366` entram no escopo se estiverem ativos pela regra derivada; contratos da UG `158155` entram somente com evidencia operacional estruturada do campus, como empenho ou fatura com UG/contratante `158366`, registrada em `campus_scope_reason`
- contratos em que a UASG `158366` aparece apenas como unidade de compra/origem, mas o objeto indica atendimento a outro campus avancado, como Parelhas ou Jucurutu, ficam fora do escopo com `campus_scope_reason = ug_campus_objeto_fora_currais_novos`
- para evitar limite de worker ao sincronizar a UG `158155`, a Edge Function busca primeiro historico e empenhos; faturas e itens so sao buscados para contratos ativos e dentro do escopo, ou quando a fatura ainda pode comprovar o escopo do campus
- a exibicao e os agregados operacionais usam somente empenhos da UG `158366`; empenhos de outros campi podem existir no contrato global da Reitoria, mas nao devem ser persistidos para a tela nem somados em valor empenhado ou saldo do campus
- execucao por item so deve ser exibida como oficial quando a fatura trouxer `dados_item_faturado[].id_item_contrato`; o total executado considera situacoes `Pago` e `Siafi Apropriado`
- a API fornece `aliquidar` no endpoint de empenhos e execucao contratual por item via `itens` + `faturas.dados_item_faturado`; ela nao garante rateio do saldo de um empenho entre itens, especialmente quando `dados_empenho` ou `dados_item_faturado` estiver ausente
- na Requisicao de Compra, o bloqueio principal usa o saldo local/SIAFI do empenho, igual a `/empenhos`; o saldo por item e empenho-centrico, vindo dos subitens da NE no Portal da Transparencia e abatendo liquidacoes historicas/cache da API publica de contratos quando houver match por subelemento, sem exigir contrato selecionado
- o historico de contrato deve mostrar os valores originais da API; variacoes derivadas entre termos nao sao valor oficial de aditivo
- o Valor Total da lista deve usar `contratos_api_historico` como fonte principal, somando `valor_inicial` de cada termo. `valor_global` da API nao entra nessa metrica porque pode representar outro consolidado/periodo e distorcer a leitura. Sem historico com `valor_inicial`, usar `contratos.valor` como fallback
- em contratos com `codigo_unidade_origem = 158155`, a UI deve sinalizar origem Reitoria e diferenciar valores globais do contrato da execucao do campus `158366`
- empenhos da API da UG `158366` alimentam o agregado de Valor Empenhado pelo campo `empenhado` na lista principal e tambem aparecem como badges/popovers quando ainda nao existem em `empenhos` + `contratos_empenhos`; quando o mesmo numero existir nas duas fontes, o badge local prevalece para preservar os saldos CSV/SIAFI. O drawer nao exibe uma secao propria de empenhos para evitar misturar saldos da API com a regra local de `empenhos`
- `Saldo dos empenhos` soma saldos locais e saldos de empenhos que existem apenas em `contratos_api_empenhos`; isso evita ocultar saldo de empenhos novos da API, como empenhos de exercicio ainda nao vinculados localmente, e evita usar campos de exercicio como saldo RAP
- a conciliacao entre `contratos_api_empenhos.numero` e `empenhos.numero` deve usar chaves equivalentes do empenho, incluindo o sufixo `AAAA NEXXXXXX` quando a API vier com prefixo de UG/gestao. Se houver empenho local correspondente, o saldo do SIAFI local prevalece sobre `valor_a_liquidar` da API
- Em RAP vindo apenas da API, o popover usa `rp_inscrito`, `rp_a_pagar` e os campos especificos preservados em `raw_data` (`rpaliquidar`, `rpliquidado`, `rppago`, `rpapagar` quando presente), evitando usar `aliquidar`/`pago` do exercicio como saldo de RAP
- para empenho antigo vindo apenas da API, `rp_a_pagar = 0` e saldo zero valido e nao deve cair para `valor_a_liquidar`; esse campo de exercicio pode ficar defasado em restos a pagar ja quitados
- nos itens do drawer, o contratado deve somar `historico_item[].valor_total` quando a API trouxer historico por item; `valor_total` do item e fallback sem historico
- quando a API trouxer o `historico_item`, o drawer deve exibir tambem seus campos operacionais por termo: `tipo_historico`, `data_termo`, `quantidade`, `valor_unitario` e `valor_total`
- no resumo de itens do drawer, `Contratado` e `Executado` tambem devem mostrar quantidade agregada: contratado pela soma de `historico_item[].quantidade` quando houver historico, e executado pela soma de `quantidade_faturado` nas faturas `Pago` ou `Siafi Apropriado`
- quando houver `dados_item_faturado`, o drawer deve exibir tambem `quantidade_faturado` e `valor_unitario_faturado` na linha da fatura
- a tela de contratos usa a lista sincronizada de `contratos_api` filtrada por `situacao_derivada`; dados locais de `contratos` e `contratos_empenhos` servem apenas como complemento para favoritos, CNPJ e saldos locais quando houver match por numero normalizado
- Documentos e PDFs oficiais do contrato e seus termos aditivos sao consultados via API do PNCP em `https://pncp.gov.br/api/pncp/v1/orgaos/{cnpj}/contratos/{ano}/{sequencial}/arquivos`, armazenados persistentemente na tabela `contratos_api_documentos` e atualizados diariamente às 05:00 BRT pelo job `sync-contratos-pncp-documentos`. O modal `ContratoApiDetailsSheet.tsx` carrega os documentos diretamente do banco de dados (0 ms de espera) com suporte a reconsulta sob demanda via `pncpContratos.ts`.
- Rastreabilidade de Notas Fiscais Eletrônicas (NF-e) e Instrumentos de Cobrança consultados via API do PNCP em `https://pncp.gov.br/api/pncp/v1/orgaos/{cnpj}/contratos/{ano}/{sequencial}/instrumentocobranca` através de `pncpInstrumentosCobranca.ts`, persistidos na tabela `contratos_api_instrumentos_cobranca` e sincronizados diariamente às 05:00 BRT pelo job `sync-contratos-pncp-documentos`. Expõe chave de acesso de 44 dígitos da SEFAZ, status de autorização fiscal, itens faturados discriminados com NCM/CFOP, cópia em 1 clique, link para o Portal da SEFAZ e conciliação automática com faturas do Comprasnet/SIAFI em `ContratoNfeRastreabilidade.tsx` com carregamento imediato a partir do banco de dados (0 ms de espera).

## 4A. Supabase Database para Energia Campus

Uso:

- painel `/energia` e rotas filhas de COSERN, Mercatto, geração solar, contratos, financeiro e ESG
- persistência da planilha XLSX `Levantamento de Consumo - COSERN.xlsx`

Service:

- [energiaCampusService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/energiaCampusService.ts)

Persistencia local:

- `energia_import_runs`
- `energia_consumo_faturas`
- `energia_solar_geracao`
- `energia_contratos`
- `energia_contrato_execucoes`
- `contratos_api`
- `contratos_api_faturas`
- `contratos_api_empenho_liquidacoes_cache`

Observacao:

- não há Edge Function nova neste corte
- leitura é liberada para usuarios autenticados
- escrita é restrita ao superadministrador por RLS
- Mercatto usa kWh real quando a coluna L da aba `Consumo` indica ambiente livre; na Visão Geral, contratos, faturas e liquidacoes do modulo de contratos também podem alimentar kWh estimado pela tarifa média conhecida quando não houver kWh direto no período

## 4B. PNCP e Dados Abertos Compras.gov.br para Pregoes

Uso:

- lista operacional de pregoes por qualquer UASG, periodo, objeto especifico e item PNCP materializado
- base futura para preenchimento de metadados em artefatos de licitacao
- consulta em tempo real de empenhos vinculados à licitação e cálculo do saldo restante de cada item via API do Portal da Transparência (`/api-de-dados/licitacoes/empenhos` e `/api-de-dados/despesas/itens-de-empenho`)

Fonte primaria:

- `https://pncp.gov.br/api/consulta` (editais e publicacoes)
- `https://pncp.gov.br/api/pncp` (itens e detalhes de compras)
- `https://api.portaldatransparencia.gov.br` (consulta de empenhos e itens de empenho)

Endpoints PNCP e CGU usados:

- `/api/consulta/v1/contratacoes/publicacao`
- `/api/consulta/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}`
- `/api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens`
- `/api-de-dados/licitacoes/empenhos` (Portal da Transparência)
- `/api-de-dados/despesas/itens-de-empenho` (Portal da Transparência)

Parametros operacionais:

- UASG inicial da tela: vazia; a lista e a busca padrao consultam o banco local e sincronizam todas as 19 UASGs do catalogo do IFRN
- CNPJ da consulta PNCP: resolvido primeiro pelo catalogo interno IFRN em `IFRN_UASG_CATALOG`; para UASGs fora do catalogo, a function usa Dados Abertos Compras.gov.br; `LICITACOES_PNCP_CNPJ=10877412000168` fica como default operacional
- UASGs IFRN em cache interno: `152711`, `152756`, `152757`, `154582`, `154838`, `154839`, `154840`, `158155`, `158365`, `158366`, `158367`, `158368`, `158369`, `158370`, `158371`, `158372`, `158373`, `158374`, `158375`
- pregao eletronico: `codigoModalidadeContratacao = 6`
- datas PNCP em `yyyyMMdd`
- janela maxima de consulta: 365 dias
- o endpoint de publicacao nao recebe `tamanhoPagina`; enviar esse parametro produz `HTTP 400`
- o endpoint PNCP de publicacao e usado para UASG/data/modalidade; busca textual por objeto fica como filtro local sobre os dados retornados/materializados
- o endpoint PNCP de itens (`/api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens`) e chamado por padrao durante as sincronizacoes; os itens retornados sao gravados em `licitacoes_pncp.raw_data.itens` para permitir pesquisa local instantanea e alimentacao do drawer de detalhes com saldo de empenho

Fonte secundaria best-effort:

- `https://dadosabertos.compras.gov.br`
- `/modulo-uasg/1_consultar…4038 tokens truncated…ecoes copiaveis, campos, alertas e pendencias; se nao houver chave Gemini, monta um fallback local com as respostas e pendencias recebidas
- se a chamada a function falhar no frontend por indisponibilidade, CORS ou function ainda nao publicada, `preliminaryStudiesService` monta o mesmo tipo de rascunho por fallback local para nao bloquear o usuario
- a versao atual nao usa modelo DOCX para o ETP, nao grava rascunhos no banco, nao persiste anexos auxiliares e nao faz OCR de PDF escaneado
- snippets auxiliares chegam com `sourceType: "anexo"` e podem trazer `sourceName`, `sourceLabel`, `pageNumber` opcional, `kind` e `excerpt`; arquivos brutos nunca sao enviados para a function; contexto institucional chega separado como apoio de redacao e nunca deve ser citado como anexo, fonte, referencia ou trecho textual
- anexos auxiliares opcionais sao apoio para preencher informacoes especificas exigidas por perguntas/secoes; nao devem mudar o foco, o escopo ou a narrativa principal definidos pelo processo, objeto manual e respostas aprovadas
- contexto institucional do `Campus Currais Novos` identifica a unidade demandante real e nao deve ser convertido em exemplo dentro de marcador pendente

## 7G. Edge Function `sugerir-respostas-etp-servicos-continuos`

Uso:

- pre-preenchimento assistido do questionario fixo do ETP de servicos continuos
- chama Gemini antes da etapa manual para sugerir respostas com fonte explicita apenas no PDF/texto do processo; anexos auxiliares sao filtrados desse preenchimento automatico

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

- sugestoes sem `sourceExcerpt`, `justification` e `value` sao descartadas e tratadas como pendentes; fontes de processo devem trazer `sourcePage`
- anexos locais nao sao persistidos nem enviados brutos; no fluxo de sugestoes automaticas, snippets auxiliares e contexto institucional sao filtrados para nao virarem resposta com fonte explicita
- anexos auxiliares como CCT, planilhas ou memorias ficam disponiveis apenas como apoio pontual para geracao/revisao de secoes; eles nao devem preencher automaticamente perguntas do questionario
- quando nao houver trechos do PDF ou quando a function nao responder, o fluxo segue pelo questionario manual

## 7H. Edge Function `gerar-texto-etp-secao`

Uso:

- geracao assistida de texto para uma secao individual do questionario fixo do ETP de servicos continuos
- recebe a pergunta atual, notas digitadas pelo usuario quando houver, objeto manual, metadados do processo, respostas ja registradas, trechos do PDF sincronizado, snippets auxiliares de anexos locais opcionais e contexto institucional do campus para pano de fundo
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
- anexos auxiliares opcionais entram apenas como apoio pontual da pergunta atual; se nao houver relacao clara com a secao, a function deve ignorar o anexo e manter o foco no objeto, processo, notas e respostas ja registradas
- a geracao orienta a IA a evitar repetir excessivamente dados contextuais ja estabelecidos em respostas anteriores, usando-os novamente apenas quando forem relevantes para a secao atual
- contexto institucional do `Campus Currais Novos` identifica a unidade demandante real e nao deve ser convertido em exemplo dentro de marcador pendente

## 6B. Edge Function `assistente-gerencial`

Uso:

- widget global de perguntas gerenciais sobre dados do sistema
- responde sobre orcamento, empenhos, creditos disponiveis, documentos habeis, financeiro, contratos API, PFs e conciliacao a partir de agregacoes deterministicas allowlisted
- nao substitui o `consultor`, que continua juridico/normativo

Chamador:

- [AIAssistantWidget.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/ai/AIAssistantWidget.tsx)
- [assistenteGerencial.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/assistenteGerencial.ts)

Implementacao no repo:

- [assistente-gerencial/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/assistente-gerencial/index.ts)
- [assistente-gerencial/domain.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/assistente-gerencial/domain.ts)

Dependencias externas:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`
- opcional `GEMINI_ASSISTENTE_GERENCIAL_MODEL`

Observacao:

- o frontend chama `supabase.functions.invoke('assistente-gerencial')`, deixando o `supabase-js` enviar o JWT da sessao
- a function valida o usuario com `supabase.auth.getUser()` e consulta dados com o token do proprio usuario, respeitando RLS
- a function detecta intencao, calcula resumos por dominio e envia ao Gemini apenas os totais/evidencias/limitacoes ja apurados
- em descentralizacoes, o detalhamento por Campus Currais Novos usa o escopo natural dos dados do sistema e agrega por `origem_recurso` (PTRES) e `plano_interno` (PI)
- em contratos, a fonte principal e `contratos_api*`, com ativos por `situacao_derivada = true` e separacao entre Campus `158366` e Reitoria `158155` quando houver `campus_scope_reason`

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
- fotos opcionais de ocorrencias de limpeza e manutencao

Chamador:

- [suapProcessos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/suapProcessos.ts)
- [manutencao.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/manutencao.ts)

Buckets observados:

- `suap-pdfs`
- `manutencao-ocorrencias`

Contrato de `manutencao-ocorrencias`:

- bucket privado
- upload publico restrito por policy a um diretorio UUID de ambiente e arquivo UUID com extensao `jpg`, `png` ou `webp`
- limite de 5 MB e MIME types `image/jpeg`, `image/png` e `image/webp`
- leitura autenticada; o frontend administrativo usa URL assinada temporaria

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

## 11. Sincronizacao Nativa SUAP

Uso:

- Sincronizacao direta e nativa da caixa de processos do SUAP para a tabela `processos`
- Download de PDFs e envio para o bucket `suap-pdfs`, como etapa independente ou dentro do fluxo completo
- Extracao por IA no backend via Gemini; antes da IA o frontend nao busca beneficiario, contrato, valores, dados bancarios ou outros metadados alem de ID e numero do processo
- Geracao local de `Despacho de Liquidacao` na propria tela `/suap`, avulso ou por processo/em lote; o modo avulso usa preenchimento manual e aceita processo opcional, enquanto os demais reaproveitam os dados do processo e o resultado ja persistido da extracao por IA

Fluxo Tecnico:

- O frontend realiza as chamadas de scraping e download fazendo requests ao SUAP atraves da Edge Function `suap-proxy` (evitando bloqueios de CORS).
- A sincronizacao de inventario, o download de PDF e a extracao por IA sao etapas modulares e podem ser repetidas separadamente para processos escolhidos pelo usuario.
- Processos ja sincronizados e seus PDFs sao preservados. O inventario reconcilia os vinculos em `suap_processo_caixas` apenas das caixas selecionadas e lidas com sucesso; processos ausentes deixam de aparecer sem exclusao permanente.
- As credenciais de acesso do SUAP sao mantidas no `localStorage` apos o login/cookie informado pelo usuario.
- O despacho nao aciona uma nova Edge Function ou uma nova chamada de IA: o frontend monta o documento com `documentGeneration`, permite trocar localmente o modelo da minuta a partir dos dados ja resolvidos, copia pelo `suapClipboard` e cria a URL de clonagem com `suapCloneAutomation`. A fila de documentos em andamento usa `sessionStorage` e cada clonagem e confirmada individualmente. Depois da confirmacao no formulario de clone, a extensao abre diretamente `/documento_eletronico/editar_documento/<id>/` quando o SUAP exibe a visualizacao; se houver redirecionamento para a listagem, localiza o rascunho com o assunto exato e abre a mesma rota para injetar o HTML, sem salvar o texto automaticamente.
- A extensao tambem atende `processo/{id}` e `visualizar_processo/{id}`: o content script abre `/suap-extensao/despacho` em iframe, aguarda `siages:suap-dispatch-ready` e envia `{ suapId, processNumber, processUrl }` por `postMessage`. A rota aceita apenas mensagens da janela pai com origem `https://suap.ifrn.edu.br`, consulta `processos` pelo `suap_id` sob RLS do usuario e usa despacho avulso quando nao houver espelho. A rota possui `Content-Security-Policy: frame-ancestors https://suap.ifrn.edu.br`.
- Para apoiar a analise do processo sem troca de aba, o content script tambem cria um card financeiro no HTML do SUAP e um iframe oculto em `/suap-extensao/processo-info`. O iframe anuncia `siages:suap-process-info-ready`; a extensao responde com o contexto validado e a sessao de curta duracao que esta no armazenamento privado do popup. O service worker renova essa sessao com o refresh token antes do vencimento, inclusive com o popup fechado; a sessao e apagada somente no logout ou quando a renovacao for recusada. O iframe aceita essa sessao somente da janela pai `https://suap.ifrn.edu.br`, permitindo a consulta sob RLS sem depender de cookies de terceiros, e desativa o auto-refresh local para nao competir pelo refresh token. Ele monta o resumo com `empenhos`, `contratos`, `contratos_empenhos`, `contratos_api`, `contratos_api_empenhos` e cache local `contratos_api_empenho_liquidacoes_cache`. A leitura e local/cache: nao cria banco, Edge Function nova nem refresh automatico de APIs externas ao abrir a pagina. Se houver contrato no processo, filtra pelo contrato; se nao houver beneficiario identificado, nao exibe card. O payload do card expoe apenas empenhado, saldo e liquidacoes detalhadas por empenho, sem campos de pagamento. O card e o botao `Gerar documento` formam um unico painel fixo no canto inferior direito, independente da estrutura de colunas do SUAP; a chave de conciliacao aceita tanto o numero resumido quanto o numero longo do empenho da API.

Consumidores no app:

- [Suap.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Suap.tsx)
- [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx)

Observacao:

- A extensao Chrome nao e necessaria para sincronizar caixas: essa etapa ocorre diretamente pelo componente `<SuapSyncPanel>`, aberto pelo menu do usuario em `Configurar integração com o SUAP`. As caixas sao cadastradas manualmente; nao ha auto-descoberta. A extensao permanece necessaria para o clone automatico e para gerar o despacho sem sair da pagina do processo no SUAP.
- O usuario deve manter a aba ativa no navegador durante o download de PDFs em razao das requisicoes assincronas do Celery.

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

## YouTube embeds para EAD de Pesquisa de Precos

Uso:

- exibir aulas do catalogo `/pesquisa-precos/ead` por iframe incorporado

Arquivos:

- `src/pages/PriceResearchEad.tsx`
- `src/services/priceResearchEad.ts`
- `src/lib/youtube.ts`

Contrato:

- o sistema valida URLs `youtube.com`, `youtu.be`, Shorts e embed para extrair `youtube_video_id`
- o player usa `https://www.youtube-nocookie.com/embed/<video_id>`
- nao ha chamada a API do YouTube nem chave de ambiente
- metadados das aulas ficam em `price_research_ead_videos`; cadastro e manutencao sao restritos ao superadministrador por RLS
## Pesquisa de preços oficial

Uso:

- recuperar até 100 referências de preço homologado por item importado;
- apoiar a pesquisa exigida pela IN SEGES/ME nº 65/2021;
- ordenar aderência técnica sem modificar valores oficiais.

Fonte primária:

- `https://dadosabertos.compras.gov.br`
- `/modulo-pesquisa-preco/1_consultarMaterial`
- `/modulo-pesquisa-preco/3_consultarServico`

Par?metros principais:

- `codigoItemCatalogo`
- `dataCompraInicio`
- `dataCompraFim`
- `pagina`
- `tamanhoPagina`
- filtros opcionais enviados pelo frontend; somente `dataCompraInicio` e `dataCompraFim`, alem do codigo de catalogo e paginacao, entram na URL oficial quando informados; demais filtros sao aplicados sobre o payload retornado

Implementação:

- `supabase/functions/pesquisar-precos/index.ts`
- `src/services/priceResearch.ts`
- `src/pages/PesquisaPrecos.tsx`

Observações operacionais:

- a janela consultada é de 12 meses;
- CATMAT usa o endpoint de material e CATSER usa o endpoint de serviço;
- a função preserva a URL exata da consulta e o payload oficial no snapshot;
- o PNCP é usado como rastreabilidade complementar da contratação, não como substituto automático do preço homologado;
- quando houver segredo Gemini, a IA reordena no máximo 40 candidatos pela aderência técnica;
- quando não houver segredo ou a chamada Gemini falhar, a ordenação heurística determinística continua funcionando;
- a function exige sessão Supabase autenticada e limita a chamada a 25 itens.

## gerar-etp-comprasnet

Function chamada pela extensão na rota oficial de edição de ETP.

- Entrada: objeto/contexto manual, processo opcional, questionário geral com 13 seções textuais, conteúdo existente, snippets de processo/anexos e `generationPreferences` validado (extensão, formato, ênfases, fontes, tratamento do texto e checklist por seção).
- Saída: prévia com seções, alertas, pendências, campos e modelo utilizado.
- Usa Gemini `gemini-2.5-flash-lite` com fallback para `gemini-2.5-flash`; sem chave, retorna rascunho local determinístico.
- Não grava anexos, textos gerados, preferências, campos estruturados ou status de conclusão. Preferências persistentes são responsabilidade exclusiva da extensão em `chrome.storage.sync`.
- A extensão sanitiza o HTML e controla a aplicação; a function nunca acessa o certificado ou a sessão do Comprasnet.

## Ponte da extensao Suape 1.9

- Origem SIAGES fixa: `https://www.siages.com.br`.
- Entrada: contexto autenticado do processo SUAP enviado ao iframe `/suap-extension/process-info`.
- Saidas: snapshot do processo, resumo financeiro e progresso de sincronizacao.
- PDF: o iframe solicita a geracao ao content script; a resposta aceita somente a origem, a janela e o `suapId` esperados e transporta um `ArrayBuffer`, nunca tokens.
- Persistencia: `suapScraperService.storePdfBytesForProcess` grava o PDF no bucket existente `suap-pdfs`; a fila continua sendo a Edge Function existente `process-pdf`.
- Autenticacao da extensao: o popup e o painel usam o grant `password` de `/auth/v1/token` com a mesma anon key vigente do projeto; o campo deve receber o e-mail cadastrado no Supabase Auth do SIAGES (nao a matricula do SUAP). Respostas `401` sao exibidas como credencial SIAGES recusada.
- Persistencia da sessao (extensao 1.9.20): o service worker e o unico responsavel por renovar o `refresh_token`, com serializacao para impedir renovacoes concorrentes. A sessao permanece armazenada em falhas de rede ou de renovacao e so e removida pelo logout explicito.
- Nao foram adicionados endpoints, migrations ou Edge Functions.

- O callback suap-token-exchange tambem procura a matricula normalizada em registros legados de terceirizados; perfis do grupo terceirizado sao direcionados a /requisicao-compra e podem abrir /contratos. Nessa tela, o frontend filtra os contratos por `terceirizado_permissions.contrato_id`; na consulta de requisicao, a ausencia de cache de liquidacoes dispara atualizacao assincrona e nao bloqueia a exibicao do saldo base do subitem.

- O consumo do cache de itens de empenho revalida registros not_found e faz fallback direto ao Portal da Transparencia para evitar que uma falha transitoria oculte subitens reais.

## Revisão normativa de documentos SUAP

`process-document.js` -> iframe `/suap-extensao/documento-analise` -> `analisar-documento-licitacao` -> OpenAI Responses com PDF inline (principal) -> Gemini `generateContent` com grounding de busca (fallback).

- A extensão fornece o PDF diretamente da aba autenticada do SUAP; não envia cookies ao SIAGES, à OpenAI ou ao Gemini.
- O backend aceita somente tipos `tr`/`etp`, autentica o usuário pelo JWT e valida o PDF antes do processamento.
- A OpenAI é tentada primeiro; ausência de chave, erro HTTP, timeout, resposta sem conteúdo ou JSON inválido acionam o fallback Gemini.
- Fontes permitidas para citações: Planalto, Portal de Compras do Governo Federal e Imprensa Nacional. A resposta informa data de consulta e limitações.
- O resultado nao altera documentos do SUAP e nao depende da base local de normativos; cada analise concluida e salva em `suap_document_reviews` para consulta futura pelo icone de historico ao lado do icone de geracao.
## Sincronizacao do Plano SUAP

- Endpoint: `POST /functions/v1/sync-suap-plan`, sempre autenticado pelo JWT do SIAGES.
- Acoes: `connect`, `connect-cookie`, `sync`, `sync-html`, `apply`, `status` e `disconnect`.
- `sync` usa a sessao SUAP cifrada no backend. `sync-html` recebe somente o HTML capturado da URL canonica do Plano 8 e nao exige `suap_connections` nem novo login SUAP.
- O HTML enviado pela extensao e validado por host/caminho, tamanho maximo de 15 MB e parser com IDs estaveis; URLs arbitrarias e conteudo incompleto sao rejeitados.
- O parser captura a coluna oficial `Saldo disponível para empenho da atividade (R$)` e o snapshot/materialização preserva esse valor em `atividades.saldo_disponivel` para o drill-down do Dashboard.
- A primeira execucao fica em `preview`; depois da conferencia, `apply_suap_plan_snapshot` atualiza/inclui os registros e arquiva os ausentes sem exclusao fisica.
- O Campus nao depende da extensao. Quando a extensao e usada no popup, ela captura a aba SUAP atual e envia o HTML ao backend; na pagina Campus ela apenas dispara `siages:suap-plan-sync-request`.
- O popup mantem o `runId` da previa em `chrome.storage.local` e oferece a aplicacao explicita pelo mesmo endpoint, sem abrir uma aba do SIAGES.
