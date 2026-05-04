# DATA_FLOW

Este documento resume como os dados chegam ao frontend e circulam pelas paginas.

## Camada 1: rotas

As rotas sao lazy-loaded em [App.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/App.tsx).

Cada rota cai em uma pagina em `src/pages`.

## Camada 0: sessao e autenticacao

Antes das paginas protegidas ou autenticadas, o app passa por:

- [AuthContext.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/contexts/AuthContext.tsx)
- [ProtectedRoute.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/auth/ProtectedRoute.tsx)
- [Auth.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Auth.tsx)
- [supabase.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/supabase.ts)

Esse fluxo agora concentra:

- leitura inicial de sessao via `supabase.auth.getSession`
- sincronizacao de mudancas por `onAuthStateChange`
- login por e-mail e senha via `signInWithPassword`
- aceite de convite ou recuperacao de acesso na rota publica `/auth`
- definicao de senha inicial por `supabase.auth.updateUser`
- encerramento da sessao no cabecalho global do layout
- protecao de todas as rotas por um guard central antes do `Layout`
- derivacao local de permissoes de superadministrador pelo e-mail autenticado
- carregamento das permissoes de tela do usuario em `AuthContext`
- bloqueio de acesso direto por rota em `ProtectedRoute`
- filtro dos itens da sidebar pelo catalogo central de telas em `src/lib/appScreens.ts`

### Controle de usuarios

A tela `/controle-usuarios` e exclusiva do superadministrador. Ela usa a Edge Function `admin-users` para listar usuarios do Supabase Auth, criar usuarios com senha padrao `ifrn`, enviar convites, criar grupos e gravar permissoes por tela.

O grupo inicial `Diretores` recebe acesso as telas de producao e nao recebe acesso ao controle de usuarios. Uploads e importacoes continuam dependentes de `isSuperAdmin`, portanto o grupo `Diretores` nao libera botoes de upload.

## Camada 2: origem do dado

O frontend hoje usa tres padroes principais:

### Padrao A: DataContext

Usado para os dados mais centrais do sistema:

- atividades
- empenhos
- descentralizacoes
- descentralizacoes_conta_saldos
- contratos
- contratos_empenhos
- creditos_disponiveis

Arquivos:

- [DataContext.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/contexts/DataContext.tsx)
- [useDataQueries.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/contexts/useDataQueries.ts)
- [useCrudMutations.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/contexts/useCrudMutations.ts)

Paginas que dependem fortemente disso:

- [Dashboard.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Dashboard.tsx)
- [Atividades.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Atividades.tsx)
- [Empenhos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Empenhos.tsx)
- [Descentralizacoes.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Descentralizacoes.tsx)

Observacao:

- a pagina [Atividades.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Atividades.tsx) agora atende a rota `/planejamento/:scope`
- as visoes `campus`, `sistemico` e `emendas-parlamentares` filtram a tabela `atividades` pelo campo `tipo_atividade`
- cadastro manual e importacao JSON na pagina de planejamento persistem o `tipo_atividade` correspondente a aba atual
- o modal [EmpenhoDialog.tsx](/C:/Users/3128880/Desktop/Programação/Sistema_Gerencial/src/components/modals/EmpenhoDialog.tsx) exibe a secao de liquidações da API publica do Comprasnet via `contratosApiService.getLiquidacoesPublicasPorEmpenho`
- essa descoberta do modal nao usa `contratos_api*`; o frontend le `contratos_api_empenho_liquidacoes_cache*` e aciona a Edge Function `refresh-comprasnet-liquidacoes-cache` quando a entrada nao existe ou venceu. Se as tabelas de cache ainda nao existirem no ambiente, o modal retorna vazio sem acionar a function para evitar erros de bootstrap. Se o status do cache indicar linhas mas a leitura publica das linhas voltar vazia por policy/RLS, o service usa a function em modo `readCacheOnly` como fallback. A function percorre contratos publicos das UGs `158366` e `158155`, filtra contratos cujo endpoint `/empenhos` contenha o numero do empenho e so entao consulta `/faturas`, exibindo apenas linhas cujo `dados_empenho[]` corresponda ao empenho aberto e cuja fatura pertença ao campus exibido quando `contratante` vier no payload

