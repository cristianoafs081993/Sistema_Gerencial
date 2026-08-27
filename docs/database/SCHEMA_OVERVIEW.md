# SCHEMA_OVERVIEW

## Aviso importante

Este documento e um mapa operacional do schema, nao um dicionario exaustivo de colunas.
Para mudancas sensiveis, confirme sempre nas migrations em [supabase/migrations](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/migrations).

## Multi-Org (Multi-Tenant) — migration 20260712000000 / 20260712010000

O sistema suporta múltiplos órgãos (tenants) completamente isolados. Cada usuário pertence a exatamente **um** órgão.

### Tabelas de controle de acesso

| Tabela | Descrição |
|--------|-----------|
| `orgs` | Cadastro de órgãos/tenants (slug, name, cnpj, is_active) |
| `org_users` | Vínculo 1:1 usuário ↔ órgão (`UNIQUE user_id`). Campo `role` = admin/member |
| `org_module_permissions` | Quais telas (screen_id) cada órgão pode acessar. Controlado pelo superadmin |
| `audit_log` | Trilha de auditoria (login, logout, ações admin). Requisito legal — inciso V |

### Função RLS de isolamento

```sql
public.current_user_org_id() → uuid
```
Retorna o `org_id` do usuário autenticado. Usada em **todas** as policies de isolamento de dados — o frontend não precisa passar `org_id` nas queries; o banco filtra automaticamente.

A migration `20260716103000` adiciona `public.default_org_id()` como default de `org_id` nas tabelas transacionais multi-org. Inserts feitos por usuarios autenticados usam o orgao do usuario; jobs com service role sem `auth.uid()`, como a ingestao automatica de CSV por e-mail, caem para o orgao legado `ifrn-cn`.

### Tabelas com isolamento por org_id (RLS automático)

`atividades`, `empenhos`, `descentralizacoes`, `descentralizacoes_conta_saldos`,
`creditos_disponiveis`, `creditos_disponiveis_detalhes`, `rap_historico_anual`,
`documentos_habeis`, `retencoes`, `pf_solicitacao`, `pf_aprovacao`, `pf_liberacao`,
`contratos`, `requisicoes_compra`, `financeiro_fonte_vinculacao`, `lc_credores`,
`retencoes_efd_reinf`, `energia_import_runs`, `energia_consumo_faturas`,
`energia_solar_geracao`, `energia_contratos`, `energia_contrato_execucoes`,
`price_researches`, `suppliers`, `supplier_certificates`

`process_mappings` tambem e isolada por `org_id`; somente mapas publicados sao consumidos pela extensao, enquanto a escrita e a publicacao ficam restritas ao administrador do orgao ou superadmin.

`lc_saved_lists` tambem e isolada por `org_id`; as listas de trabalho da Lista de Credores ficam disponiveis para todos os usuarios autenticados do mesmo orgao.

### Tabelas globais/compartilhadas (sem org_id)

`contratos_api*`, `licitacoes_pncp*`, `atas_registro_precos*`, `price_research_ead_videos`, `normativos*`,
`document_templates`, `dimensoes`, `componentes_funcionais`, `naturezas_despesa`,
`origens_recurso`

---

## Grupos principais

### Orcamento e execucao

- `atividades`
- `empenhos`
- `descentralizacoes`
- `creditos_disponiveis`
- `creditos_disponiveis_detalhes`

### Dominios auxiliares

- `dimensoes`
- `componentes_funcionais`
- `naturezas_despesa`
- `origens_recurso`

### Documentos e pagamentos

- `documentos_habeis`
- `documentos_habeis_itens`
- `documentos_habeis_situacoes`
- `document_templates`
- `licitacao_document_artifacts`
- `liquidacoes`
- `liquidacoes_empenhos`

### PFs

- `pf_fonte_recurso`
- `pf_solicitacao`
- `pf_aprovacao`
- `pf_liberacao`

### Contratos

- `contratos`
- `contratos_empenhos`
- `contratos_api`

- `contratos_api_historico`
- `contratos_api_empenhos`
- `contratos_api_faturas`
- `contratos_api_itens`
- `contratos_api_fatura_itens`
- `contratos_api_fatura_empenhos`
- `contratos_api_empenho_liquidacoes_cache_status`
- `contratos_api_empenho_liquidacoes_cache`
- `contratos_api_documentos`
- `contratos_api_sync_runs`
- `requisicoes_compra`
- `requisicao_compra_empenhos` (relacao N:N entre requisicao e NEs selecionadas)
- `requisicao_compra_itens` (inclui origem opcional do item da NE e `empenho_id` para validacao do saldo por subitem e por NE)
- `terceirizados`
- `terceirizado_permissions`

