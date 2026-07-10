# Planejamento da Fase 4 — Almoxarifado, Patrimônio, Frota e Obras

## Objetivo

Construir quatro módulos operacionais reaproveitáveis a partir dos ativos de Compras, Contratos, Empenhos e Manutenção. O plano cobre os 70 requisitos dos itens 19.6 a 19.9 do Termo de Referência sem acoplar o produto a um município.

Esta fase não deve recriar tenant, permissões, auditoria, workflow, documentos ou relatórios que pertençam às Fases 1 a 3.

## Decisões de arquitetura

1. **Almoxarifado vem primeiro:** o recebimento de compras cria estoque; bens duráveis seguem para tombamento.
2. **Patrimônio vem depois:** veículos são ativos patrimoniais especializados, então Frota referencia um bem em vez de duplicá-lo.
3. **Frota reutiliza padrões de Manutenção, não suas tabelas:** o módulo atual é orientado a ambientes e possui permissões públicas incompatíveis com veículos, condutores e despesas.
4. **Obras vem por último:** depende de Planejamento, Contratos, responsáveis técnicos, documentos e medições.
5. **Movimentos são imutáveis:** saldos e estados são derivados de eventos; correções ocorrem por estorno ou movimento compensatório.
6. **Contabilidade por eventos:** antes da Fase 5, incorporações, baixas, depreciações e consumo geram eventos pendentes em uma outbox.
7. **Anexos são privados e compartilhados:** um serviço documental comum guarda versão e metadados.
8. **Relatórios são transversais:** filtros salvos, exportação, agendamento, e-mail e chave de autenticidade são implementados uma vez.

## Dependências das Fases 1 a 3

Antes do desenvolvimento, classificar cada dependência como pronta, parcial ou ausente:

| Capacidade | Uso | Gate mínimo |
|---|---|---|
| Tenant, entidade e unidade | Isolamento de todos os registros | RLS testada entre dois tenants |
| Organograma, centros de custo e locais | Estoque, guarda, frota e obras | IDs estáveis como vínculo |
| Catálogo e unidades de medida | Compras e estoque | Mesmo item entre requisição, ordem e recebimento |
| Fornecedores | Entradas, combustível, manutenção e obras | Cadastro único |
| Ordens de fornecimento/serviço | Recebimento e frota | Entregas parciais e saldo por item |
| Empenhos e contratos | Nexo causal | Seleção por ID; número só para exibição |
| RBAC e auditoria | Segregação de funções | Permissão por módulo e ação |
| Workflow e notificações | Aprovações e pendências | Histórico imutável |
| Documentos | Termos, laudos, seguros e medições | Anexo privado e versionado |
| Motor de relatórios | Requisito comum | PDF/XLSX e chave verificável |

Dependência ausente entra na Etapa 4.0. Não será criada uma versão local em cada módulo.

## Modelo compartilhado proposto

Mapa de domínio, não migration pronta:

- cadastros: organizational_units, cost_centers, physical_locations, catalog_items, measurement_units e suppliers;
- infraestrutura: entity_documents, domain_events_outbox, report_definitions, report_saved_filters, report_runs e audit_events;
- todas as tabelas operacionais levam tenant_id e entity_id;
- valores e quantidades usam numeric;
- FKs validam o mesmo tenant da entidade pai;
- não há exclusão física após o primeiro movimento;
- alterações de saldo são transacionais e idempotentes;
- números de empenho, contrato e ordem não são redigitados quando já existem.

## Etapa 4.0 — Fundação operacional

**Prazo:** 2–4 semanas.

### Entregas

- gap assessment das Fases 1 a 3;
- centros de custo, localizações e unidades compartilhadas;
- catálogo classificado em consumo, permanente e serviço;
- recebimento parcial de ordem de fornecimento/serviço;
- documentos genéricos, outbox e base de relatórios;
- perfis de solicitante, almoxarife, patrimônio, frota, fiscal de obra, aprovador e auditor.

### Gate

Uma ordem aprovada deve ser recebida parcialmente, preservar saldo, registrar autor/data e emitir evento sem duplicidade.

## Etapa 4.1 — Almoxarifado

**Prazo:** 6–9 semanas. **Prioridade:** 1.

### Escopo

- múltiplos almoxarifados, depósitos e endereçamento;
- entrada por ordem de fornecimento ou nota fiscal;
- saída, transferência, devolução, ajuste e estorno;
- requisição com aprovação, atendimento parcial e pendências;
- consumo por centro de custo;
- estoque mínimo, reposição e sugestão de compra;
- últimas aquisições e custo médio;
- bloqueio por depósito/item;
- inventário rotativo/anual;
- resumo anual e adaptador de prestação de contas.

### Dados

- warehouses e warehouse_locations;
- warehouse_items;
- stock_requests e stock_request_items;
- stock_movements e stock_movement_items;
- stock_receipts;
- stock_counts e stock_count_items;
- stock_balances como projeção derivada do razão.