### Padrao B: pagina + service proprio

Usado quando a pagina tem pipeline proprio de importacao ou consulta:

- [Financeiro.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Financeiro.tsx)
- [LC.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/LC.tsx)
- [RetencoesFdReinfDesign.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/RetencoesFdReinfDesign.tsx)
- [LiquidacoesPagamentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/LiquidacoesPagamentos.tsx)
- [RastreabilidadePFs/index.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/RastreabilidadePFs/index.tsx)

### Padrao C: pagina + Edge Function ou API externa

Usado em modulos com IA ou integracoes externas:

- [Consultor.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Consultor.tsx)
- [ConsultorSessions.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/ConsultorSessions.tsx)
- [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx)
- [Suap.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Suap.tsx)
- [Auth.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Auth.tsx)
- [EconomiaTempo.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EconomiaTempo.tsx)

## Camada 3: services

Os services em [src/services](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services) fazem:

- query em tabela ou view do Supabase
- upsert/importacao
- chamada de API externa
- chamada de Edge Function
- enriquecimento e mapeamento de dados
- normalizacao de labels exibidos no frontend, como `componente_funcional` sem prefixo numerico e atividades de Ensino sem prefixo `NN - COMPONENTE FUNCIONAL (PROEN):`

## Camada 4: fallback REST

Alguns services usam fallback para REST quando `supabase-js` falha ou retorna vazio:

- [atividades.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/atividades.ts)
- [empenhos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/empenhos.ts)
- [descentralizacoes.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/descentralizacoes.ts)
- [rastreabilidadePFs.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/rastreabilidadePFs.ts)
- [suapProcessos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/suapProcessos.ts)

## Exemplos de fluxo

### Economia de tempo

`App.tsx` -> `EconomiaTempo.tsx` -> `automationSavingsService` -> `automation_savings_scenarios` / `automation_savings_events`

Observacoes:

- a pagina combina eventos reais e estimativas proporcionais ao periodo filtrado
- quando um cenario nao possui evento real no periodo, a estimativa mensal do catalogo e usada como fallback daquele cenario
- extensoes e automacoes externas registram eventos pela Edge Function `record-automation-savings-event`
- a extensao local `suap-atividades-extension` envia evento `atividades_sincronizadas` para o cenario `suap-processos` quando novas atividades sao inseridas

### Dashboard

`App.tsx` -> `Dashboard.tsx` -> `useData()` -> `DataContext` -> `useDataQueries` -> services -> Supabase

Observacao para a aba RAP do dashboard:

- os cards de topo devem usar os campos proprios de RAP do empenho
- separar `inscrito` e `reinscrito` pelo ano do empenho:
  - ano imediatamente anterior ao exercicio corrente: usar a base inscrita do RAP
  - anos anteriores a esse: tratar como `reinscrito`
- `restos a pagar pagos` deve ser somado ao valor de `valor_liquidado_a_pagar` para representar o total liquidado/executado no exercicio corrente
- `restos a pagar a pagar` deve ser tratado como o saldo atual do empenho RAP
- em `Empenhos.tsx`, o `HeaderActions` agora separa as acoes em `Importar Empenhos` e `Importar Saldo RAP`
- no upload de `Empenhos.tsx`, o CSV dedicado de RAP com `NE CCor` + `Metrica` atualiza `saldo_rap_oficial` diretamente sem limpar os demais campos do RAP ja existentes
- quando o upload vier pelo CSV legado combinado, a coluna `RESTOS A PAGAR NAO PROCES. LIQUIDADOS A PAGAR` continua alimentando `valor_liquidado_a_pagar` tambem para RAP e e descontada do `saldo_rap_oficial`
- quando o saldo oficial nao vier preenchido, derivar o saldo pela base vigente do RAP menos o valor executado no ano
- a mesma regra deve valer para dashboard, tela de empenhos, agrupamentos e contratos vinculados
- nao reutilizar `valor` ou `valorPagoOficial` como substitutos desses totais na agregacao da aba RAP

