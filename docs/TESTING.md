# Testes

Este documento registra a politica minima de testes do repositorio.

## Prioridade

Indisponibilidade do Supabase e concorrência do inventário SUAP:

- `suapProcessInventoryConcurrency.test.ts`: duas sincronizações do mesmo processo convergem para uma linha, preservam extração/PDF, deduplicam entrada e isolam tenants.
- `dataReadAvailability.test.ts`: as sete leituras centrais não repetem REST após timeout nem depois de um resultado vazio válido.
- `supabaseRest.test.ts`: fallback mantém JWT/campus e interrompe leitura se a sessão falhar; fetch tem prazo máximo.
- `DataContext.test.tsx` e `DataAvailabilityBoundary.test.tsx`: falha inicial não é apresentada como orçamento zerado; erro de atualização mantém cache, recuperação manual limpa o aviso e páginas de importação permanecem acessíveis.
- `CommandPalette.test.tsx` e `suapCommandPaletteGlobal.test.ts`: busca nativa não consulta contratos enquanto fechada e consulta local da extensão só seleciona colunas existentes.

Testes de regressao sao prioridade para qualquer mudanca que altere comportamento real do sistema.

- Ao corrigir um bug, adicione ou ajuste um teste de regressao que cubra o caso corrigido.
- Ao acrescentar uma funcionalidade, adicione ou ajuste testes de regressao para o fluxo afetado.
- Se a regressao nao puder ser automatizada no mesmo trabalho, registre explicitamente o motivo e a validacao manual feita.
- Mudancas em areas criticas nao devem depender apenas de validacao visual ou manual quando houver caminho razoavel para teste automatizado.

## Cobertura esperada

Use testes unitarios para regras puras, normalizadores, parsers, formatadores, filtros, calculos e funcoes utilitarias.

Use testes de integracao para validar contratos entre componentes e camadas, especialmente quando a mudanca atravessar pagina, dialog, service, contexto de dados, cliente Supabase, Edge Function, parser ou tabela/view de destino.

Pontos mais criticos devem ter cobertura preferencial:

- importacoes por CSV, XLSX e PDF
- autenticacao, autorizacao e rotas protegidas
- sincronizacao e leitura de dados do Supabase
- contratos, documentos habeis, financeiro, PFs e conciliacoes
- filtros e metricas exibidas no dashboard
- geracao de documentos e fluxos assistidos por IA
- integracoes, proxies, storage e Edge Functions
- regras de encoding em textos de UI e documentacao

Design system Céu (base Paretto):

- `src/__tests__/designSystemTokens.test.ts` garante tema único (sem `data-suap-theme` nem `SuapThemeSwitcher`), a paleta clara azul-céu no `:root` (navy restrito ao painel do login), Manrope + IBM Plex Mono em `index.css`, `tailwind.config.ts` e `index.html`, botões com `rounded-lg` e ação principal em `primary`, e a ausência do mascote do Paretto.
- `src/components/__tests__/Layout.test.tsx` confirma que o menu do usuário não oferece mais seletor de temas.
- `src/components/design-system/__tests__/RouteLoadingFallback.test.tsx` cobre `AppSplash` (tela de abertura), `PageLoadingSkeleton` (esqueleto com rótulo `sr-only` e blocos `aria-hidden`) e `LoadingState`, todos com `role="status"` e `aria-busy`.
- `src/components/__tests__/Layout.test.tsx` também cobre o cabeçalho automático (`AutoPageHeader`: módulo + título da rota), a supressão dele quando a página declara `PageHeader` e a ausência de título visível nas telas do módulo Orçamentário; `DashboardCurrentTab.test.tsx` cobre a linha única de indicadores e o card Liquidado / Pago; `Dashboard.test.tsx` garante que as visões Orçamento, RAP e Contratos aparecem uma única vez.

Requisições de Compra:

- A RLS e os vínculos `requisicao_compra_itens`/`requisicao_compra_empenhos` devem permitir que usuários do grupo `fiscais-de-contratos` visualizem as requisições e seus detalhes; o slug legado `fiscal-contratos` também deve continuar funcionando.
- Usuários que visualizam o menu `refeitorio` devem visualizar a lista completa de requisições do próprio órgão e seus itens/empenhos vinculados, sem ganhar permissão de escrita.
- Validar que a correção de autorização não altera nem remove as requisições existentes, incluindo seus itens, empenhos vinculados e status.

