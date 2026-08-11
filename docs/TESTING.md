# Testes

Este documento registra a politica minima de testes do repositorio.

## Prioridade

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

Contratos via Comprasnet:

- regras puras de vigencia derivada devem cobrir maior `vigencia_fim` do historico, aditivo vencido sem renovacao, rescisao/cancelamento e fallback sem historico
- a sincronizacao deve ter regressao garantindo que contratos retornados pelo endpoint de "ativos" nao aparecem como ativos quando o historico esta vencido
- contratos da UG `158155` devem ter teste de escopo: entram somente com evidencia operacional estruturada do campus `158366`
- a UI de contratos deve testar que o upload manual XLSX nao aparece, que o status da ultima sincronizacao e exibido ao superadmin e que a lista usa `situacao_derivada`

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
- `SuapExtensionDocumentAnalysis.test.tsx` cobre contexto, sessão, solicitação do PDF, chamada da função, achado com fonte e ausência de edição automática.
- O mesmo teste simula o worker do pdf.js desanexando o `ArrayBuffer`; o fluxo deve preservar uma cópia para a contagem de páginas e outra para a codificação do PDF.
- Antes do deploy, validar manualmente um TR, um ETP, um termo de aprovação, um PDF inválido, sessão ausente, documento acima de 20 MB e PDF acima de 200 páginas.

## Regressao da extensao Suape

A pasta corrente e centralizada por `src/test/extensionFixtures.ts`. As suites `suapExtensionPackage`, `suapProcessDocumentExtension`, `suapTextExpander`, `suapExtensionDispatch`, `SuapExtensionProcessInfo`, `suapPlanContentScript` e `suapCloneAutomation` protegem manifesto e rotas, painel de processo, bridge segura, sincronizacao, Financeiro, atalhos, popup, Plano de Atividades e clonagem.

- No Plano de Atividades concluído 8, cobrir a ordenação nos cabeçalhos das tabelas originais e o checkbox `Exibir somente atividades com saldo` inserido no card nativo de filtros, sem esconder linhas com saldo positivo.

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

Os testes do parser cobrem acentos, moeda brasileira, IDs de atividades e linhas ocultas. A suite de seguranca cobre a permissao exclusiva do caminho canonico do Plano 8 no proxy. O fluxo remoto deve ser validado com HTML fixture para previa, aplicacao idempotente, alteracao de valor, nova atividade, arquivamento e falha sem commit parcial.

- O popup na aba SUAP deve usar `chrome.scripting.executeScript`, enviar `action: "sync-html"` com HTML e `sourceUrl`, e nunca inserir linhas diretamente.
- Apos uma previa, o popup deve exibir `Aplicar conferencia`, enviar `action: "apply"` com o `runId` persistido e ocultar o botao somente apos sucesso.
- Na aba Campus, o popup pode reenviar `siages:suap-plan-sync-request`; a sincronizacao automatica deve continuar funcionando sem extensao.
- Testar HTML ausente, URL externa, HTML acima de 15 MB e resposta 401/500 com mensagem segura.
- Verificar que a Edge Function consegue interpretar o HTML no runtime Deno sem depender de DOMParser global.