Observacao para a aba de exercicio atual do dashboard:

- o grafico `Evolucao da Execucao` deve mostrar `Planejado` como total acumulado desde o primeiro mes do eixo, nao pela data de cadastro das atividades
- a linha `Empenhado` usa, nesta ordem, `contratos_api_empenhos.data_emissao` casada pelo numero da NE, `empenhos.historicoOperacoes` quando houver historico com data e a soma das operacoes fechar com `empenhos.valor` (tratando `ANULACAO` como valor negativo), e `empenhos.dataEmpenho` apenas como fallback; isso evita que bases antigas importadas com data de cadastro concentrem tudo no mes errado e garante que o ultimo ponto bata com o funil
- a linha `Liquidado` usa NPs/documentos de liquidacao de `documentos_habeis` vinculadas por `empenho_numero`; quando nao houver NP vinculada para a NE, usa liquidacoes publicas da API de contratos por empenho (`data_liquidacao` ou `data_emissao`) como fonte de data; em ambos os casos, as datas distribuem o valor no tempo e o total final e escalado para fechar com o liquidado oficial do funil; `ultimaAtualizacaoSiafi` nao deve ser usado como data mensal para evitar concentrar liquidacoes no mes da sincronizacao
- sem filtro final de data, o eixo deve preencher meses vazios ate o mes atual

### Financeiro

`Financeiro.tsx` -> `parseFinanceiroCsv` / `saveFinanceiroRows` -> `financeiro_fonte_vinculacao`

### LC

`LC.tsx` -> `parseLCCsv` / `saveLCRows` -> `lc_credores`

### PFs

`PFImportDialog.tsx` -> `importPFs` -> `pf_solicitacao` / `pf_aprovacao` / `pf_liberacao` -> views -> `RastreabilidadePFs/index.tsx`

### Documentos habeis

`LiquidacoesPagamentos.tsx` -> `JsonImportDialog` -> `transparenciaService.import*` -> `documentos_habeis*`

### Retencoes FD-Reinf

`RetencoesFdReinfDesign.tsx` -> `retencoesEfdReinfImportService` -> `retencoes_efd_reinf` + `documentos_habeis_itens`

Observacoes:

- a tela carrega a ultima base importada de `retencoes_efd_reinf`
- para situacoes `DDF025`, o service localiza a OB de pagamento em `documentos_habeis_itens`, exibe o numero da OB vinculada e usa sua data para calcular o vencimento esperado
- o checkbox de correcao atualiza `retencoes_efd_reinf.correcao_realizada`; registros marcados deixam os filtros e contadores de pendencias abertas, mas seguem visiveis na auditoria geral

### Contratos

`Contratos.tsx` -> `contratosApiService.getContratosApi(true)` -> `contratos_api`

Complemento local:

`useData()` -> `contratos` / `contratos_empenhos` quando houver match por numero normalizado

Sincronizacao:

`sync-contratos-comprasnet` -> `contratos_api*` -> `contratosApiService` -> lista e drawer de detalhes em `Contratos.tsx`

Observacao:

- a lista principal usa contratos sincronizados da API com `situacao_derivada = true`; o endpoint de "ativos" do Comprasnet nao e confiavel sozinho porque pode retornar contratos com vigencia vencida
- o upload manual XLSX foi removido da tela; superadmin ve a ultima sincronizacao e pode acionar "Atualizar Comprasnet" para antecipar o cron diario
- `situacao_derivada`, `vigencia_inicio_derivada`, `vigencia_fim_derivada` e `situacao_derivada_motivo` sao calculados na sincronizacao pela maior vigencia valida do historico; rescisao/cancelamento inativa o contrato; sem historico, usa `vigencia_fim` da listagem como fallback registrado
- contratos da UG `158366` entram se ativos pela regra derivada; contratos da UG `158155` so entram se houver evidencia operacional estruturada do campus, como empenho ou fatura com UG/contratante `158366`, registrada em `campus_scope_reason`
- o historico da API (`contratos_api_historico`) aparece no drawer com assinatura, aditivos, apostilamentos e rescisao
- contratos com origem `158155` recebem sinalizacao de Reitoria; a execucao operacional deve ser lida pela UG do campus `158366`
- Valor Total da lista usa o historico da API como fonte principal quando houver match, somando `valor_inicial` de cada termo: assinatura, aditivos, apostilamentos ou termos equivalentes. `valor_global` da API nao entra nessa metrica. Sem historico com `valor_inicial`, usa `contratos.valor` como fallback
- Valor Empenhado usa o empenhado original da API quando existir, ou o valor original do empenho local como fallback; RAP inscrito/reinscrito fica como detalhe separado. Os badges/popovers de empenhos da lista principal mostram os vínculos locais de `empenhos` + `contratos_empenhos` e, quando houver match API, também exibem empenhos de `contratos_api_empenhos` que ainda não existem no vínculo local; valores CSV/SIAFI locais continuam prevalecendo quando o mesmo número existir nas duas fontes
- a coluna/card `Saldo dos empenhos` soma o saldo dos empenhos locais vinculados com o saldo dos empenhos que existem apenas na API. Para RAP local usa `getRapSaldoAtual`; para RAP API usa `rp_a_pagar` ou saldo derivado de `rp_inscrito - (rppago + rpliquidado)`; para empenho de exercício usa `valor_a_liquidar`
- quando um empenho da API corresponder a um empenho já existente no SIAFI local, inclusive quando a API trouxer prefixo de UG/gestão antes de `AAAA NEXXXXXX`, o saldo local prevalece na lista de contratos. Isso evita somar `valor_a_liquidar` antigo da API para RAP já zerado na tela de empenhos
- Para empenho RAP vindo apenas da API, o popover nao mistura `aliquidar`/`pago` do exercicio com RAP: usa `rp_inscrito` e `raw_data.rpaliquidar` como base, `raw_data.rppago + raw_data.rpliquidado` como liquidado/pago de RAP e `rp_a_pagar` ou saldo derivado como saldo atual
- para empenho antigo vindo apenas da API, `rp_a_pagar = 0` e saldo zero valido e nao deve cair para `valor_a_liquidar`; esse campo de exercicio pode ficar defasado em restos a pagar ja quitados
- no drawer, a secao de itens usa `contratos_api_itens.historico_item` para somar o valor contratado por item quando a API traz historico de assinatura/aditivos; `contratos_api_itens.valor_total` e apenas fallback quando nao houver historico do item
- no drawer de contratos com origem Reitoria, as faturas sincronizadas continuam preservadas, mas a UI filtra por `contratos_api_faturas.raw_data.contratante` e exibe somente as faturas do campus `158366` quando esse campo vier preenchido
- no drawer, cada item tambem exibe o detalhamento do `historico_item` com tipo do termo, data, quantidade, valor unitario e valor total quando a API trouxer esses campos
- no resumo de itens do drawer, `Contratado` e `Executado` mostram tambem quantidade agregada: quantidade contratada pela soma de `historico_item[].quantidade` quando existir, e quantidade executada pela soma de `quantidade_faturado` nas faturas `Pago` ou `Siafi Apropriado`
- nas faturas associadas com `dados_item_faturado`, o drawer exibe quantidade faturada e valor unitario faturado alem do valor total do item
- a execucao por item soma faturas com situacao `Pago` ou `Siafi Apropriado` e vinculo `dados_item_faturado`
- faturas sem item vinculado ficam em grupo separado e nao entram na execucao oficial por item
- no modal de empenho, a secao `Liquidações` nao depende dessa sincronizacao local; ela le o cache dedicado de faturas por empenho e, quando o cache esta ausente ou vencido, chama a Edge Function aguardando as linhas atualizadas antes de cair para resultado vazio. A exibicao tambem filtra por `raw_data.fatura.contratante` para nao mostrar faturas de outros campi ao usuario do campus atual; a coluna `Valor` usa `valor_bruto` da API

### Pregoes IFRN

`App.tsx` -> `LicitacoesPregoes.tsx` -> `licitacoesPncpService` -> `licitacoes_pncp`