Contratos via Comprasnet:

- regras puras de vigencia derivada devem cobrir maior `vigencia_fim` do historico, aditivo vencido sem renovacao, rescisao/cancelamento e fallback sem historico
- a sincronizacao deve ter regressao garantindo que contratos retornados pelo endpoint de "ativos" nao aparecem como ativos quando o historico esta vencido
- contratos da UG `158155` devem ter teste de escopo: entram somente com evidencia operacional estruturada do campus `158366`
- a UI de contratos deve testar que o upload manual XLSX nao aparece, que o status da ultima sincronizacao e exibido ao superadmin e que a lista usa `situacao_derivada`
- `contratosApiMappers.test.ts` deve cobrir numeros brasileiros e decimais com ponto retornados pela API, incluindo `quantidade` e `quantidade_faturado`, para impedir que a normalizacao infle valores e interrompa a sincronizacao

Pregoes via PNCP:

- helpers devem cobrir normalizacao de `numeroControlePNCP`, UASG, datas e valores do payload PNCP
- helpers devem cobrir o catalogo interno de UASGs IFRN com CNPJ e aliases compartilhados por uma mesma UASG
- a divisao de periodos deve garantir janelas de ate 365 dias
- a montagem da consulta institucional deve manter o CNPJ IFRN sem restringir UASG e sem enviar `tamanhoPagina`, rejeitado pelo PNCP
- helpers devem cobrir a URL de itens PNCP e a correspondencia textual normalizada em `raw_data.itens`
- a UI deve testar lista institucional inicial sem card de resumo, drawer de detalhes com itens materializados, UASG digitada, filtro de objeto, filtro de item, botao `Buscar no PNCP` e botao `Sincronizar UASGs IFRN`
- a navegacao deve manter `/licitacoes-pregoes` como tela de producao acessivel ao grupo `Diretores`

Atas e ARP:

- helpers devem cobrir normalizacao de ata, item, unidade participante e adesao
- a UI deve testar lista, drawer de detalhes, UASG digitada, botao `Buscar ARP`, recarregamento do cache local mesmo quando a API externa falhar, busca de vinculo `Participante` via cache IFRN, busca de vinculo `Aderente` com UASG alvo separada, botao `Sincronizar UASGs IFRN` e continuidade do lote quando uma UASG falhar
- a busca local deve cobrir descricao/codigo do item e fornecedor materializados, exibindo a correspondencia e indicando atas ainda sem itens carregados
- a contagem de participantes deve usar texto claro (`participante(s)`) e manter hover com as UASGs participantes materializadas
- a navegacao deve manter `/atas-registro-precos` como tela de producao acessivel ao grupo `Diretores`

## Como rodar

A suite principal usa Vitest.

```powershell
npm test
```

Para validar um arquivo especifico:

```powershell
npm test -- src/services/__tests__/financeiroImportService.test.ts
```

Para a verificacao ampla do projeto:

```powershell
npm run check
```

Testes de integracao (falam com servicos reais e dependem de dados vivos, por isso ficam fora de `npm test`) usam o sufixo `.integration.test.ts` e rodam a parte:

```powershell
npm run test:integration
```

### Manter a suite rapida

- A suite completa (`npm test`) deve terminar em poucos minutos. Nunca deixe um teste travar: um laco infinito sincrono nao e interrompido pelo timeout do Vitest e bloqueia a suite inteira.
- Prefira testar regras de negocio como funcoes puras (ex.: `src/lib/requisicaoCompraSaldo.ts`) em vez de exercitar a regra pela interface. Testes de interface ficam para o que so existe na tela.
- Testes que nao usam DOM devem declarar `// @vitest-environment node` na primeira linha: iniciar o jsdom em cada arquivo e o maior custo cumulativo da suite.
- Ao interromper uma execucao no meio, confira se nao sobraram processos `vitest` em segundo plano (eles disputam CPU e distorcem a medicao).

## Criterio de conclusao

Antes de concluir uma correcao de bug ou nova funcionalidade:

- confirme qual comportamento precisava ser protegido contra regressao
- rode os testes relevantes ao modulo alterado
- rode `npm test` quando a mudanca tocar comportamento compartilhado ou area critica
- informe no fechamento quais testes foram executados
- informe qualquer teste que nao tenha sido possivel executar e o motivo