### Licitacoes, pregoes PNCP e ARP

- `licitacoes_pncp`
- `atas_registro_precos`
- `atas_registro_precos_itens`
- `atas_registro_precos_unidades`
- `atas_registro_precos_adesoes`
- `atas_registro_precos_sync_runs`
- view `atas_registro_precos_resumo`
- `price_researches`
- `price_research_items`
- `price_research_ead_videos`
- `price_research_suppliers`
- `price_research_email_dispatches`

### Processos SUAP

- `process_mappings` armazena definicoes BPMN versionadas em `definition` (JSONB), com status `draft`, `published` ou `archived`; o visualizador completo e a extensao consomem apenas a versao publicada.
- `processos` preserva os dados extraídos e o histórico de cada processo.
- `suap_caixas` contém as caixas cadastradas pelo usuário.
- `suap_processo_caixas` mantém os vínculos ativos processo–caixa; a UI do SUAP exibe apenas processos com pelo menos um vínculo. Inventários de caixas lidas com sucesso removem somente os vínculos ausentes, sem apagar processos ou PDFs.
### Importacoes auxiliares

- `financeiro_fonte_vinculacao`
- `lc_credores`
- `lc_saved_lists`
- `retencoes_efd_reinf`
- `email_csv_ingestion_runs`

### Energia Campus

- `energia_import_runs`
- `energia_consumo_faturas`
- `energia_solar_geracao`
- `energia_contratos`
- `energia_contrato_execucoes`

### Limpeza e Manutenção

- `manutencao_ambientes`
- `manutencao_ocorrencias`
- `manutencao_checkins`
- `manutencao_blocos_mapa`
- Storage privado `manutencao-ocorrencias` para fotos opcionais vinculadas por `manutencao_ocorrencias.foto_path`

### Automacoes e economia de tempo

- `automation_savings_scenarios`
- `automation_savings_events`

### Base semantica do Consultor

- `normativos`
- `normativos_chunks`
- `normativos_log`
- RPC `buscar_normativos`

Observacao: esses objetos sao criados pelo SQL embutido em [normativos-pipeline/pipeline/ingest.py](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/normativos-pipeline/pipeline/ingest.py), nao pelas migrations principais inspecionadas nesta rodada. O fluxo e o backlog ficam em [NORMATIVOS_CONSULTOR_INGESTION.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/integrations/NORMATIVOS_CONSULTOR_INGESTION.md).

### Autorizacao de telas

- `screen_groups`
- `app_screens`
- `user_groups`
- `user_group_screen_permissions`
- `user_group_memberships`

### Preferencias de usuario

- `user_favorites`

## Views identificadas nas migrations

- `vw_conciliacao_documento_pf`
- `vw_conciliacao_diaria_pf`
- `vw_controle_pfs_pendentes`
- `vw_documentos_pendentes_pagamento`

## Views consumidas no frontend que exigem confirmacao

- `vw_rastreabilidade_pf`

Esta view aparece no frontend em [rastreabilidadePFs.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/rastreabilidadePFs.ts), mas nao foi localizada nas migrations inspecionadas nesta rodada.

## Functions identificadas no repo

- `analisar-liquidacao-siafi`
- `gerar-contrato-licitacao`
- `gerar-mapa-riscos-licitacao`
- `gerar-termo-referencia-compras`
- `record-automation-savings-event`
- `refresh-comprasnet-liquidacoes-cache`
- `sync-atas-registro-precos`
- `sync-licitacoes-pncp`
- `pesquisar-precos`

## Functions invocadas no frontend que exigem confirmacao

- `verificar-conformidade`

Esta function aparece em [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx), mas nao foi localizada em `supabase/functions` nesta rodada.

## Revisoes de documentos SUAP

A migration `20260812100000_create_suap_document_reviews.sql` cria `suap_document_reviews`, que guarda o resultado JSONB, metadados do documento, processo, tipo e data da ultima analise. A RLS permite leitura e insercao somente pelo usuario autenticado que criou o registro.
