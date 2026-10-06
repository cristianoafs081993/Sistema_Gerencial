# Integração de RDs, atividades e empenhos

Implementação de 05/10/2026. Complementa a investigação em [SUAP_RD_ATIVIDADES_EMPENHOS](../planning/SUAP_RD_ATIVIDADES_EMPENHOS.md).

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

O coletor usa blocos de até seis etapas com limite de tempo entre etapas, timeout de leitura, retentativas limitadas e lease de 120 segundos. A paginação começa em 1, preserva a unidade e rejeita duplicatas ou mudanças de contagem. Cada etapa falha sem avançar seu cursor. O inventário é relido no final e comparado por RD/número/tipo/situação. **Essa conferência não é uma transação do SUAP:** mudanças apenas de valores durante a coleta podem exigir nova captura; as linhas registram o horário de sua leitura.

Capturas incompletas, falhas de sessão ou de parsing não substituem a projeção ativa. A retomada reutiliza cursores e snapshots. Se o inventário mudar, descarte a conferência e inicie outra. Ausências só desativam RDs anteriores depois de uma captura completa da mesma unidade.

`apply_suap_rd_snapshot` aplica todas as RDs da execução em uma transação e é idempotente. `revert_suap_rd_snapshot` restaura a execução aplicada anterior da unidade (ou desativa a primeira captura), preservando os snapshots e impedindo a reversão de uma aplicação sobreposta por outra mais recente.

## API, autorização e sessão

`POST /functions/v1/sync-suap-rds`, ações `sync`, `status`, `apply`, `discard` e `revert`. Parâmetros: `suapUnitCode`, `campusUasg`, `runId` opcional. `status` retorna a última execução do usuário e unidade; `sync` continua uma captura ou cria outra depois de uma aplicação/descarte/reversão. Prévia pronta exige `apply` explícito.

A function usa `verify_jwt=false` na configuração e valida internamente JWT do SIAGES, usuário real, órgão e `is_superadmin_jwt`. Somente o superadmin coleta/aplica/reverte. Não recebe URLs arbitrárias nem sessão no corpo: reutiliza a conexão válida e cifrada de `sync-suap-plan`. Segredos usados: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e, se já configurado, `SUAP_SESSION_ENCRYPTION_KEY`, com o mesmo formato AES-GCM do planejamento. Não há variável nova de frontend.

`status` também retorna `appliedRun`, a última execução ainda aplicada do usuário/unidade, para manter a reversão acessível mesmo quando uma nova conferência falhar ou for descartada.

Conecte o SUAP pelo cartão de planejamento em Importação de dados. A sessão aberta no Chrome não estabelece automaticamente essa conexão no backend. Expiração solicita reconexão sem aplicar uma captura parcial.

Tabelas têm RLS por órgão/campus. Usuários autenticados leem; escrita e RPCs de aplicação/reversão são restritas a `service_role`. As views usam `security_invoker`. O cliente acrescenta filtros de órgão, campus e unidade, pagina os resultados e nunca usa fallback anônimo para RDs.

## Interface e valores

Em Importação de dados, o cartão de RDs permite escolher a unidade dentro da UASG ativa, coletar, pausar, retomar, conferir, aplicar, descartar e reverter. A prévia mostra as RDs e suas linhas em páginas de 20, totais por tipo e contagens de atividade/NE ausente, NE ambígua e conflito manual. As contagens de pendências locais são por linha confirmada.

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

Na entrega inicial, a migration foi aplicada, seu histórico remoto conferido e a function publicada. O endpoint retornou 401 sem autenticação. Nenhuma RD real foi aplicada: a consulta operacional encontrou zero conexões SUAP válidas. A primeira captura permanece dependente da conexão SUAP e da conferência da prévia. As alterações da interface estão no código local e requerem publicação do frontend para aparecer no site.

Validação: regressões direcionadas da integração, lista/detalhes de empenhos e atividades aprovadas (55 testes), teste SQL descartável aprovado e build com fallbacks SPA aprovado. A suíte geral também foi executada: um teste de `ManutencaoAdmin` continua falhando em um fluxo não alterado por esta integração; `npm run check` é interrompido pelo erro de lint existente em `src/utils/nfeChave.ts:57`. O compilador TypeScript geral tem erros legados; não apontou erros nos novos módulos de RDs. Os executáveis da pasta `.bin` apresentaram falha de metadados Bun; build/testes/lint direcionados foram executados diretamente com Node nos mesmos entrypoints das ferramentas.