Almoxarifado:

- regras puras devem cobrir situação do saldo e requisitos de origem/destino;
- integração deve cobrir idempotência, concorrência, saldo negativo, bloqueio e isolamento RLS;
- o fluxo deve proteger entrada, saída, transferência e custo médio da origem;
- a UI deve cobrir estado vazio, filtros, cadastro de item e lançamento de movimento.

## Piloto SUAP por PDFs individuais

Cobertura mínima obrigatória do piloto manual:

- parser do HTML e classificação em português com variações de acento; documentos desconhecidos devem permanecer incluídos;
- associacao estrutural de tabelas a dimensoes (fixture com AD e TI), incluindo execucao no parser linkedom da Edge Function;
- limite de quatro downloads concorrentes, falha de download registrada por título/erro e prioridade da primeira extração com os PDFs úteis já disponíveis; o PDF completo só pode ser enfileirado depois como complementação de resultado incompleto ou sem nota fiscal utilizável;
- bloqueio de URLs externas, caminhos de documento sem `?original=sim` e par?metros arbitr?rios no `suap-proxy`;
- migration com inventário e histórico isolados por `tenant_id` e RLS; endpoint deve validar os IDs contra o processo/tenant antes de enfileirar;
- regressão do PDF completo, extensão SUAP, Editor de Documentos, PDFs pesados por blocos e múltiplas notas fiscais.

Rollout: executar A/B manual em 10 processos de pagamento representativos. Promover a estratégia apenas se a mediana até `success` ou `incomplete_extraction` reduzir pelo menos 40% e os campos relevantes permanecerem iguais ou mais completos após revisão humana.

## Revisão inteligente de TR e ETP

- `suapDocumentReview.test.ts` cobre classificação por acento/caixa/sigla, rejeição de aprovação/anexo, normalização de resposta e allowlist de fontes.
- `suapExtensionDispatch.test.ts` cobre origem, janela, processo, documento, caminho `?original=sim` e correspondência do PDF ao documento selecionado.
- `suapProcessDocumentExtension.test.ts` cobre ícone dentro do card, ausência de falso positivo e idempotência após nova varredura.
- `SuapExtensionDocumentAnalysis.test.tsx` cobre contexto, sessão, solicitação do PDF, chamada da função, achado com fonte, acordeão inicialmente fechado, ações de baixar/imprimir, alternância claro/escuro e ausência de edição automática.
- `suapDocumentReviewExport.test.ts` cobre a geração do HTML independente da análise e o escape do conteúdo textual.
- O mesmo teste simula o worker do pdf.js desanexando o `ArrayBuffer`; o fluxo deve preservar uma cópia para a contagem de páginas e outra para a codificação do PDF.
- Antes do deploy, validar manualmente um TR, um ETP, um termo de aprovação, um PDF inválido, sessão ausente, documento acima de 20 MB e PDF acima de 200 páginas.

## Regressao da extensao Comprasnet ETP

- `comprasnetEtpQuestionnaire.test.ts` protege o questionário geral e a exclusão de campos estruturados.
- `comprasnetEtpPreferences.test.ts` verifica normalização, limites e que processo, anexos e rascunhos não integram a preferência persistida.
- `comprasnetEtpContentScript.test.ts` verifica injeção única, preservação do `body`, leitura do CKEditor, aplicação exclusiva da seção aberta e ausência de acionamento de `Concluir ETP`.
- `comprasnetPredocAlert.test.ts` verifica a diferença entre pré-doc vazio e preenchido no formulário de apropriação, incluindo favorecidos e deduções, bloqueio de abas, confirmação, apropriação e saída do navegador somente quando a aba de pagamento está ativa.
- `suapExtensionPackage.test.ts` verifica o manifesto, a rota oficial do Comprasnet, o CSS isolado e os scripts da extensão.
- A validação manual deve cobrir seção atual, prévia completa como referência, aplicação de uma única seção, campo preenchido, campo vazio, sessão expirada, autosave ausente, persistência apenas das preferências, anexos e viewport estreito.

## Regressao da extensao Suape

