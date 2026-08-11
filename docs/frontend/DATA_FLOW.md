# DATA_FLOW

Este documento resume como os dados chegam ao frontend e circulam pelas paginas.

## Camada 1: rotas

As rotas sao lazy-loaded em [App.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/App.tsx).

Cada rota cai em uma pagina em `src/pages`.

Os limites `Suspense` usam `RouteLoadingFallback` em vez de fallback vazio. Rotas publicas exibem o carregamento em tela cheia; rotas dentro do `Layout` preservam o shell e mostram o feedback somente na area de conteudo.

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

A tela `/controle-usuarios` e exclusiva do superadministrador. Ela usa a Edge Function `admin-users` para listar usuarios do Supabase Auth, criar usuarios com senha inicial definida pelo superadministrador, redefinir senha de usuarios existentes, excluir usuarios, enviar convites, criar grupos e gravar permissoes por tela.

O grupo inicial `Diretores` recebe acesso as telas de producao e nao recebe acesso ao controle de usuarios. Uploads e importacoes continuam dependentes de `isSuperAdmin`, portanto o grupo `Diretores` nao libera botoes de upload.

Usuarios autenticados podem trocar a propria senha pelo botao de chave no cabecalho global. Ao trocar a senha, o metadado `uses_default_password` e limpo no Supabase Auth para encerrar o aviso de senha padrao em contas antigas.

### Controle de orgaos e identificacao no layout

A tela `/controle-orgaos` usa a mesma Edge Function `admin-users` para cadastrar orgaos, habilitar modulos por orgao e vincular usuarios em `org_users`.

O `AuthContext` carrega o orgao primario do usuario autenticado via `fetchUserAccess`. O chip institucional da sidebar em `Layout.tsx` exibe `userOrg.name`, inclusive para superadministrador; quando nao houver vinculo cadastrado, exibe estado neutro de orgao nao vinculado em vez de assumir um campus fixo.

Permissoes de modulo podem incluir subpaginas funcionais derivadas pelo catalogo `appScreens`. Autorizar `pesquisa-precos` tambem libera `cadastro-fornecedores` e `pesquisa-precos-ead`; essa expansao e aplicada tanto nas permissoes de grupo quanto nas permissoes do orgao, para que paginas filhas operacionais nao exijam marcacao separada no controle de orgaos.

O cadastro de fornecedores do modulo Pesquisa de Precos usa `suppliers` e `supplier_certificates` com isolamento por `org_id`. Fornecedores cadastrados por um orgao nao devem aparecer para outro orgao; registros legados anteriores ao isolamento ficam associados ao orgao padrao `ifrn-cn`.

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

Consulta dedicada com React Query:

- [CreditoDisponivel.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/CreditoDisponivel.tsx) consulta o snapshot mais recente em `creditos_disponiveis_detalhes`, com filtro e paginacao por PI; seu upload atualiza tambem o agregado `creditos_disponiveis`. A tela de Empenhos nao apresenta mais cards nem importacao de credito disponivel.

Observacao:

- a pagina [Atividades.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Atividades.tsx) agora atende a rota `/planejamento/:scope`
- as visoes `campus`, `sistemico` e `emendas-parlamentares` filtram a tabela `atividades` pelo campo `tipo_atividade`
- cadastro manual e importacao JSON na pagina de planejamento persistem o `tipo_atividade` correspondente a aba atual
- o modal [EmpenhoDialog.tsx](/C:/Users/3128880/Desktop/Programação/Sistema_Gerencial/src/components/modals/EmpenhoDialog.tsx) exibe a secao de liquidações da API publica do Comprasnet via `contratosApiService.getLiquidacoesPublicasPorEmpenho`
- essa descoberta do modal nao usa `contratos_api*`; o frontend le `contratos_api_empenho_liquidacoes_cache*` e aciona a Edge Function `refresh-comprasnet-liquidacoes-cache` quando a entrada nao existe ou venceu. Se as tabelas de cache ainda nao existirem no ambiente, o modal retorna vazio sem acionar a function para evitar erros de bootstrap. Se o status do cache indicar linhas mas a leitura publica das linhas voltar vazia por policy/RLS, o service usa a function em modo `readCacheOnly` como fallback. A function percorre contratos publicos das UGs `158366` e `158155`, filtra contratos cujo endpoint `/empenhos` contenha o numero do empenho da UG `158366` e so entao consulta `/faturas`, exibindo linhas cujo `dados_empenho[]` corresponda ao empenho aberto. Em contratos gerenciados pela Reitoria, faturas com `contratante = 158155` continuam aparecendo quando o empenho vinculado e da UG `158366`; faturas de outros campi sao ocultadas quando essa divergencia fica identificavel no payload
- quando o cache de liquidacoes possui linhas vencidas ou de uma tentativa anterior, contratosApiService devolve essas linhas imediatamente e aciona a atualizacao em background; assim o saldo por item nao fica aguardando a API publica para aparecer