### Regras críticas

- saldo nunca é editado diretamente;
- saída não gera saldo negativo sem política explícita;
- custo inicial por média ponderada móvel, com política versionada;
- recebimento não ultrapassa a ordem;
- item durável recebido cria candidato a tombamento, não patrimônio definitivo;
- consumo da Manutenção exige saída autorizada do estoque.

### Aceite

Cobrir os 16 requisitos do item 19.7; provar recebimento e requisição parciais, transferência, bloqueio e inventário; conciliar saldo inicial + entradas − saídas ± ajustes; testar concorrência de duas saídas.

## Etapa 4.2 — Patrimônio

**Prazo:** 8–12 semanas. **Prioridade:** 2.

### Escopo

- tombamento de móveis, imóveis e veículos;
- classificação hierárquica de pelo menos seis níveis;
- depreciação e valor residual herdáveis;
- vínculo ao recebimento e empenho;
- localização, responsável, conservação e ingresso;
- detalhes de veículos e imóveis;
- termos de guarda individuais/coletivos;
- transferência e baixa individual ou em lote;
- destinação, inventário, data de corte e reavaliação;
- documentos de propriedade, seguro e manutenção.

### Dados

- asset_classes e assets;
- asset_vehicle_details e asset_real_estate_details;
- asset_custodies e asset_custody_terms;
- asset_movements;
- asset_depreciation_policies e asset_depreciation_runs;
- asset_inventories, asset_inventory_items e asset_disposals.

### Regras críticas

- empenho selecionado da base;
- número patrimonial único por tenant;
- árvore sem ciclos;
- transferência preserva histórico;
- baixa exige motivo, autoridade e documento;
- depreciação é reproduzível e versionada;
- integração contábil permanece pendente até homologação da Fase 5.

### Aceite

Cobrir os 18 requisitos do item 19.6; demonstrar tombamento por recebimento, termo coletivo, transferência em lote, inventário e baixa; impedir tombamento duplicado; gerar evento contábil conciliável.

## Etapa 4.3 — Frota

**Prazo:** 8–12 semanas. **Prioridade:** 3.

### Escopo

- veículo vinculado ao patrimônio;
- condutores, CNH, categoria, validade e autorizações;
- reservas, saídas, retornos e viagens;
- hodômetro/horímetro e troca formal de marcador;
- abastecimentos vinculados a centro de custo, fornecedor e empenho;
- manutenção preventiva/corretiva originada de OS;
- revisões, óleo, multas, IPVA, licenciamento e seguros;
- ocorrências, fotos, documentos e alertas;
- custos por veículo, km e centro de custo.

### Dados

- fleet_vehicles;
- fleet_drivers e fleet_driver_vehicle_authorizations;
- fleet_reservations e fleet_trips;
- fleet_meter_events;
- fleet_fuel_authorizations e fleet_fuel_transactions;
- fleet_maintenance_plans, fleet_work_orders e fleet_work_order_items;
- fleet_fines, fleet_licenses, fleet_insurance_policies e fleet_incidents.

### Reuso de Manutenção

Reutilizar componentes de anexos, fotos, status, timeline e filtros. Não usar diretamente manutencao_ambientes, manutencao_ocorrencias nem suas policies públicas. Uma futura unificação ocorrerá em um núcleo genérico de ordens de serviço.

### Regras críticas

- veículo operacional exige patrimônio ativo;
- viagem exige CNH válida e categoria compatível;
- reservas conflitantes são impedidas no banco;
- hodômetro não retrocede sem troca formal;
- abastecimento exige origem orçamentária;
- itens de manutenção são herdados da OS homologada;
- quantidade executada não supera a OS.

### Aceite

Cobrir os 21 requisitos do item 19.8; demonstrar reserva → saída → abastecimento → retorno e manutenção por OS; bloquear CNH vencida, conflito de reserva e hodômetro inválido.

## Etapa 4.4 — Obras Públicas

**Prazo:** 7–10 semanas. **Prioridade:** 4.

### Escopo

- obra vinculada à LOA, processo, contrato e aditivos;
- categoria, localização e georreferência;
- responsáveis técnicos e CREA/CAU;
- cronograma físico-financeiro;
- início, paralisação, reinício, cancelamento e conclusão;
- medições por contrato/aditivo;
- atestos, documentos, fotos e diário;
- alvará e habite-se;
- painel físico-financeiro e transparência;
- conectores regulatórios versionados.

### Dados

- public_works;
- work_categories, technical_responsibles e work_responsibilities;
- work_budget_actions e work_contracts;
- work_schedules e work_schedule_items;
- work_measurements e work_measurement_items;
- work_events, work_permits e work_regulatory_exports.

### Regras críticas

- ação orçamentária e contrato são importados;
- medição aprovada é corrigida por revisão/estorno;
- medições não superam contrato e aditivos;
- percentual físico fica entre 0% e 100%;
- reinício exige paralisação aberta;
- conclusão exige pendências resolvidas ou justificativa aprovada;
- dados pessoais não aparecem na transparência.