A pasta corrente e centralizada por `src/test/extensionFixtures.ts`. As suites `suapExtensionPackage`, `suapCommandPaletteGlobal`, `suapProcessDocumentExtension`, `suapTextExpander`, `suapExtensionDispatch`, `SuapExtensionProcessInfo`, `suapPlanContentScript` , `suapCloneAutomation` e `suapUploadAutomation` protegem manifesto e rotas, painel de processo, bridge segura, sincronizacao, Financeiro, atalhos, popup, Plano de Atividades , clonagem e upload de documentos externos. `suapScheduledProcessSync` cobre os horarios de dias uteis, as duas caixas padrao, extracao de processos do HTML, deduplicacao e deteccao de sessao SUAP expirada; `suapCommandPaletteGlobal` protege as consultas SUAP e a navegacao da paleta fora do SUAP, mantendo o comando de sincronizacao imediata oculto em paginas externas.

- `suapUploadAutomation.test.ts` valida o preenchimento automático de upload de documento externo no SUAP (`/processo_eletronico/documento_upload/*`), cobrindo leitura de payload via hash `#siagesUpload=` e storage, seleção por texto normalizado de Tipo de Conferência (`#id_tipo_conferencia`), sincronização nativa e de Select2 v3/v4 em Tipo de Documento (`#id_tipo`), preenchimento de Assunto (`#id_assunto`), disparo de eventos DOM e remoção do hash da URL.
- `suapProcessFinanceClient.test.ts` confirma que o cliente efemero da extensao percorre toda a cadeia financeira, sem retorno acidental ao cliente Supabase global.
- `SuapExtensionProcessInfo.test.tsx` confirma que o mesmo cliente chega ao resumo financeiro, o snapshot inicial reflete dados da página, customMappings sincronizados do portal são mesclados com prioridade e o fluxo de mapeamento (ex.: Bolsas) é selecionado e mantido com fidelidade; `suapProcessDocumentExtension.test.ts` garante a captura de dados do DOM no contexto, delegação de abertura de abas ao background imune a popup blocker e que falhas e timeouts substituem o carregamento por mensagem acionavel.

- `suapExtensionPackage.test.ts` protege a configuracao da paleta global: ela cobre `<all_urls>` exceto SIAGES e SUAP, incluindo Comprasnet; a paleta nativa do SIAGES e a paleta especializada do SUAP continuam sem duplicacao, e telas/acoes da extensão apontam para a origem publica do SIAGES. `suapCommandPaletteGlobal.test.ts` valida as consultas e URLs oficiais do SUAP fora do SUAP; a busca global `condh` por CPF/CNPJ ou número RP/NP, resumo e paginação na paleta, detalhamento financeiro, aplicação da permissão de tela e bloqueio sem acesso; e a navegação SUAP com Enter/Ctrl+Enter, mantendo a sincronizacao imediata restrita. `LiquidacoesPagamentos.test.tsx` cobre o preenchimento via fragmento legado e a abertura dos detalhes; `CommandPalette.test.tsx` cobre a consulta na paleta nativa.

- `suapExtensionAuth.test.ts` cobre a sessão persistente da extensão: renovação concorrente serializada, recriação idempotente do alarme, preservação em falha transitória, revogação definitiva e logout durante uma renovação. As respostas públicas do worker não podem conter `refreshToken`; `suapExtensionPackage.test.ts` garante esse contrato nos scripts distribuídos.

- No Plano de Atividades concluído 8, cobrir a ordenação nos cabeçalhos das tabelas originais e o checkbox `Exibir somente atividades com saldo` inserido no card nativo de filtros, sem esconder linhas com saldo positivo.