Sincronizacao:

`sync-licitacoes-pncp` -> PNCP `/v1/contratacoes/publicacao` e `/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}` -> `licitacoes_pncp`

Observacoes:

- a rota `/licitacoes-pregoes` fica no grupo Contratos e abre com a UASG `158366`
- a tela lista pregoes materializados, filtra por UASG, periodo, situacao, SRP, prazo de propostas e texto livre
- o drawer exibe os dados completos armazenados do PNCP, links PNCP/Compras.gov.br e informacao complementar
- o botao `Sincronizar PNCP` aparece somente para superadministrador; usuarios autenticados apenas consultam os dados ja sincronizados
- o service tambem le `licitacoes_pncp_sync_runs` para informar a ultima sincronizacao

### Favoritos

`Empenhos.tsx` / `Contratos.tsx` -> `useUserFavorites()` -> `user_favorites`

Observacoes:

- favoritos sao pessoais por usuario autenticado do Supabase
- as telas exibem uma estrela por linha e um filtro `Todos/Favoritos`
- favoritos de contratos se referem aos contratos locais em `contratos`; linhas vindas apenas de `contratos_api` aparecem sem acao de favorito ate existir contrato local correspondente

### Editor de Documentos

`EditorDocumentos.tsx` -> `suapProcessosService.getAll` -> `processos`

Observacoes:

- a grade de processos sincronizados do editor tenta leitura publica via `supabase-js` e cai para REST anonimo quando necessario
- a escolha entre `Despacho de Liquidacao`, `ETP - Servicos Continuos`, `Termo de Referencia - Compras`, `Mapa de Risco da Licitacao` e `Contrato de Servico IFRN` vem da sidebar global, usando as rotas `/editor-documentos/:modelId`; o mapa de risco existe como tipo tecnico, mas o fluxo principal o expõe apos um ETP aberto no editor
- na grade do Editor, o clique no corpo do card abre os detalhes e o checkbox lateral alterna a selecao; despachos aceitam multiplos processos selecionados, Contrato/Termo exigem exatamente um, e o ETP aceita um processo ou objeto manual
- o detalhe do processo no Editor pode abrir o PDF sincronizado pelo bucket `suap-pdfs` usando URL assinada via `suapProcessosService.getPdfSignedUrl`
- a opcao `Despacho de Liquidacao` continua usando `documentGeneration.ts` com dados de `processos`, `empenhos`, `contratos` e `contratos_api`; para bolsa/PF, a minuta usa redacao com projeto apenas quando houver referencia explicita a projeto, e usa modelo sem projeto/edital quando essa referencia nao existir
- o `GeradorDocumentos.tsx` manual possui finalidade propria `Bolsa sem projeto`, sem campos de projeto ou edital, alinhada ao mesmo modelo de despacho sem projeto usado pelo editor
- a opcao `Contrato de Servico IFRN` baixa o PDF sincronizado do processo, extrai texto com `pdfjs-dist`, identifica paginas candidatas de modelo contratual e envia o modelo escolhido com trechos de apoio para a Edge Function `gerar-contrato-licitacao`
- a opcao `Termo de Referencia - Compras` exige um modelo DOCX ativo em `document_templates`, analisa o PDF sincronizado do processo com `pdfjs-dist` quando houver processo, aceita contexto vindo de ETP editado como fonte `ETP editado no editor` e de mapa de risco editado como fonte `Mapa de Risco editado no editor`, pede sugestoes de respostas com fonte explicita a Edge Function `sugerir-respostas-termo-referencia`, apresenta aprovacao em lote das sugestoes, mostra pendencias restantes no questionario derivado do modelo AGU, envia respostas/pulos com o template e os trechos relevantes para a Edge Function `gerar-termo-referencia-compras` e libera download do DOCX final montado sobre esse modelo
- a opcao `Estudo Tecnico Preliminar - Servicos Continuos` nao usa `document_templates` no v1; ela aceita um processo SUAP sincronizado ou a digitacao manual do objeto da licitacao, analisa o PDF do processo quando existir texto pesquisavel, aceita ate 5 anexos auxiliares locais de ate 20 MB cada nos formatos PDF, XLSX, XLS, ODS, CSV, TXT, MD e DOCX, extrai texto desses anexos no navegador com `pdfjs-dist`, `xlsx`, `cfb` e `TextDecoder`, adiciona contexto institucional do campus como apoio natural para escala/logistica/continuidade sem trata-lo como anexo ou fonte explicita, pede sugestoes com fonte explicita a Edge Function `sugerir-respostas-etp-servicos-continuos` apenas com trechos tecnicos do processo, mostra um questionario fixo de ETP para servicos continuos, permite gerar texto por secao via `gerar-texto-etp-secao` com poucas notas ou mesmo sem digitacao previa, e envia respostas/pulos para a Edge Function `gerar-etp-servicos-continuos`
- anexos auxiliares do ETP, como convencao coletiva, planilha de custos ou memoria em DOCX/TXT, nao sao enviados brutos, nao vao para Storage e nao sao persistidos; o frontend envia apenas snippets com `sourceType`, `sourceName`, `sourceLabel`, `pageNumber` opcional, `kind` e `excerpt`; snippets institucionais usam `sourceType: "institucional"` e devem enriquecer a redacao sem aparecer como "anexo", "fonte" ou referencia textual no documento
- anexos auxiliares opcionais sao apoio de busca para informacoes pontuais, assim como o contexto institucional; eles nao definem o foco, o escopo ou a narrativa principal do ETP. O processo, o objeto informado e as respostas aprovadas pelo usuario continuam sendo as fontes que orientam o documento
- anexos auxiliares nao entram no preenchimento automatico do questionario do ETP; uma CCT, planilha ou memoria pode apoiar a redacao pontual depois, mas nao deve gerar sugestoes automaticas como foco da pergunta
- o ETP gerado fica como rascunho editavel no editor e oferece acoes de copiar documento, copiar secoes e `Prosseguir para Mapa de Risco`; o mapa chama `riskMapsService` e a Edge Function `gerar-mapa-riscos-licitacao`, com fallback local, gerando HTML editavel com tabela de riscos por fase, risco, causa, dano, probabilidade, impacto, nivel, acoes e responsavel
- o mapa de risco gerado oferece `Prosseguir para Termo de Referencia`; ao prosseguir, o TR usa o `editorContent` atual do ETP e do mapa, incluindo edicoes do usuario, e pode iniciar sem processo SUAP, mas continua bloqueando quando nao houver modelo DOCX ativo
- no ETP, marcadores como `[CAMPO PENDENTE]` e `[CAMPO PENDENTE: ...]` sao destacados em vermelho no editor e no HTML copiado; o texto simples e o contexto enviado ao TR continuam sem depender dessa marcacao visual
- o contexto institucional do `Campus Currais Novos` identifica a unidade demandante real; a IA nao deve transformar esse campus em exemplo dentro de placeholder de unidade demandante
- a cada geracao de ETP, Mapa de Risco, Termo de Referencia ou Minuta de Contrato, o frontend cria uma versao em `licitacao_document_artifacts`; edicoes no editor atualizam a versao aberta com debounce, e a pagina `/artefatos-licitacao` lista, filtra, copia, exclui e abre artefatos no editor
- anexos locais auxiliares continuam nao persistidos e nao vao para Storage; nao ha OCR nesta versao
- o questionario do Termo de Referencia abre em modal sobre o editor; primeiro revisa sugestoes da IA em lote e depois mostra uma pergunta pendente por vez, avancando apos selecao, pulo ou salvamento de campo aberto para reduzir poluicao visual
- no modal do questionario, o progresso principal fica concentrado no cabecalho com barra e chips de status; o card da pergunta evita repetir contadores e, para campos abertos, esconde o badge generico `Campo`
- nos campos abertos do Termo de Referencia, o modal traduz lacunas genericas do modelo em orientacoes operacionais, mostrando uma orientacao curta e o campo original do modelo em uma caixa fixa compacta
- no modal do Termo de Referencia, a tela mostra apenas copy resumida e operacional; o texto original do modelo AGU, com artigos e redacao integral, fica disponivel na dica nativa do navegador ao passar o mouse ou focar perguntas e opcoes, evitando duplicacao visual
- quando uma clausula exclusiva ou opcional traz lacunas no proprio texto, o modal permite escolher a alternativa e preencher esses placeholders na mesma etapa, antes de avancar para a proxima pergunta; quando a alternativa exige complemento operacional mas nao traz placeholder explicito, como `As parcelas serao entregues nos seguintes prazos e condicoes`, o modal abre um campo suplementar e a Edge Function anexa esse complemento ao texto final; se a propria clausula trouxer alternativas inline separadas por `OU`, como `Estudo Tecnico Preliminar` ou `Nota Tecnica`, o modal troca os campos livres por uma escolha direta; ao escolher `Nota Tecnica`, abre campo para informar o numero da nota e a resposta final segue para a Edge Function com `selectedOptionId` e os valores inline da clausula
- no parser do TR, um `OU` entre clausulas pode agrupar varios paragrafos consecutivos da mesma alternativa, como uma clausula principal seguida de incisos `I)`, `II)` e similares; o questionario e o DOCX final tratam esse conjunto como uma unica opcao logica, sem quebrar os subitens
- quando esses subitens agrupados repetem placeholders genericos como `[...]`, o modal cria um campo separado para cada inciso com rotulo contextual; se o modelo vier como um unico bloco longo, a inferencia usa o trecho local de cada ocorrencia para evitar campos genericos como `Trecho complementar da clausula`
- placeholders vazios ou apenas pontilhados, como `[...]` sem contexto util no bloco, deixam de virar pergunta; quando o marcador e generico, como `ANO`, o sistema tenta usar o texto do bloco para montar um rotulo compreensivel
- no fluxo de Termo de Referencia, perguntas puladas permanecem pendentes; a IA nao escolhe clausulas alternativas no lugar do usuario
- o DOCX exportado pelo Termo de Referencia preserva trechos nao adotados com tachado/comentario e destaca preenchimentos feitos pela IA
- a geracao de contrato exige `pdf_url` no processo e bloqueia quando o PDF nao traz texto pesquisavel, porque esta versao ainda nao faz OCR
- a geracao do Termo de Referencia tambem bloqueia PDFs sem texto pesquisavel e nao tenta OCR
- quando o processo contem mais de um termo/minuta de contrato, o editor pede selecao manual do modelo antes de chamar a IA
- a tela administrativa `/modelos-documentos` publica novas versoes do DOCX, arquiva a versao ativa anterior e aparece apenas para superadmin
- as telas [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx) e [Suap.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Suap.tsx) expõem no header o botao `Baixar extensão`, apontando para a extensao SUAP Scraper no GitHub
- a tela [Suap.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Suap.tsx) passou a reutilizar a sessao global do app vinda de `AuthContext`
- a pagina [Auth.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Auth.tsx) centraliza login, convite e redefinicao de senha
- convites e criacao direta de usuarios ficam centralizados em `/controle-usuarios` e usam a Edge Function `admin-users`
- a origem do link de convite usa `VITE_APP_ORIGIN` quando configurada; se o resultado apontar para `localhost` ou loopback, o envio é bloqueado no frontend
- o cliente Supabase ficou com `detectSessionInUrl` habilitado para consumir o token do link de convite ou recuperacao
- no estado atual, uploads e importacoes do frontend so aparecem para `cristiano.cnrn@gmail.com`
- o Consultor salva sessoes em `localStorage`, mas agora com chave isolada por usuario autenticado em vez de um historico global compartilhado
- no Consultor, o upload de PDF fica liberado para qualquer usuario autenticado; a restricao de superadmin continua apenas nos uploads/importacoes CSV das demais telas

## Regras de cautela

- nem toda pagina relevante usa o `DataContext`
- parte do fluxo depende de imports manuais, nao so de query
- fallback REST pode mascarar diferencas de schema e permissao
- views e Edge Functions devem ser confirmadas no banco quando nao estiverem versionadas no repo