### Sisobra

O SisobraPref legado foi desativado e substituído pelo Sisobrapref Web. Antes do conector, confirmar com o órgão o layout/canal exigido e se também haverá Obrasgov/SISRO. A integração será desacoplada e versionada.

### Aceite

Cobrir os 15 requisitos do item 19.9; demonstrar obra originada de LOA/contrato, paralisação/reinício, medição e conclusão; conciliar contrato + aditivos − medições; homologar alvará/habite-se e exportação.

## Cronograma e esforço

Equipe de referência: 1 líder técnico, 2 full-stack, 1 analista/especialista e QA compartilhado.

| Marco | Duração | Esforço ROM |
|---|---:|---:|
| Fundação operacional | 2–4 semanas | 4–7 pessoa-mês |
| Almoxarifado | 6–9 semanas | 7–11 pessoa-mês |
| Patrimônio | 8–12 semanas | 9–14 pessoa-mês |
| Frota | 8–12 semanas | 9–14 pessoa-mês |
| Obras | 7–10 semanas | 8–12 pessoa-mês |
| Homologação integrada | 3–5 semanas | 4–7 pessoa-mês |
| **Total sequencial** | **34–52 semanas** | **41–65 pessoa-mês** |

Depois da estabilização do Almoxarifado, Frota e Obras podem avançar parcialmente em paralelo. Prazo realista: **7–10 meses**. A estimativa anterior de 4–7 meses exige redução de escopo ou módulos de mercado.

## Custo/benefício

| Módulo | Reuso | Complexidade | Decisão |
|---|---|---|---|
| Almoxarifado | Muito alto | Média | Primeiro; fecha Compras |
| Patrimônio | Muito alto | Média/alta | Segundo; base para Frota |
| Frota | Alto | Média/alta | Vendável separadamente |
| Obras | Médio/alto | Alta | Após piloto real |

O melhor pacote comercial inicial é Compras + Almoxarifado + Patrimônio. Frota entra como adicional. Obras só deve ser vendido após piloto com medições e integração regulatória reais.

## Migração

Pipeline obrigatório: recebido → mapeado → validado → simulado → aprovado → aplicado → reconciliado.

Nenhuma carga entra diretamente nas tabelas finais. Cada lote produz rejeições, totais de controle e rollback antes de movimentos posteriores.

## Testes

### Unitários

- custo médio, saldo, reposição e conversão;
- depreciação, residual e hierarquia;
- reserva, consumo, hodômetro e custo por km;
- saldo contratual, percentual físico e eventos de obra.

### Integração/banco

- concorrência e idempotência;
- recebimento → estoque → candidato a tombamento;
- patrimônio → frota sem duplicação;
- OS → manutenção sem editar itens homologados;
- contrato/aditivo → medição → saldo;
- RLS entre tenants;
- outbox e reprocessamento.

### Interface

Usar HeaderActions, StatCard, FilterPanel, DataTablePanel e TablePagination; drawers para detalhes/timelines; estados de bloqueio e aprovação; responsividade, acessibilidade e roteiro automatizado de POC.

## Gates de conclusão

1. Todos os requisitos possuem status e evidência.
2. Regras críticas estão no banco, não apenas no frontend.
3. RLS foi testada com dois tenants e perfis distintos.
4. Migração piloto foi reconciliada.
5. Relatórios têm chave e rastreabilidade.
6. Operações críticas têm testes de concorrência/idempotência.
7. Documentação de schema, catálogo, linhagem, frontend e testes está atualizada.
8. No trabalho de implementação, migrations são aplicadas no Supabase vinculado e validadas com supabase migration list.

## Próximos passos

1. Inventariar as dependências reais das Fases 1 a 3.
2. Fechar catálogo único e Ordem de Fornecimento/Serviço.
3. Validar método de custo e eventos patrimoniais com contador público.
4. Validar fluxos com almoxarife, patrimônio, frota e engenharia.
5. Criar matriz detalhada dos 70 requisitos.
6. Escolher piloto e obter amostras dos legados.
7. Iniciar a Etapa 4.0; não abrir quatro frentes de UI antes dos cadastros e eventos comuns.

## Fontes

- Termo de Referência do Pregão 16/2026, itens 19.6 a 19.9.
- Código, migrations e documentação operacional deste repositório.
- [Receita Federal — SisobraPref/Sisobrapref Web](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/declaracoes-e-demonstrativos/sisobrapref-sistema-de-cadastro-de-obra-modulo-prefeitura/): sistema legado desativado e operação atual pelo módulo web.

## Progresso de implementação

- 2026-07-06: iniciado o incremento 4.0/4.1 com entidade operacional, cadastros mestres, catálogo, depósito, razão imutável, RPC transacional e primeira tela de Almoxarifado.
- Próximo corte: recebimento por Ordem de Fornecimento, requisição interna, mínimo/reposição e inventário.