- `suapProcessDocumentExtension.test.ts` cobre a restauração do snapshot e do resumo financeiro ao navegar de um processo para o documento SUAP relacionado, o alinhamento dos controles de minimizar/maximizar na mesma linha do título "SIAGES", a inicialização da extensão minimizada por padrão em páginas de visualização de PDFs digitalizados (`/documento_eletronico/visualizar_documento_digitalizado/<id>/`) sem sobrescrever a preferência global persistida do usuário, a exibição simplificada da aba de IA contendo apenas o botão de ação direta ("Gerar documento"), a funcionalidade de colapsar e expandir seções, a remoção do item Caixa na seção Processo e posicionamento da seção Caminho do Processo como última seção do painel de resumo, o ajuste manual interativo da etapa atual do processo, bem como a exibição e o acionamento do botão de check discreto na etapa atual para disparar automações configuradas com avanço de etapa e notificação toast.
- `suapProcessFlow.test.ts` cobre o fluxo BPMN, propagação das definições de automação das etapas do mapeamento e preservação de metadados operacionais.
- `suapSiafiFavorecidos.test.ts` cobre a identificação da tabela SIAFI, validação prévia, normalização de CPF, conversão de moeda para centavos sem separador, inclusão de linhas, preservação de dados existentes, limite de 10 registros por lote e ausência de clique em `Confirmar`.
- `suapSiafiPopup.test.ts` cobre carregamento REST de listas compartilhadas com a sessão da extensão, bloqueio sem sessão, ocultação fora do host SIAFI e envio para o frame interno correto.
- `suapSiafiPredocAlert.test.ts` cobre a detecção de pré-doc ausente em qualquer linha de favorecido ou dedução, o bloqueio das abas internas e de `Registrar Alterações`, a exceção de `Verificar Consistência`, a decisão de permanecer/continuar e o alerta nativo de saída do navegador.
- A validação manual do Comprasnet deve usar uma fatura com pré-doc vazio e depois preenchido: na rota de alteração da apropriação, a célula passa a exibir o controle de remoção após o preenchimento. O alerta deve proteger a troca de abas, `Confirmar Dados de Pagamento`, `Apropriar SIAFI`, links e saída do navegador, sem bloquear o próprio fluxo de edição do pré-doc.
- `suapClickHints.test.ts` cobre a ativação por `Ctrl+;`, filtragem dos códigos (inclusive mantendo `Ctrl` pressionado para compor o atalho de saída), execução com `Enter`, foco de campos, clique com modifier em botões e abertura de links em nova aba com `Ctrl+Enter` (resolvendo elementos filhos e URLs relativas); `suapExtensionPackage.test.ts` protege a ponte com o service worker.
- A validação manual da extensão 1.9.26 deve usar uma transação SIAFI com uma linha curta e outra com múltiplos favorecidos, verificando que linhas antigas permanecem intactas e que a confirmação final continua manual.
- A validação manual da extensão 1.9.46 deve usar uma edição de DH com pré-doc vazio e outra com pré-doc preenchido, incluindo ao menos uma dedução: o aviso de pendência deve aparecer somente quando a aba ativa for `Dados de Pagamento`; em `Dados Básicos`, `Detacustos` e demais abas, `Registrar`, `Registrar Alterações`, `Salvar Rascunho`, cancelar, links e a saída do navegador devem permanecer livres. Na aba `Dados de Pagamento`, `Confirmar` e `Descartar` das listas de favorecidos e deduções devem funcionar para liberar seus botões `Pré-Doc`; `Registrar`, `Registrar Alterações`, `Salvar Rascunho`, cancelar ou usar um link deve oferecer permanecer na página ou continuar; `Verificar Consistência` deve continuar disponível; voltar, recarregar e fechar a guia devem usar o alerta nativo do navegador. Com múltiplos favorecidos ou deduções, basta uma linha sem pré-doc para bloquear a saída. No SUAP, abrir o detalhe de um empenho pela paleta `Ctrl+K` deve manter os quatro cards de valores em uma linha no desktop, em duas colunas em janela estreita e em uma coluna no celular.
- `suapCommandPaletteGlobal.test.ts` (extensão 1.9.53) cobre o acionamento de atalhos de processo com ID explícito (`up <id>`, `enc <id>`, `<id> <cmd>`, `<id>`), a normalização para URLs absolutas do SUAP fora do domínio, a ativação da automação de upload de documentos (preenchimento dos campos tipo de conferência, tipo e assunto via `#siagesUpload=` e persistência em `sessionStorage`), e a injeção dos badges `.suape-process-id-badge` na Caixa de Processos do SUAP com clique para cópia para o clipboard e `Alt+Clique` para navegação direta com automação.

Antes de publicar uma nova versao, execute as suites focadas, `src/__tests__/encoding.test.ts`, `npm test`, `npm run build` e `npm run check`; em seguida compare os arquivos do diretorio da extensao com o ZIP gerado.

### Validacao da versao 1.9 em 2026-08-02

A correcao de compatibilidade do login foi publicada no pacote como `1.9.2`, permitindo confirmar no cabecalho da extensao que o Chrome descartou a versao anterior mantida em memoria. O fluxo tambem trata `401` do Supabase como credencial SIAGES recusada, sem confundir falha de rede com erro de botao.

