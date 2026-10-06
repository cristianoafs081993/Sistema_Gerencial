# Integração de RDs, atividades e empenhos

Implementação de 05/10/2026, com coleta pela extensão Suape 1.9.55 em 06/10/2026. Complementa a investigação em [SUAP_RD_ATIVIDADES_EMPENHOS](../planning/SUAP_RD_ATIVIDADES_EMPENHOS.md).

## Fonte e identidade

A integração lê o inventário de todas as situações de RDs da unidade SUAP, todas as atividades do Plano 8 (inclusive as de saldo zero), a relação oficial `/plan_estrategico/listar_requisicoes_despesa/8/<atividade_id>/` e o detalhe de cada RD. A relação oficial fornece os IDs: nome, processo e PI são conferências e nunca critérios de atribuição no dashboard.

O escopo é `org_id + campus_uasg + suap_unit_code`. O catálogo `suap_rd_units` valida a associação entre unidade SUAP e UASG. A UASG 158366 inclui DG/CN (19), DG/JUC (25), DG/PAAS (29) e DG/CTM (36); elas permanecem separadas. O parser valida a unidade do documento e a UG do número completo da NE. O ano e a gestão da NE são preservados. RDs históricas sem relação oficial no Plano 8 ficam disponíveis como movimentos, sem atribuição a uma atividade de 2026 por nome.

## Captura e armazenamento

| Objeto | Responsabilidade |
| --- | --- |
| `suap_rd_units` | Catálogo de unidade SUAP / UASG / código institucional |
| `suap_rd_sync_runs` | Estado, inventário, cursores, cobertura, resumo e lease de execução |
| `suap_rd_snapshots` | Payload estruturado de cada RD por execução, com linhas, fontes, checksum SHA-256 e horário de captura |
| `suap_requisicoes_despesa` | Projeção ativa da revisão aplicada de cada RD |
| `suap_rd_movimentacoes` | View com linhas, evidências e resolução dinâmica das FKs locais |
| `atividade_empenho_vinculos` | View agregada por atividade / NE, com líquido das RDs confirmadas |

Migration: `20261005120000_create_suap_rd_integration.sql`. Não altera `empenhos.atividade_id`, valores SIAFI, liquidação, pagamento, RAP nem saldos oficiais do plano.

A extensão executa GETs na aba SUAP autenticada via `chrome.scripting.executeScript`, com `credentials: include` e timeout de 12 segundos. O cookie permanece no Chrome; somente HTML e URL são enviados. O backend escolhe a próxima URL, valida a página correspondente ao cursor, limita o HTML a 15 MB (bytes UTF-8) e processa uma página por chamada. As fases são inventário, plano, relações de atividades, detalhes e conferência final. O lease permanece em 120 segundos. A paginação começa em 1, preserva a unidade e rejeita duplicatas ou mudanças de contagem. Cada etapa falha sem avançar seu cursor. O inventário é relido no final e comparado por RD/número/tipo/situação. **Essa conferência não é uma transação do SUAP:** mudanças apenas de valores durante a coleta podem exigir nova captura; as linhas registram o horário de sua leitura.

O worker da extensão continua quando o popup é fechado. Se o Chrome encerrar o worker ou a aba, reabra a extensão e retome: o cursor e os snapshots persistidos no servidor prevalecem. Não há retomada automática depois que o Chrome é encerrado. Pausar conclui a página em andamento antes de parar.

O lote consulta o catálogo autenticado das 44 unidades e percorre cada uma sequencialmente. Falhas não bloqueiam as unidades seguintes. O estado agregado do lote fica em `chrome.storage.local`; as execuções e prévias individuais permanecem no banco. A retomada reutiliza prévias completas existentes e os cursores incompletos. Uma nova coleta após aplicação inicia nova revisão daquela unidade. Não há aplicação automática nem transação única entre os 44 campi/unidades: cada aplicação é atômica por unidade, e o popup informa aplicações e falhas separadamente.

Capturas incompletas, falhas de sessão ou de parsing não substituem a projeção ativa. A retomada reutiliza cursores e snapshots. Se o inventário mudar, descarte a conferência e inicie outra. Ausências só desativam RDs anteriores depois de uma captura completa da mesma unidade.

