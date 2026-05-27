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
- `/api-de-dados/despesas/itens-de-empenho`
- `/api-de-dados/despesas/itens-de-empenho/historico`
- `/api-de-dados/despesas/empenhos-impactados`

Credenciais:

- o service atual usa `chave-api-dados`
- no desenvolvimento local, o proxy do Vite tambem injeta/sobrescreve `chave-api-dados` no servidor, usando `PORTAL_TRANSPARENCIA_API_KEY`, `VITE_PORTAL_TRANSPARENCIA_API_KEY` ou o fallback operacional atual do codigo

Observacao:

- existe chave de API embutida no service. Isso deve ser tratado como contrato operacional sensivel e idealmente sair do codigo.
- o modal de empenho consulta subitens via cache Supabase em `portal_transparencia_empenho_itens_cache*`; quando o cache nao existe ou venceu, o frontend chama a Edge Function `refresh-portal-transparencia-itens-cache`, que consulta `/despesas/itens-de-empenho` pelo servidor usando `codigoDocumento = UG + gestao + numero do empenho` e salva as linhas no cache. A UI exibe apenas descricao e subelemento; o service tambem mapeia `valorAtual` e historico por sequencial para uso futuro, mas esses valores nao entram na UI porque a base do Portal pode ter atraso operacional.

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
- a fonte de verdade operacional para exibicao de ativos e `contratos_api.situacao_derivada = true`, calculada pela maior `vigencia_fim` valida do historico; termos de rescisao/cancelamento tornam o contrato inativo
- quando nao ha historico, a sincronizacao usa `vigencia_fim` da listagem como fallback e registra o motivo em `situacao_derivada_motivo`
- contratos da UG `158366` entram no escopo se estiverem ativos pela regra derivada; contratos da UG `158155` entram somente com evidencia operacional estruturada do campus, como empenho ou fatura com UG/contratante `158366`, registrada em `campus_scope_reason`
- contratos em que a UASG `158366` aparece apenas como unidade de compra/origem, mas o objeto indica atendimento a outro campus avancado, como Parelhas ou Jucurutu, ficam fora do escopo com `campus_scope_reason = ug_campus_objeto_fora_currais_novos`
- para evitar limite de worker ao sincronizar a UG `158155`, a Edge Function busca primeiro historico e empenhos; faturas e itens so sao buscados para contratos ativos e dentro do escopo, ou quando a fatura ainda pode comprovar o escopo do campus
- a exibicao e os agregados operacionais usam somente empenhos da UG `158366`; empenhos de outros campi podem existir no contrato global da Reitoria, mas nao devem ser persistidos para a tela nem somados em valor empenhado ou saldo do campus
- execucao por item so deve ser exibida como oficial quando a fatura trouxer `dados_item_faturado[].id_item_contrato`; o total executado considera situacoes `Pago` e `Siafi Apropriado`
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

## 4B. PNCP e Dados Abertos Compras.gov.br para Pregoes

Uso:

- lista operacional de pregoes por qualquer UASG, periodo e objeto especifico
- base futura para preenchimento de metadados em artefatos de licitacao

Fonte primaria:

- `https://pncp.gov.br/api/consulta`

Endpoints PNCP usados:

- `/v1/contratacoes/publicacao`
- `/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}`

Parametros operacionais:

- UASG inicial da tela: `158366`
- CNPJ da consulta PNCP: resolvido primeiro pelo catalogo interno IFRN em `IFRN_UASG_CATALOG`; para UASGs fora do catalogo, a function usa Dados Abertos Compras.gov.br; `LICITACOES_PNCP_CNPJ=10877412000168` fica apenas como default operacional
- UASGs IFRN em cache interno: `152711`, `152756`, `152757`, `154582`, `154838`, `154839`, `154840`, `158155`, `158365`, `158366`, `158367`, `158368`, `158369`, `158370`, `158371`, `158372`, `158373`, `158374`, `158375`
- pregao eletronico: `codigoModalidadeContratacao = 6`
- datas PNCP em `yyyyMMdd`
- janela maxima de consulta: 365 dias
- quando `codigoUnidadeAdministrativa` e enviado, o PNCP tambem exige `cnpj`; por isso a function usa o catalogo interno ou chama `/modulo-uasg/1_consultarUasg` para descobrir o CNPJ da UASG antes da consulta PNCP
- o endpoint PNCP de publicacao e usado para UASG/data/modalidade; busca textual por objeto fica como filtro local sobre os dados retornados/materializados