- 43 testes focados da extensao, bridge, pagina SIAGES, Plano de Atividades, popup, atalhos e clonagem: aprovados; as regressões incluem a blindagem de layout dos formularios, cards de atalhos e titulos das abas contra CSS global do SUAP, alem da persistencia da sessao autenticada, consistencia da chave anonima entre os scripts e mensagem explicita para respostas `401` ou matricula usada no lugar do e-mail do SIAGES;
- teste de encoding: aprovado;
- `npx tsc --noEmit`: aprovado;
- `npm test`: aprovado;
- `npm run build`: aprovado;
- ESLint dos arquivos alterados: aprovado;
- pasta 1.9 e ZIP: nove arquivos comparados por SHA-256, sem divergencias;
- `supabase migration list`: historico local e remoto alinhado;
- `supabase functions deploy process-pdf`: deploy de validacao concluido no projeto vinculado;
- `npm run check`: bloqueado no lint global por cinco erros preexistentes fora do escopo, em `AuditLog.tsx`, `ControleOrgaos.tsx` e `supabase/functions/pesquisar-precos/index.ts`; as etapas de testes e build foram executadas separadamente e aprovadas.
Tambem validar o quadro Resumo financeiro por dimensao abaixo da Legenda, com uma linha por dimensao e os quatro totais financeiros.

## Sincronizacao SUAP -> Campus

Os testes do parser cobrem acentos, moeda brasileira, IDs de atividades e linhas ocultas. A suite de unidades cobre as 44 opções do seletor, round-trip das URLs, a URL legada sem query de Currais Novos, UASG-pai, unidades sistêmicas e rejeição de parâmetros inválidos. A suite de serviço cobre sincronização individual com UASG, lote completo, retomada por `batchId`, prévia de lote, aplicação individual e `apply-batch`. A suite de isolamento verifica chave composta, snapshots e diffs delimitados por `suap_unit_code` + `campus_uasg`, blocos de lote limitados para evitar timeout e lock global. A suite de segurança cobre a permissão exclusiva do caminho canônico do Plano 8 no proxy. O fluxo remoto deve ser validado com HTML fixture para prévia, aplicação idempotente, alteração de valor, nova atividade, arquivamento e falha sem commit parcial.

A leitura do planejamento tem regressão específica para Currais Novos: unidades SUAP `19`, `36`, `25` e `29` compartilham o UASG `158366`, mas somente a unidade ativa pode compor seus indicadores; linhas `sync_active = false` também não podem ser somadas. O teste cobre o caminho principal do Supabase e o fallback REST, preserva atividades manuais e mantém registros legados sem `suap_unit_code` como unidade `19`.

- O popup na aba SUAP deve usar `chrome.scripting.executeScript`, enviar `action: "sync-html"` com HTML e `sourceUrl`, e nunca inserir linhas diretamente.
- O popup, ao solicitar o lote sem conexão backend, deve reutilizar o `sessionid` da aba autenticada via `chrome.cookies.get`, chamar `connect-cookie` e repetir `sync-all`, sem escrever o cookie no log.
- Apos uma previa, o popup deve exibir `Aplicar atividades desta unidade` (ou `Aplicar atividades das unidades conferidas` para o lote), enviar `action: "apply"` com o `runId` persistido (ou `apply-batch` com `batchId`) e ocultar o botao somente apos sucesso.
- Na aba Campus, o popup pode reenviar `siages:suap-plan-sync-request`; a sincronizacao automatica deve continuar funcionando sem extensao.
- Testar HTML ausente, URL externa, HTML acima de 15 MB e resposta 401/500 com mensagem segura.
- Verificar que a Edge Function consegue interpretar o HTML no runtime Deno sem depender de DOMParser global.

- A revisão de documentos SUAP também testa persistência em suap_document_reviews, carregamento pelo modo latest e presença dos dois ícones no card: gerar e consultar a última análise salva.

## Sincronização de contratos PNCP

As regressões pncpSync, pncpContratos, pncpInstrumentosCobranca e
ContratoApiDetailsSheet cobrem paginação, renovação, identidade, erro HTTP/banco,
sucesso parcial, persistência no servidor e respostas atrasadas na UI.
Ver [cenários e validação remota](ops/PNCP_CONTRACT_SYNC.md).