`apply_suap_rd_snapshot` aplica todas as RDs da execução em uma transação e é idempotente. `revert_suap_rd_snapshot` restaura a execução aplicada anterior da unidade (ou desativa a primeira captura), preservando os snapshots e impedindo a reversão de uma aplicação sobreposta por outra mais recente.

## API, autorização e sessão

`POST /functions/v1/sync-suap-rds`, ações `units`, `sync-extension`, `sync-html`, `status`, `apply`, `discard`, `revert` e `sync` (compatibilidade com o coletor backend). `units` retorna o catálogo com UASG-pai; `sync-extension` inicia/retoma e retorna `runId` e `nextUrl`; `sync-html` exige `runId`, `html` e `sourceUrl` exatamente igual à etapa esperada. Parâmetros de escopo: `suapUnitCode`, `campusUasg` opcional (derivado e validado pelo servidor). `status` retorna a última execução do usuário/unidade. Prévia pronta exige `apply` explícito. Respostas incluem `captureMode` e `nextUrl`; capturas iniciadas pela extensão só podem ser continuadas por ela.

A function usa `verify_jwt=false` na configuração e valida internamente JWT do SIAGES, usuário real, órgão e `is_superadmin_jwt`. Somente o superadmin coleta/aplica/reverte ou consulta o catálogo de sincronização. Não recebe URLs arbitrárias nem sessão SUAP no corpo. O HTML é entrada administrativa validada; declarar uma URL não prova autenticidade criptográfica do conteúdo. Na extensão, somente o popup pode acionar o worker de RDs; URLs externas, filtros extras, redirecionamentos inesperados e páginas de login são recusados.

Segredos usados: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. `SUAP_SESSION_ENCRYPTION_KEY` continua opcional apenas para o coletor backend de compatibilidade (`sync`), que reutiliza a conexão cifrada de `sync-suap-plan`. Nenhuma variável nova de frontend. `sync-extension` e `sync-html` não consultam `suap_connections` nem exigem conexão SUAP no servidor.

`status` também retorna `appliedRun`, a última execução ainda aplicada do usuário/unidade, para manter a reversão acessível mesmo quando uma nova conferência falhar ou for descartada.

Entre no SIAGES no popup e mantenha uma aba SUAP autenticada aberta. Expiração solicita login nessa aba e retomada pela extensão, sem aplicar uma captura parcial. A sessão do SIAGES é renovada entre chamadas; o `refreshToken` e os cookies não são enviados nas capturas ou gravados nos estados de RDs.

Tabelas têm RLS por órgão/campus. Usuários autenticados leem; escrita e RPCs de aplicação/reversão são restritas a `service_role`. As views usam `security_invoker`. O cliente acrescenta filtros de órgão, campus e unidade, pagina os resultados e nunca usa fallback anônimo para RDs.

## Interface e valores

No popup, `Sincronizar Plano 8 e RDs da unidade` captura o plano e inicia as RDs da unidade selecionada. `Sincronizar plano e RDs de todas as unidades` mantém o lote existente do plano e inicia o lote das RDs; o mecanismo existente de sessão cifrada do lote do plano permanece. Também há botões exclusivos para coletar/retomar RDs individuais ou de todas as unidades, sem recapturar o plano no SIAGES. O popup mostra progresso, unidades com falhas e totais, e oferece aplicação explícita das prévias completas. A aplicação em lote confere novamente no servidor usuário, unidade, execução e completude e persiste cada resultado.

Em Importação de dados, o cartão de RDs permite escolher a unidade dentro da UASG ativa, atualizar o estado da captura da extensão, conferir, aplicar, descartar e reverter. Não inicia coleta backend. A prévia mostra as RDs e suas linhas em páginas de 20, totais por tipo e contagens de atividade/NE ausente, NE ambígua e conflito manual. As contagens de pendências locais são por linha confirmada. Para conferir outra UASG, altere o campus ativo no SIAGES.

Somente `RD Concluída + linha Confirmada + tipo dotação/reforço/anulação + UG do campus` compõe os totais de RDs. Anulações conservam o sinal negativo. RDs canceladas com NE são exibidas, mas não anulam a NE nem entram nesses totais. Valor inicial, autorização e valor final da linha são diferentes fontes; o valor confirmado da linha é o valor do movimento.

