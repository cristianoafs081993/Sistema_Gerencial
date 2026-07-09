# Almoxarifado

## Escopo atual

O primeiro incremento da Fase 4 cria a fundação operacional e um MVP de estoque:

- entidade operacional e vínculo de usuários;
- unidades organizacionais, centros de custo e localizações físicas;
- unidades de medida e catálogo compartilhado;
- depósitos e configuração de item por depósito;
- razão imutável de entradas, saídas, transferências, ajustes e devoluções;
- saldo e valor derivados dos movimentos;
- RPC transacional e idempotente para postagem;
- bloqueio de saldo negativo e de itens configurados como bloqueados;
- tela `/almoxarifado` para catálogo, saldos e movimentações.

## Fluxo

`App.tsx` → `Almoxarifado.tsx` → `inventory.ts` → tabelas operacionais / `post_stock_movement` → `stock_balances`

## Regras críticas

- saldos não são editados diretamente;
- movimentos repetidos usam chave de idempotência;
- saídas e transferências usam o custo médio atual do depósito de origem;
- um serviço não pode ser movimentado como estoque;
- origem e destino pertencem à mesma entidade do movimento;
- transferências exigem depósitos diferentes;
- RLS exige vínculo em `operational_entity_memberships`;
- gestão de cadastros exige `admin` ou `warehouse_manager`; operadores podem movimentar e auditores somente ler.

## Estado da Fase 4

Este incremento cobre a fundação e o núcleo de movimentação. Permanecem no backlog do Almoxarifado:

- recebimento nativo de Ordem de Fornecimento e nota fiscal;
- requisições internas e atendimento parcial;
- inventário físico;
- mínimo/reposição configurável pela interface;
- estorno formal de movimentos;
- migração assistida;
- relatórios, TCE e candidato automático a tombamento.

## Testes

- regras puras: `src/utils/__tests__/inventory.test.ts`;
- a migration deve ser validada no Supabase remoto vinculado;
- testes de concorrência, RLS e idempotência devem ser adicionados na próxima etapa de integração de banco.