## Escopo IFRN por campus

- o catálogo mantém 19 UASGs e o padrão `158366`
- a preferência do usuário persiste via RPC e rejeita UASG fora do catálogo
- chaves de query e serviços carregam a UASG ativa, sem fallback silencioso para Currais Novos
- contratos da Reitoria entram somente por empenho/fatura do campus selecionado; os detalhes filtram itens financeiros relacionados
- a migration `20260907150000_add_user_campus_scope.sql` deve ser validada com métricas pré/pós de Currais Novos, ausência de nulos e teste RLS entre dois campi

## Geração de Despacho de Liquidação (SUAP)

- A pontuação, acentuação gráfica e crases dos templates de despacho manual em `suapDispatchGeneration.ts` e do diálogo `SuapDocumentGeneratorDialog.tsx` devem permanecer corretas em português culto (`Despacho de Liquidação`, `À Coordenação de Finanças e Contratos`, `Autorização para Liquidação da Despesa`, `prestação de serviços`, `recebimento do objeto adquirido`, `Direção-Geral`, etc.).
- Os marcadores de pendência nos modelos manuais devem utilizar acentuação (`[valor da liquidação]`, `[objeto do serviço]`, `[objeto da aquisição]`, `[número do processo]`, `[número do edital]`).
- A suite `src/lib/__tests__/suapDispatchGeneration.test.ts` e o teste estrutural em `src/services/__tests__/suapProcessPdfAiConfig.test.ts` validam essas strings e títulos.
- Validação de encoding contra mojibake via `src/__tests__/encoding.test.ts`.

## Extensão SUAP - Painel do Processo e Configurações

- Popup SIAGES 1.9.63: `suapPopupAccount.test.ts` cobre login por formulário, sessão ativa sem campos de credenciais, logout, limpeza de senha, erros e atualização reativa da sessão, além da separação de autenticação/sincronização e remoção do segredo de automação. Contrato visual e operacional: [EXTENSION_POPUP](frontend/EXTENSION_POPUP.md).
- Popup 1.9.63: a mesma suíte garante que agenda, atividades e RDs só aparecem e são consultadas para superadmin, sem exposição durante carregamento ou erro de sessão; testa os critérios de `authz.ts`, nega `user_metadata`/admin comum e impede que respostas atrasadas restaurem acesso após logout/troca de conta. A suíte de RDs usa sessão superadmin e aguarda a liberação da seção antes de acionar controles.

- Os títulos de seções estáticas do painel de configurações (`Aparência`, `Acesso ao SIAGES`) e mensagens de estado mantêm espaçamento (`padding: 10px 12px 9px !important`), borda divisória inferior e display em bloco, impedindo que encostem nas bordas do card.
- A tela de autenticação da extensão na aba de configurações alterna de forma reativa:
  - Quando autenticado (`session?.accessToken`), exibe o card de usuário conectado com e-mail, status de sessão ativa e botão de largura total `Sair`, ocultando os campos de login e o botão `Entrar`.
  - Ao clicar em `Sair`, encerra a sessão via `SiagesExtensionAuth.signOut()`, oculta os dados do usuário e reexibe os campos de e-mail e senha com o botão `Entrar`.
  - O isolamento contra estilos hostis do SUAP cobre formulário, campos, caixas de usuário e botões de ação.
- A suite `src/lib/__tests__/suapProcessDocumentExtension.test.ts` valida o isolamento de layout, a alternância de estado de login/logout e as regras de estilo de títulos de seção.

## Regressões de RDs SUAP

O parser cobre a RD cancelada 2025RD004586 sem linhas de empenho quando o aviso de ausência de natureza está presente, a RD 2025RD000480 com o campo “Valor provisório”, e ainda rejeita página concluída ou aviso ausente sem a tabela.

Associações e coleta interrompida (06/10): regressões de `suapRdSync.test.ts` cobrem pendente concluindo durante o detalhe, retomada legada com hashes novos, mudanças posteriores com reconferência seletiva, limite de três rodadas e bloqueio de identidade/tipo/situação alterados de concluídas. `suapRdService.test.ts` e `SuapRd.test.tsx` distinguem captura incompleta, prévia sem aplicação, aplicação anterior preservada e falhas de leitura, mantendo o escopo autenticado. O SQL descartável inclui `2026RD000016` / `2026NE000001` / atividade oficial `35206`, validando as duas FKs e as views após aplicação.