Os detalhes do empenho mostram dotação, reforços, anulações, líquido, divergência para o valor SIAGES, RD, RO, natureza, atividade, estado e horário de captura. Histórico importado por outros pipelines permanece separado para impedir somas duplicadas. O horário de captura não é apresentado como data da operação SIAFI.

Na lista de empenhos, `SuapRdMovementBadge` indica a quantidade de reforços/anulações confirmados por RD/RO e abre o detalhe. Linhas de natureza da mesma RD/RO não multiplicam a contagem nem as linhas da NE. Compartilha a consulta/cache de movimentos com o detalhe.

No dashboard, vínculos manuais continuam válidos. Os vínculos oficiais são resolvidos antes do filtro de origem e exigem os IDs oficiais e a unidade da atividade. Sem evidência, o empenho fica não associado; as antigas pontuações textuais não entram nos totais dessa tela. Uma NE compartilhada por atividades distribui apenas os líquidos oficiais e exige que a soma feche com o valor do empenho; divergências ficam pendentes. Saldos oficiais do Plano 8 continuam prevalecendo.

As views resolvem dinamicamente atividades/NEs importadas posteriormente. Conflitos de atividade, NEs duplicadas e divergências com vínculo manual permanecem pendentes. Não há vínculo automático de plano histórico por semelhança textual.

## Operação e validação

```powershell
supabase db push
supabase migration list
supabase functions deploy sync-suap-rds
node scripts/test-suap-rd-db.mjs
npm test -- src/services/__tests__/suapRdParser.test.ts src/services/__tests__/suapRdSync.test.ts src/utils/__tests__/suapRdMatching.test.ts src/components/suap/SuapRd.test.tsx
```

O teste SQL usa PostgreSQL/WASM descartável; instale `@electric-sql/pglite` em `.codex-temp/rd-sql` (ou configure `RD_SQL_RUNTIME`). Nunca escreve no remoto. Cobre RLS, escrita negada, aplicação idempotente, captura parcial, unidades com UASG compartilhada, conflitos e reversão, sem alteração de saldos locais.

Na entrega inicial, a migration foi aplicada, seu histórico remoto conferido e a function publicada. O endpoint retornou 401 sem autenticação. Nenhuma RD real foi aplicada. A coleta pela extensão dispensa a conexão backend; exige atualizar/recarregar a extensão 1.9.55 e ter as sessões SIAGES e SUAP ativas. Mudanças da interface precisam de publicação do frontend para aparecer no site.

Validação inicial (05/10): regressões direcionadas da integração, lista/detalhes de empenhos e atividades aprovadas (55 testes), teste SQL descartável aprovado e build com fallbacks SPA aprovado. A suíte geral também foi executada: um teste de `ManutencaoAdmin` continua falhando em um fluxo não alterado por esta integração; `npm run check` é interrompido pelo erro de lint existente em `src/utils/nfeChave.ts:57`. O compilador TypeScript geral tem erros legados; não apontou erros nos novos módulos de RDs. Os executáveis da pasta `.bin` apresentaram falha de metadados Bun; build/testes/lint direcionados foram executados diretamente com Node nos mesmos entrypoints das ferramentas.

Validação da extensão (06/10): 53 testes focados aprovados, incluindo botões individuais/em lote, 44 unidades, origem das mensagens, pausa/retomada e reconciliação da aplicação quando a resposta se perde. Suíte geral: 1.288 testes aprovados e somente a falha preexistente de `ManutencaoAdmin`; a execução com dois workers eliminou o timeout transitório de Pesquisa de Preços. Teste SQL e build com 54 fallbacks SPA aprovados; lint direcionado sem erros. `npm run check` e TypeScript do app continuam com problemas legados, sem erro de TypeScript nos módulos RD verificados. ZIP 1.9.55 comparado por SHA-256: 30 arquivos idênticos à pasta corrente, incluindo os ajustes locais preexistentes da extensão. Function atualizada publicada no projeto vinculado, histórico das migrations alinhado e catálogo protegido com 401 sem autenticação. Nenhuma RD real aplicada neste trabalho.