- o mesmo modal consulta `transparenciaService.getItensEmpenhoPortal` para ler `portal_transparencia_empenho_itens_cache*` e exibir somente descricao e subelemento dos subitens. Quando o cache esta ausente, vazio ou em erro, o service pede `returnRows: true` a Edge Function `refresh-portal-transparencia-itens-cache` e usa consulta direta pelo browser como fallback; quando o cache vencido possui linhas, elas continuam visiveis enquanto a atualizacao ocorre em background. O service retorna `valorAtual` e historico do item para uso posterior, e a UI carrega o saldo detalhado separadamente.

### Padrao B: pagina + service proprio

Usado quando a pagina tem pipeline proprio de importacao ou consulta:

- [Financeiro.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Financeiro.tsx)
- [LC.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/LC.tsx)
- [RetencoesFdReinfDesign.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/RetencoesFdReinfDesign.tsx)
- [LiquidacoesPagamentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/LiquidacoesPagamentos.tsx)
- [RastreabilidadePFs/index.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/RastreabilidadePFs/index.tsx)
- [EnergiaCampus.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/energia/EnergiaCampus.tsx)
- [RequisicaoCompra.tsx](file:///c:/Users/3128880/Desktop/Programação/Sistema_Gerencial/src/pages/RequisicaoCompra.tsx)

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

### SUAP Processos

`Layout` (menu do usuário) -> `SuapSyncPanel` / `suapScraperService` -> `suap-proxy` / `process-pdf` -> `processos` / `suap_processo_caixas` / `suap-pdfs`

Observacoes:

- a configuracao da integracao fica no menu do usuario, em `Configurar integração com o SUAP`; nela o usuario cadastra manualmente as caixas e executa a sincronizacao
- o fluxo e modular: o usuario pode sincronizar somente o inventario, baixar PDFs selecionados, executar somente a extracao por IA ou rodar o fluxo completo para processos escolhidos
- a sincronizacao automatica obedece as caixas marcadas pelo usuario e executa o fluxo completo apenas para processos novos; cada inventario reconcilia somente as caixas lidas com sucesso, ocultando processos ausentes pela remocao do vinculo em `suap_processo_caixas` sem apagar dados, PDFs ou historico
- antes da IA o frontend persiste apenas `suap_id`, `url`, `caixa` e `num_processo` quando o numero aparece na listagem do SUAP; a tabela continua exibindo os processos durante fila/processamento da IA, mas beneficiario, contrato, valores, dados bancarios, empenhos e retencoes ficam no detalhe aberto pelo ícone de olho e so aparecem depois de extraidos pela IA
- a tela /suap filtra visualmente apenas entre processos em andamento e concluidos; etapa operacional, PDF, atualizacao e metadados extraidos pela IA aparecem na propria linha do processo
- a tela permite gerar o `Despacho de Liquidacao` avulso pelo cabecalho, alem da geracao por processo ou em lote na tabela, sem sair de `/suap`; a fila da geracao fica em `sessionStorage` para sobreviver a atualizacoes acidentais da pagina
- o despacho avulso abre o formulario manual vazio e aceita numero de processo opcional: a minuta so cita `Processo n.` quando esse campo for informado
- nas paginas `processo/{id}` e `visualizar_processo/{id}` do SUAP, a extensao injeta `Gerar documento` e incorpora a rota protegida `/suap-extensao/despacho` sobre a pagina; o iframe anuncia `siages:suap-dispatch-ready` e entao o contexto chega por `postMessage` validado para `https://suap.ifrn.edu.br`, processos existentes sao carregados por `suap_id` mesmo fora de caixas ativas e processos ausentes iniciam o formulario avulso com o numero ja preenchido
- nas mesmas paginas de processo, a extensao tambem injeta um card SIAGES de empenhos do beneficiario e usa um iframe oculto em `/suap-extensao/processo-info`. O JWT autenticado no popup da extensao e entregue ao iframe somente por `postMessage` validado para `https://suap.ifrn.edu.br`; assim, o resumo nao depende de cookies de terceiros no iframe. A sessao privada fica em `chrome.storage.local` e o service worker a renova em segundo plano antes do vencimento; ela so e removida no logout ou quando o refresh token for revogado. Respostas 400/401 do endpoint de senha sao tratadas como credenciais invalidas; se o content script tiver sido invalidado por uma atualizacao da extensao, a tela orienta recarregar a pagina do SUAP (e o popup pode ser reaberto). O iframe desativa sua renovacao propria para nao invalidar o refresh token guardado pela extensao. A rota usa a sessao efemera para consultar o processo sob RLS e devolve por `postMessage` o resumo de empenhado, saldo e liquidacoes em cache detalhadas por empenho. Quando o processo tem contrato identificado, o resumo fica restrito aos empenhos daquele contrato; sem beneficiario identificado, o card nao e exibido. O card e o botao `Gerar documento` compartilham um painel fixo no canto inferior direito, para nao depender da estrutura ou da coluna da timeline do SUAP. A conciliacao das liquidacoes usa as chaves resumida e longa do empenho, evitando perder linhas quando o cache armazena o prefixo da UG/gestao
- a origem publica do SIAGES e configurada no popup da extensao; o iframe pode autenticar no proprio modal quando nao houver sessao, e `Clonar no SUAP` continua abrindo uma nova aba com a automacao existente de assunto e texto
- processos com extracao `success` ou `incomplete_extraction` alimentam o despacho com o contexto extraido pela IA; a lateral permite trocar o modelo da minuta, como contrato/aquisicao, projeto, bolsa sem projeto e auxilios, regenerando o HTML com os dados ja extraidos antes de copiar ou clonar. Na extracao parcial, os campos ausentes ficam marcados no texto para revisao. Processos sem IA concluida abrem somente os campos manuais pendentes, ja preenchidos com os dados basicos do processo
- cada item da fila pode ser editado, copiado e clonado individualmente no SUAP. A clonagem da fila pode usar revisao ou salvamento apos confirmacao no proprio dialog e nao abre varias abas automaticamente em lote
- a edicao usa o mesmo `RichTextEditor` de `/editor-documentos`: negrito, italico, sublinhado, listas, alinhamento, desfazer e refazer ficam disponiveis sem sair do SUAP. A minuta preserva a apresentacao serifada, o recuo e o alinhamento justificado; placeholders entre colchetes, como `[favorecido]`, continuam destacados em vermelho ate serem revisados
- a chamada padrao para `process-pdf` envia somente `{ suap_id }` e retorna assim que a extracao entra na fila; o resultado real chega depois pelo worker, que altera `processos.status`. Enquanto houver IA em fila ou processamento, a tela consulta os processos a cada cinco segundos; fora disso, a atualizacao volta ao intervalo normal
- o botão opt-in `Extrair com PDFs individuais — piloto` inventaria os anexos da página do processo, inclui por segurança os títulos não reconhecidos e ignora apenas IMR, certidões/documentação complementar, conta vinculada, relatório de recebimento provisório e folhas de pagamento; até quatro PDFs elegíveis são baixados em paralelo. Ao menos uma peça útil disponível, sobretudo a nota fiscal, já enfileira a IA; peças que falharem são registradas no log sem bloquear essa primeira extração. A geração do PDF completo começa ao mesmo tempo, continua canônica para o Editor de Documentos e só entra como complementação após a primeira extração se ela ficar incompleta ou não trouxer nota fiscal utilizável.
- a UI não anuncia conclusão quando a IA está apenas enfileirada. Limites temporários do Gemini ficam visíveis na linha do processo para evitar tentativas repetidas sem resultado.
- `notas_fiscais` e uma lista completa: a extracao percorre todos os documentos, a persistencia mescla notas novas com as ja salvas e as telas `/suap`, `/editor-documentos` e a extensao exibem todas as notas, datas e valores disponiveis

### Economia de tempo

`App.tsx` -> `EconomiaTempo.tsx` -> `automationSavingsService` -> `automation_savings_scenarios` / `automation_savings_events`

Observacoes:

- a pagina combina eventos reais e estimativas proporcionais ao periodo filtrado
- quando um cenario nao possui evento real no periodo, a estimativa mensal do catalogo e usada como fallback daquele cenario
- extensoes e automacoes externas registram eventos pela Edge Function `record-automation-savings-event`
- a extensao local `suap-atividades-extension` envia evento `atividades_sincronizadas` para o cenario `suap-processos` quando novas atividades sao inseridas

### Energia Campus

`App.tsx` -> `EnergiaCampus.tsx` -> `energiaCampusService` -> `energia_import_runs` / `energia_consumo_faturas` / `energia_solar_geracao` / `energia_contratos` / `energia_contrato_execucoes`

Complemento por contratos:

`contratos_api*` -> `energiaCampusService.loadMercattoContratosApiData()` -> KPIs, graficos e paineis de Mercatto

Observacoes:

- a tela importa XLSX pelo browser, faz parse local das abas `Consumo`, `Previsao - Mercatto`, `UFV's`, `Valor Executado` e abas anuais, e persiste um novo `energia_import_runs`
- a leitura sempre carrega a ultima importacao de energia e tambem consulta contratos/faturas/liquidacoes Mercatto ja sincronizados no modulo de contratos
- a Visao Geral usa kWh real de Mercatto quando existir na base; se houver apenas valor financeiro de contratos API, pode estimar kWh por tarifa media conhecida somente para KPIs e graficos agregados
- as abas especificas mantem valores sem dado-fonte direto como `N/D` e nao persistem estimativas derivadas

### Dashboard

`App.tsx` -> `Dashboard.tsx` -> `useData()` -> `DataContext` -> `useDataQueries` -> services -> Supabase

Observacao para a aba RAP do dashboard:

- os cards de topo devem usar os campos proprios de RAP do empenho
- separar `…6485 tokens truncated…peracionais, mostrando uma orientacao curta e o campo original do modelo em uma caixa fixa compacta
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
- na página SUAP `plan_estrategico/plano_concluido/8/`, a extensão injeta o resumo por dimensão e consulta diretamente o Supabase REST, sem iframe nem dependência de uma guia do SIAGES. O usuário autentica a extensão uma vez no popup; o JWT de curta duração fica no armazenamento privado da extensão, é renovado por refresh token e é enviado ao banco nas consultas de `atividades`, `descentralizacoes` e `empenhos`. As RLS dessas tabelas aplicam o `org_id` contido no JWT, sem chave de serviço no navegador.
- o resumo do plano usa `atividades.valor_total` como planejado, os lançamentos detalhados de `descentralizacoes.valor` como descentralizado e `empenhos` de exercício não cancelados como empenhado. Por dimensão, `A descentralizar = planejado - descentralizado` e `A empenhar = descentralizado - empenhado`; valores negativos permanecem visíveis para evidenciar execução acima da base. O payload inclui os registros de cada drill-down: planejado, descentralizado e empenhado vêm dessas tabelas; `A descentralizar` identifica na própria página do SUAP as atividades cujo campo `Saldo disponível para empenho da atividade (R$)` seja positivo. A extensão também injeta uma barra local, isolada por CSS, para filtrar todas as linhas por texto, ordenar por qualquer cabeçalho e ocultar apenas linhas cujo saldo disponível da atividade seja zero; os controles não alteram dados nem navegação do SUAP.
- a pagina [Auth.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Auth.tsx) centraliza login, convite e redefinicao de senha
- convites e criacao direta de usuarios ficam centralizados em `/controle-usuarios` e usam a Edge Function `admin-users`
- a origem do link de convite usa `VITE_APP_ORIGIN` quando configurada; se o resultado apontar para `localhost` ou loopback, o envio é bloqueado no frontend
- o cliente Supabase ficou com `detectSessionInUrl` habilitado para consumir o token do link de convite ou recuperacao
- no estado atual, uploads e importacoes do frontend so aparecem para `cristiano.cnrn@gmail.com`
- o Consultor salva sessoes em `localStorage`, mas agora com chave isolada por usuario autenticado em vez de um historico global compartilhado
- no Consultor, o upload de PDF fica liberado para qualquer usuario autenticado; a restricao de superadmin continua apenas nos uploads/importacoes CSV das demais telas

### Pesquisa de preços

`App.tsx` -> `PesquisaPrecos.tsx` -> `priceResearch.ts` -> `pesquisar-precos` -> Dados Abertos Compras.gov.br

Persistência:

`PesquisaPrecos.tsx` -> `priceResearchService` -> `price_researches` / `price_research_items`

Capacitação EAD:

`App.tsx` -> `PriceResearchEad.tsx` -> `priceResearchEadService` -> `price_research_ead_videos` -> iframe `youtube-nocookie.com`

Observações:

- XLSX/XLS/CSV ou PDF pesquisável é lido localmente, sem upload do arquivo bruto para Storage;
- o PDF usa a posição dos textos para recompor colunas; arquivos escaneados sem camada de texto ainda não passam por OCR;
- quando CATMAT/CATSER não vem no arquivo, `priceCatalog.worker.ts` carrega sob demanda o catálogo compactado correspondente e ranqueia até cinco códigos semelhantes sem bloquear a interface;
- o usuário confirma uma sugestão ou informa manualmente o código antes de chamar a Edge Function;
- filtros avancados da pesquisa sao mantidos no estado editavel, enviados a `pesquisar-precos` quando a busca oficial e executada e reaplicados localmente na aba PNCP sem remover candidatos do snapshot;
- a função retorna até 100 preços homologados por item e preserva fonte, compra, fornecedor e unidade;
- a IA é opcional e apenas reordena aderência;
- seleção, exclusões e justificativas permanecem no estado editável e no snapshot salvo; ao desconsiderar uma cotação, a UI exige justificativa em modal antes de gravar `selected=false`, e achados antigos de exclusão sem justificativa abrem a mesma correção antes de finalizar o relatório;
- a personalização institucional do relatório permanece no estado editável e é salva em `price_researches`: nome da instituição, unidade/setor, dados complementares, logotipo em data URL e servidores responsáveis/equipe de apoio;
- o modal `SupplierEmailDialog` concentra a solicitacao de cotacao por e-mail; nele o usuario configura orgao, unidade, setor responsavel, Reply-To, prazo, observacoes e instrucoes de envio da proposta; os campos institucionais iniciam vazios, usam placeholders e passam a persistir localmente depois do primeiro preenchimento real; o historico de disparos fica em modal secundario aberto pela acao `Historico de e-mails` no rodape, evitando um segundo painel contextual fora do fluxo;
- a curadoria exibe um painel compacto de métodos de cálculo com menor preço, média e mediana como opções principais, além de média ponderada, média saneada, dispersão e preços excluídos em menor hierarquia visual; a atualização monetária global fica no fim desse painel, usa o mês atual como competência de cálculo e informa essa competência por aviso transitório ao ser ativada;
- enquanto a consulta oficial esta pendente, a curadoria mantem breadcrumb, wizard, painel de calculos e tabela visiveis com mensagem acessivel e skeletons; exportacao e avancos dependentes ficam bloqueados, estado vazio so aparece apos sucesso sem cotacoes e falhas exibem nova tentativa inline;
- a etapa final exibe em `iframe` isolado uma previa somente leitura gerada pelo mesmo HTML usado nas exportacoes PDF e HTML; o campo `Observacoes` e editado na etapa de identificacao e aparece no rodape do documento;
- a etapa final executa verificacao automatica de alertas baseada somente na IN SEGES/ME n?65/2021, agrupando achados por severidade e bloqueando a conclusao apenas quando houver achados `error`; essa secao operacional fica fora da previa e nao e incluida em PDF, HTML, XLSX ou CSV;
- relatório HTML, impressão/PDF, exportação XLSX e arquivos CSV são gerados no navegador a partir da pesquisa revisada;
- o relatório final inclui cabeçalho institucional personalizado, tabela de servidores, sumário gerencial consolidado, curva ABC, mapa comparativo e QR Code de autenticação com hash determinístico do snapshot revisado;
- o QR Code abre `/pesquisa-precos/validar?id=<pesquisa>&auth=<hash>`; a tela chama a Edge Function pública `validar-pesquisa-precos`, que usa service role para recalcular o hash do snapshot salvo e retorna apenas metadados mínimos e o resultado autenticado/divergente.

### Requisições de Compra (Perfil Terceirizado e Fiscal de Contratos)

`App.tsx` -> `RequisicaoCompra.tsx` / `CadastroTerceirizados.tsx` -> `requisicoesCompra.ts` -> `requisicoes_compra` / `requisicao_compra_empenhos` / `requisicao_compra_itens` / `terceirizado_permissions`

Observações:
- O perfil `Terceirizado` acessa apenas a rota `/requisicao-compra` e gerencia suas próprias requisições de compra.
- Um terceirizado so pode usar contratos e empenhos previamente associados a ele na tabela `terceirizado_permissions` por um gestor/fiscal. Na selecao de NE, somente vinculos explicitos por `empenho_id` liberam empenhos; vinculo de contrato nao expande automaticamente os empenhos disponiveis.
- Em `/cadastro-terceirizados`, o ícone de edição do prestador abre uma página inteira de edição com os dados cadastrais e a seção `Vincular Contratos e Empenhos`; `Empenho / NE` é o tipo de vínculo padrão e usa seletor pesquisável com múltipla seleção, criando uma linha de `terceirizado_permissions` para cada empenho escolhido, sem alteração de schema.
- Perfis gestores (`fiscal-contratos`, `diretores`, `teste`) cadastram e editam terceirizados em `/cadastro-terceirizados`; a rota `/requisicao-compra` permanece focada na criação, auditoria e aprovação/rejeição das requisições de compra.
- Ao criar ou editar uma requisicao, o formulario nao expoe processo nem contrato. O campo separado de favorecido filtra o combobox de NEs; a busca prioriza o numero completo da NE antes de prefixos, ocorrencias parciais, descricao e valor. Para terceirizados, a lista continua limitada a permissoes diretas por `terceirizado_permissions.empenho_id`.
- Cada NE selecionada cria um grupo proprio de itens em `/requisicao-compra`. A tela le os subitens com estrategia cache-first por `transparenciaService.getItensEmpenhoPortal(...)`; no primeiro acesso, a atualizacao server-side ou a consulta direta devolve os itens basicos mesmo sem cache. A descricao, unidade, subelemento e valor atual aparecem antes das liquidacoes, e o saldo detalhado e preenchido de forma assincrona depois. Em falha de atualizacao, o ultimo valor materializado permanece visivel; o saldo global do empenho continua calculado pela mesma regra de `/empenhos`. O cache desses subitens e pre-aquecido diariamente no Supabase em dois estagios, RAP e empenhos do exercicio, para todas as NEs com saldo positivo.
- A tabela de itens permanece integrada ao grupo da NE, sem um card auxiliar separado para o carregamento dos subitens.
- O saldo por item em `/requisicao-compra` parte do item da NE e abate somente liquidacoes oficiais associaveis ao subelemento. Requisicoes em rascunho ou revisao nao reservam nem consomem saldo de outra requisicao. A origem fica persistida em `requisicao_compra_itens.source_*`; a NE do item fica em `requisicao_compra_itens.empenho_id/empenho_numero`; itens manuais continuam permitidos quando a API/cache nao retorna subitens.
- O redirect OAuth SUAP usa `VITE_APP_ORIGIN` como origem canonica do callback `/suap-callback` quando configurada; sem ela, usa a origem atual. A mesma URI e enviada para o SUAP no authorize e para `suap-token-exchange` na troca do code.
- O login SUAP grava `user_metadata.matricula` no Supabase Auth; permissões de terceirizados são resolvidas por essa matrícula, com fallback por e-mail apenas para registros legados.
- Mesmo que o usuário possua associações antigas a outros grupos, um terceirizado de refeitório recebe somente a tela `/requisicao-compra`; o login SUAP também remove memberships incompatíveis.
- Quando a autenticação termina na rota inicial `/` e o perfil não possui acesso ao Dashboard, `ProtectedRoute` redireciona para a primeira tela permitida; para o terceirizado de refeitório, o destino é `/requisicao-compra`.
- O formulário mostra saldo e total separadamente por NE selecionada e permite salvar rascunhos sem critica de saldo. No envio para revisao, cada grupo e validado isoladamente contra o saldo oficial atual da respectiva NE e seus itens, sem descontar requisicoes abertas. O salvamento usa a RPC transacional `save_requisicao_compra`, que grava `requisicao_compra_empenhos`, mantem `requisicoes_compra.empenho_id/empenho_numero` preenchidos com a primeira NE por compatibilidade e repete a validacao no banco.
- Quando o contrato possui dados sincronizados, a tela exibe o saldo contratual por item como `contratado - executado`. A execução considera apenas faturas `Pago` ou `Siafi Apropriado` com item oficialmente vinculado; esse saldo por item é complementar e não substitui o saldo total do empenho usado no bloqueio.
- O superadministrador também possui permissão para criar e gerenciar requisições de compra diretamente na mesma tela, com acesso irrestrito a todos os contratos e empenhos.
- A geração de PDF é feita de forma estritamente local (no cliente), carregando os dados da requisição e dos itens em um template timbrado institucional em um iframe para impressão direta via `window.print()`. O PDF lista todas as NEs vinculadas e mostra a NE de cada item.

### Limpeza e Manutenção

`App.tsx` -> `ManutencaoAdmin.tsx` -> `manutencao.ts` -> `manutencao_ambientes` / `manutencao_ocorrencias` / `manutencao_checkins` / `manutencao_blocos_mapa`

Observações:

- O mapa seleciona cada bloco pelo próprio `id` e relaciona ambientes pelo nome de `bloco`.
- O cadastro, os filtros, as estatísticas e a geometria do mapa não usam zona funcional.
- A rota pública `feedback-ambiente/:codigo` permite anexar uma foto opcional JPEG, PNG ou WebP de até 5 MB; o arquivo vai para o bucket privado `manutencao-ocorrencias` e a ocorrência guarda apenas `foto_path`.
- A tela administrativa cria uma URL assinada temporária para exibir a miniatura e abrir a foto.
- Cada ocorrência pendente incrementa o alerta do bloco cujo nome coincide com `manutencao_ambientes.bloco` do ambiente indicado.

## Regras de cautela

- nem toda pagina relevante usa o `DataContext`
- parte do fluxo depende de imports manuais, nao so de query
- fallback REST pode mascarar diferencas de schema e permissao
- views e Edge Functions devem ser confirmadas no banco quando nao estiverem versionadas no repo

## Extensao Suape 1.9

Quando existem duas ou mais notas fiscais validas, o resumo da extensao oculta regime e valores de retencoes tributarias e identifica a secao apenas como Empenhos; com zero ou uma nota, a secao continua exibindo Retencoes e empenhos.

`process-document.js` injeta o painel somente nas duas rotas de processo do SUAP. O iframe oculto `/suap-extension/process-info` recebe contexto e sessao por `postMessage`, valida origem e janela, consulta ou cadastra o processo, solicita o PDF ao content script quando necessario, armazena-o no bucket `suap-pdfs` e enfileira a extracao existente `process-pdf`. Snapshots e progresso retornam ao painel sem bloquear Financeiro, Atalhos ou IA. No resumo, empenhos sao normalizados para `AAAANExxxxxx`, inclusive quando chegam com prefixo UG/gestao ou como objeto, e equivalentes sao exibidos uma unica vez; entradas que nao contenham o padrao completo sao ignoradas. O resumo remove os metadados operacionais `Status` e `Atualizado` e renderiza cada nota fiscal em sua propria linha. As liquidacoes do card financeiro ficam recolhidas por empenho e so sao exibidas quando o usuario expande o empenho.

O script `plan-summary.js` permanece isolado na rota exata do Plano de Atividades concluido 8. Ele acrescenta o filtro local `Exibir somente atividades com saldo` ao card de filtros nativo do SUAP e transforma os cabeçalhos das tabelas originais em controles de ordenação. `text-expander.js` e global e atua apenas no campo textual em edicao, sem ler nem modificar filtros, metricas ou drill-downs do plano.

### Almoxarifado

App.tsx → Almoxarifado.tsx → inventoryService → tabelas operacionais e RPC post_stock_movement.

A página carrega contexto e workspace em consultas separadas; os dados independentes do workspace são buscados em paralelo. O cadastro de itens é restrito a gestores e a postagem de movimentos é validada novamente no banco.

- Ao clicar em `Imprimir`, a requisicao e salva como rascunho pela RPC antes da abertura da janela de impressao; `Salvar Rascunho` permanece separado e quantidades zero nao bloqueiam nenhuma das duas acoes.

- O relatorio impresso lista apenas itens com quantidade maior que zero (inclusive valores decimais como 0,1) e identifica o sistema como `SIAGES - Sistema Integrado de Administração e Gestão Estratégica`.
- A RLS de `terceirizados` e `terceirizado_permissions` tambem reconhece o grupo `assistencia`, que possui acesso explicito ao cadastro e a gestao de vinculos em `/cadastro-terceirizados`.

- Para o login via SUAP, a identificacao do perfil prioriza user_id, matricula normalizada e entao e-mail legado; quando o grupo terceirizado estiver presente, a rota inicial e sempre /requisicao-compra. O saldo base do subitem aparece imediatamente e o saldo refinado por liquidacoes atualiza a consulta quando o cache termina.

- A exclusao de requisicoes valida o numero de linhas afetadas; quando a RLS impede a operacao, a interface exibe o motivo em vez de confirmar uma exclusao inexistente.

- O fluxo de itens da requisicao nao aceita um status de cache not_found isolado como vazio definitivo: revalida pela Edge Function e usa o Portal diretamente antes de habilitar o cadastro manual.
O mesmo fluxo injeta abaixo do acordeao Legenda o acordeao nativo Resumo financeiro por dimensao, calculado pelas quatro colunas financeiras das tabelas originais.

## Revisão de TR e ETP nos cards do SUAP

Nas rotas de processo do SUAP, `process-document.js` observa links de documentos e classifica somente Termo de Referência (`TR`) ou Estudo Técnico Preliminar (`ETP`). O classificador ignora termos de aprovação, anexos e documentos sem identificação segura.

O botão `siages-suap-document-ai-button` é inserido dentro do mesmo card/linha do link original. O clique abre `/suap-extensao/documento-analise`, envia o contexto validado por `postMessage` e responde à solicitação do iframe baixando o documento com os cookies da aba SUAP. O PDF não é gravado no SUAP, storage ou histórico do SIAGES.

A rota estabelece uma sessão efêmera, chama `analisar-documento-licitacao` e exibe achados, sugestões, limitações e fontes. Os achados aparecem em acordeões fechados inicialmente; a tela permite baixar uma análise HTML independente e abrir uma versão própria para impressão/Salvar como PDF. A análise não edita o documento nem consulta `normativos`, `normativos_chunks` ou `buscar_normativos`.

## Sincronizacao do Plano SUAP no Campus

`/planejamento/campus` carrega os dados locais imediatamente e monta `SuapPlanSyncCard`. Ao entrar, o card chama `sync-suap-plan` em segundo plano; ao concluir, a tabela e recarregada. A primeira captura e uma previa com contagem de novas, atualizadas e arquivadas; a aplicacao ocorre apos a confirmacao do espelho inicial.

O parser le todas as tabelas de atividades do Plano 8, inclusive linhas com `hidden`, usando o ID do link `listar_requisicoes_despesa/8/<id>/` como chave estavel. A extensao continua opcional para o fluxo automatico do Campus.

- No acionamento manual pelo popup, estando na pagina do Plano 8, a extensao captura `document.documentElement.outerHTML` da aba SUAP ja autenticada e envia apenas `{ action: "sync-html", html, sourceUrl }` para `sync-suap-plan` com o JWT do SIAGES. Nao abre outra aba e nao pede novo login SUAP.
- Se a resposta for `preview`, o popup guarda o `runId` e habilita `Aplicar conferencia`; a aplicacao explicita chama `action: "apply"` sem abrir o SIAGES.
- Na pagina Campus, a extensao permanece apenas como acionador da mensagem `siages:suap-plan-sync-request`; o card e o backend continuam funcionando sem a extensao.
- O HTML aceito e limitado ao host e caminho canonicos do Plano 8 e a 15 MB; o parser rejeita tabela ausente, ID duplicado ou captura sem atividades.