Reaproveitamento na 1.9.57: `suapRdReuse.test.ts` valida segunda coleta de concluídas (23→3 páginas no fixture de 10 RDs), ausência de expiração/auditoria de concluídas, preservação de payload/data, pendentes em cada execução e transição para conclusão, novas RDs, relações oficiais alteradas, nomes renomeados sem trocar IDs, canceladas com auditoria/prazo, bases legadas, snapshots ausentes, JSONB reordenado, falha/retomada e isolamento por usuário/órgão/campus/unidade. Popup/background cobrem `forceFull` nos dois escopos e contadores sem bloquear atividades. O teste SQL descartável também aplica/reverte snapshots copiados, preserva `captured_at` e verifica idempotência e líquidos.

`suapRdParser.test.ts` cobre a estrutura real (TH de situação, cancelada sem coluna situação, lista vazia oficial), variantes de cabeçalho e formato para a data de cadastro do inventário, valores negativos, total e escopo. `suapRdSync.test.ts` cobre persistência da data, retomada, inventário final e redirecionamentos; `suapRdReuse.test.ts` garante que snapshots antigos reaproveitados recebam a data atual do inventário. `suapRdService.test.ts` cobre paginação e filtros autenticados. `suapRdMatching.test.ts` cobre IDs oficiais, ausência de inferência, vínculos manuais e NE compartilhada. `SuapRd.test.tsx` cobre a tabela `HISTÓRICO DE OPERAÇÕES`, data de cadastro, cabeçalho Atividade, cores dos valores, movimentos, exclusão de canceladas dos totais, falha explícita de consulta, publicação automática durante coleta e recuperação/reversão de snapshots parciais. `EmpenhoDialog.test.tsx` verifica a ordem Liquidações antes de Subitens do Empenho e a remoção da tabela histórica anterior. `scripts/test-suap-rd-db.mjs` valida o SQL em PostgreSQL/WASM descartável, inclusive RLS, isolamento, data da RD na view, idempotência e reversão parcial/completa. Instruções: [SUAP_RD_SYNC](ops/SUAP_RD_SYNC.md).

O resumo do processo da extensão é coberto em `suapProcessDocumentExtension.test.ts`; a ação secundária de CPF/CNPJ deve copiar apenas dígitos e coexistir com a cópia do valor original.

Extensão 1.9.56: `suapRdExtension.test.ts` integra o coletor da extensão com o parser/backend por etapa, cobre as 44 unidades, isolamento de unidades irmãs, falha parcial, retomada, pausa e URLs recusadas. `suapRdBackground.test.ts` cobre execução independente do popup, acesso ao HTML via aba, ausência de cookies/refresh token no payload, origem das mensagens, aba encerrada, aplicação explícita do lote por unidade e resposta perdida após aplicação. `suapRdPopup.test.ts` cobre sincronização/aplicação exclusiva de atividades por unidade e em lote, coleta exclusiva de RDs nos dois escopos, preservação das mensagens de atividades, atividades durante coleta de RDs, início de RDs sem aguardar a resposta do plano e estados de lote parcial. O progresso de vínculos deve identificar relações oficiais, sem sugerir sincronização de atividades. `suapRdSync.test.ts` também cobre HTML vazio/excessivo, campus divergente e página fora da ordem. `SuapRd.test.tsx` garante que o cartão atualiza a conferência da extensão sem iniciar coleta backend. Validar manualmente sessão expirada, worker reiniciado, fechar/reabrir popup, lote com unidade sem permissão e revisão das prévias antes de aplicar.

Extensão 1.9.59: `suapRdExtension.test.ts` confirma que o worker reconhece a unidade automaticamente aplicada como sucesso. `suapRdBackground.test.ts` mantém retomada, lote, sessão e aplicação legada; `suapRdPopup.test.ts` cobre o fallback manual das prévias antigas. A regressão SQL aplica snapshots durante coleta parcial, confere idempotência, preservação/restauração dos registros anteriores e reconciliação completa; `SuapRd.test.tsx` verifica a contagem de publicações automáticas e o botão de recuperação apenas para itens pendentes. O pacote `1.9.59.zip` deve ser comparado por SHA-256 com os 30 arquivos da pasta antes da distribuição.