Fonte secundaria best-effort:

- `https://dadosabertos.compras.gov.br`
- `/modulo-uasg/1_consultarUasg`
- `/modulo-uasg/1.1_consultarUasg_CSV`
- a function usa o CSV como fonte primaria para resolver CNPJ da UASG porque o endpoint JSON de UASG pode responder `400` para `statusUasg=true`

Implementacao:

- [sync-licitacoes-pncp/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/sync-licitacoes-pncp/index.ts)
- [licitacoesPncp.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/licitacoesPncp.ts)
- [licitacoesPncp.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/licitacoesPncp.ts)
- [LicitacoesPregoes.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/LicitacoesPregoes.tsx)

Persistencia local:

- `licitacoes_pncp`
- `licitacoes_pncp_sync_runs`
- `licitacoes_pncp_uasgs`

Observacao operacional:

- os endpoints de pregoes e contratacoes dos Dados Abertos Compras.gov.br existem no OpenAPI, mas responderam com instabilidade/timeout na validacao inicial. Por isso, a v1 nao depende deles para listar pregoes.

## 4C. Dados Abertos Compras.gov.br para Atas/ARP

Uso:

- lista operacional de Atas de Registro de Precos por UASG e tipo de vinculo
- identificacao de atas gerenciadas, unidades participantes e adesoes por item

Fonte primaria:

- `https://dadosabertos.compras.gov.br`

Endpoints usados:

- `/modulo-arp/1_consultarARP`
- `/modulo-arp/2_consultarARPItem`
- `/modulo-arp/3_consultarUnidadesItem`
- `/modulo-arp/5_consultarAdesoesItem`

Parametros operacionais:

- `codigoUnidadeGerenciadora` para atas gerenciadas
- `dataVigenciaInicialMin` e `dataVigenciaInicialMax` em `YYYY-MM-DD`
- `numeroAta`, `unidadeGerenciadora` e `numeroItem` para detalhar participantes e adesoes por item
- `unidade` em `/modulo-arp/5_consultarAdesoesItem` para filtrar adesoes da UASG alvo
- o OpenAPI dos Dados Abertos nao oferece filtro direto de `/modulo-arp/3_consultarUnidadesItem` por UASG participante nem listagem direta de todas as adesoes por UASG aderente; para encontrar atas em que um campus IFRN e participante ou aderente, a aplicacao materializa o cache das atas gerenciadas pelas UASGs IFRN e depois filtra localmente a view `atas_registro_precos_resumo`

Implementacao:

- [sync-atas-registro-precos/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/sync-atas-registro-precos/index.ts)
- [atasRegistroPrecos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/atasRegistroPrecos.ts)
- [AtasRegistroPrecos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/AtasRegistroPrecos.tsx)

Persistencia local:

- `atas_registro_precos`
- `atas_registro_precos_itens`
- `atas_registro_precos_unidades`
- `atas_registro_precos_adesoes`
- `atas_registro_precos_sync_runs`
- view `atas_registro_precos_resumo`

Observacao operacional:

- os endpoints de ARP podem responder com timeout/erro interno. A Edge Function registra falhas por escopo e mantem sucesso parcial quando alguma parte foi materializada.
- em maio/2026, `/modulo-arp/1_consultarARP` tambem retornou `400` com erro interno `Could not open JPA EntityManager for transaction` mesmo com parametros validos do OpenAPI; nesses casos a UI deve exibir aviso operacional e manter a lista com dados ja materializados, sem mostrar a URL tecnica da API ao usuario.
- a busca principal da tela chama a Edge Function com `includeDetalhes=false` para evitar timeout HTTP: primeiro materializa somente as atas retornadas por `/modulo-arp/1_consultarARP`; itens, participantes e adesoes ficam para enriquecimento posterior.
- quando a chamada ao Compras.gov.br falha, o frontend deve recarregar a lista a partir do cache Supabase ja materializado e exibir aviso operacional, sem transformar indisponibilidade externa em lista vazia.
- quando o filtro da tela e `Participante` para uma UASG IFRN conhecida, o frontend aciona a sincronizacao em lotes do catalogo IFRN com `includeParticipantes=true`; isso materializa itens e unidades participantes sem consultar adesoes, reduzindo risco de timeout e permitindo listar atas em que o campus nao e gerenciador.
- quando o filtro da tela e `Aderente` para uma UASG IFRN conhecida, o frontend tambem varre o catalogo IFRN como conjunto de gerenciadoras, mas envia `adesaoUnidadeCodigos` com a UASG alvo; isso evita confundir a gerenciadora varrida com a unidade que aderiu.
- a Edge Function usa timeout curto ao chamar Dados Abertos para devolver erro operacional antes do limite de gateway da Supabase quando o Compras.gov.br fica sem resposta.
- o drawer de detalhes exibe metadados preservados em `raw_data` da ata e permite enriquecer uma ata especifica sob demanda com `includeDetalhes=true` e `numeroAta`, limitando a consulta para reduzir risco de timeout.
- no enriquecimento sob demanda, a function evita chamar `/modulo-arp/1_consultarARP` novamente porque esse endpoint pode falhar com `numeroAtaRegistroPreco`; ela consulta diretamente os endpoints de itens e vinculos usando a ata ja materializada.

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
- recebe do frontend o modelo DOCX ativo ja parseado localmente, o questionario revisado do modelo, as respostas ou pulos do usuario, trechos relevantes do PDF do processo sincronizado no SUAP quando houver e snippets do ETP editado quando o TR nasce de um ETP

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
- sem modelo ativo em `document_templates`, o bloqueio acontece no frontend
- quando iniciado a partir do fluxo ETP -> Mapa de Risco, a chamada pode vir sem processo SUAP; nesse caso o contexto obrigatorio vem de snippets `sourceType: "etp"` e `sourceType: "mapa_riscos"` com `sourceLabel` e `sourceExcerpt`

## 7D. Edge Function `sugerir-respostas-termo-referencia`

Uso:

- pre-preenchimento assistido do questionario do Termo de Referencia
- chama Gemini antes da etapa manual para sugerir respostas com fonte explicita no PDF do processo ou no ETP editado no editor
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

- sugestoes sem fonte explicita sao descartadas e tratadas como pendentes; fontes do processo precisam trazer `sourcePage`, `sourceExcerpt` e `justification`, enquanto fontes ETP ou Mapa de Risco podem omitir pagina se trouxerem `sourceType: "etp"` ou `sourceType: "mapa_riscos"`, `sourceLabel`, `sourceExcerpt` e `justification`
- a geracao final continua em `gerar-termo-referencia-compras`

## 7E. Edge Function `gerar-mapa-riscos-licitacao`

Uso:

- geracao assistida do Mapa de Risco da licitacao a partir do ETP editado no Editor de Documentos

Chamador:

- [riskMaps.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/riskMaps.ts)

Implementacao no repo:

- [gerar-mapa-riscos-licitacao/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/gerar-mapa-riscos-licitacao/index.ts)

Dependencias externas:

- `GEMINI_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY` ou `GOOGLE_API_KEY`
- opcional `GEMINI_RISK_MAP_MODEL`

Observacao:

- a function usa Gemini via REST e devolve HTML editavel com tabela de riscos contendo fase, risco, causa, dano, probabilidade, impacto, nivel, acao preventiva, acao de contingencia e responsavel
- se a function falhar ou nao estiver publicada, `riskMapsService` monta fallback local para nao bloquear o fluxo ETP -> Mapa de Risco -> TR
- o deploy segue o padrao do Editor com `verify_jwt = false`

## 7F. Edge Function `gerar-etp-servicos-continuos`

Uso:

- geracao assistida do Estudo Tecnico Preliminar para servicos continuos no Editor de Documentos
- recebe metadados do processo SUAP quando disponiveis, objeto digitado manualmente, questionario fixo do ETP, respostas ou pulos do usuario, trechos relevantes do PDF sincronizado, snippets auxiliares extraidos localmente de anexos opcionais PDF, XLSX, XLS, ODS, CSV, TXT, MD e DOCX e contexto institucional do campus com `sourceType: "institucional"`

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
