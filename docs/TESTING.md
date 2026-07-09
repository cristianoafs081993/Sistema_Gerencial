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
