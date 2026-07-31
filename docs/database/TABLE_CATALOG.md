# TABLE_CATALOG

Este catalogo resume as tabelas e views mais relevantes para manutencao. Nao substitui as migrations.

## Orcamento e execucao

### `atividades`

Finalidade:

- planejamento orcamentario base

Campos-chave:

- `id`
- `dimensao`
- `componente_funcional`
- `tipo_atividade`
- `atividade`
- `descricao`
- `valor_total`
- `origem_recurso`
- `natureza_despesa`
- `plano_interno`
- FKs auxiliares `*_id`

Observacoes operacionais:

- `componente_funcional` deve permanecer sem prefixo numerico inicial, por exemplo `Contratos` em vez de `11 - Contratos`
- para a dimensao `EN`, `atividade` deve armazenar apenas o nome final da atividade, sem prefixos como `44 - COMPONENTE FUNCIONAL (PROEN):` e sem repetir o componente antes do nome
- `tipo_atividade` define a aba da tela de planejamento entre `campus`, `sistemico` e `emendas-parlamentares`
- no backfill atual, registros da dimensao `EN` foram classificados como `sistemico`; os demais ficaram em `campus`

Consumido por:

- [atividades.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/atividades.ts)
- [DataContext.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/contexts/DataContext.tsx)

### `empenhos`

Finalidade:

- empenhos do exercicio e RAP

Campos-chave:

- `id`
- `numero`
- `descricao`
- `valor`
- `status`
- `tipo`
- `plano_interno`
- `origem_recurso`
- `natureza_despesa`
- campos oficiais de liquidacao e pagamento

Observacoes operacionais:

- `componente_funcional` deve permanecer sem prefixo numerico inicial, seguindo o catalogo normalizado de `componentes_funcionais`
- uploads/reprocessamentos SIAFI via frontend criam e atualizam registros em `empenhos`; a RLS deve permitir escrita apenas para o superadministrador autenticado ou papel `superadmin`

Consumido por:

- [empenhos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/empenhos.ts)
- [Dashboard.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Dashboard.tsx)
- [Empenhos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Empenhos.tsx)

### `rap_historico_anual`

Finalidade:

- historico anual agregado de restos a pagar por UG e item de informacao

Campos-chave:

- `ug_executora`
- `ug_nome`
- `ano`
- `metrica`
- `item_informacao_codigo`
- `item_informacao_nome`
- `valor`
- `import_batch_id`
- `source_file`
- `imported_at`

Observacoes operacionais:

- a tabela e alimentada pela importacao do painel `Evolucao anual dos restos a pagar` na aba RAP do dashboard
- cada upload cria um novo lote e a UI le somente o `import_batch_id` mais recente
- o historico agregado nao substitui os campos operacionais de RAP em `empenhos`
- leitura e liberada para usuarios autenticados; insert fica restrito ao superadministrador por RLS

Consumido por:

- [rapHistoricoAnual.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/rapHistoricoAnual.ts)
- [DashboardRapAnnualEvolutionPanel.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/dashboard/DashboardRapAnnualEvolutionPanel.tsx)

### `descentralizacoes`

Finalidade:

- controle de descentralizacoes e devolucoes

Campos-chave:

- `id`
- `dimensao`
- `nota_credito`
- `operacao_tipo`
- `origem_recurso`
- `natureza_despesa`
- `plano_interno`
- `data_emissao`
- `valor`

Consumido por:

- [descentralizacoes.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/descentralizacoes.ts)
- [Descentralizacoes.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Descentralizacoes.tsx)

Observacoes operacionais:

- reimportacoes com NC devem reconciliar registros legados sem `nota_credito` pela chave `data_emissao`, `plano_interno`, `origem_recurso`, `natureza_despesa` e `valor`, evitando duplicar a mesma descentralizacao

### `descentralizacoes_conta_saldos`

Finalidade:

- saldos agregados por `ptres` carregados do relatorio de conta de descentralizacoes

Campos-chave:

- `ptres`
- `metrica`
- `valor`
- `updated_at`

Observacoes operacionais:

- essa tabela nao substitui os lancamentos detalhados de `descentralizacoes`
- ela deve ser usada apenas para os somatorios geral, por `ptres` e por dimensao
- o agregado por dimensao no frontend reaproveita a distribuicao atual dos lancamentos detalhados do mesmo `ptres`

Consumido por:

- [descentralizacoesContaSaldos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/descentralizacoesContaSaldos.ts)
- [Descentralizacoes.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Descentralizacoes.tsx)
- [Dashboard.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Dashboard.tsx)

### `creditos_disponiveis`

Finalidade:

- saldo de credito disponivel por `ptres`

Campos-chave:

- `ptres`
- `metrica`
- `valor`
- `updated_at`

Consumido por:

- [creditosDisponiveis.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/creditosDisponiveis.ts)
- [transparencia.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/transparencia.ts)

Observacoes operacionais:

- permanece como agregado de compatibilidade por `ptres`
- o upload da pagina dedicada atualiza esse agregado na mesma operacao de importacao do snapshot detalhado

### `creditos_disponiveis_detalhes`

Finalidade:

- snapshots do relatorio de credito disponivel com detalhamento por PI

Campos-chave:

- `ptres`
- `plano_interno`
- `descricao`
- `metrica`
- `valor`
- `import_batch_id`
- `source_file`
- `imported_at`

Observacoes operacionais:

- cada upload cria um lote; a pagina mostra o lote com `imported_at` mais recente
- a granularidade desta tabela preserva as linhas do CSV, inclusive saldos zero

Consumido por:

- [creditosDisponiveisDetalhes.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/creditosDisponiveisDetalhes.ts)
- [CreditoDisponivel.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/CreditoDisponivel.tsx)

## Dominios auxiliares

### `dimensoes`

- dicionario de dimensoes institucionais

### `componentes_funcionais`

- componentes funcionais por dimensao

Observacoes operacionais:

- o campo `nome` deve ficar normalizado sem prefixo numerico inicial
- a dimensao `EN` continua com nomes textuais completos do catalogo institucional

### `naturezas_despesa`

- catalogo de natureza de despesa

### `origens_recurso`

- catalogo de origem de recurso

Consumidos por:

- [dominio.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/dominio.ts)

## Documentos habeis e pagamentos

### `documentos_habeis`

Finalidade:

- documento habil pai

Campos-chave:

- `id`
- `data_emissao`
- `processo`
- `estado`
- `favorecido_documento`
- `favorecido_nome`
- `valor_original`
- `valor_pago`
- `fonte_sof`
- `empenho_numero`

Consumido por:

- [transparencia.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/transparencia.ts)
- [LiquidacoesPagamentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/LiquidacoesPagamentos.tsx)

### `documentos_habeis_itens`

Finalidade:

- itens filhos do documento habil, como OB e NS

Campos-chave:

- `id`
- `documento_habil_id`
- `doc_tipo`
- `data_emissao`
- `valor`
- `observacao`

### `documentos_habeis_situacoes`

Finalidade:

- situacoes detalhadas, inclusive retencoes

Campos-chave:

- `id`
- `documento_habil_id`
- `situacao_codigo`
- `valor`
- `is_retencao`

Views relacionadas:

- `vw_documentos_pendentes_pagamento`

## Cache Comprasnet para liquidações no modal de empenho

### `contratos_api_empenho_liquidacoes_cache_status`

Finalidade:

- controla frescor do cache de liquidações por empenho consultado no Comprasnet

Campos-chave:

- `empenho_lookup_key`
- `empenho_numero`
- `status`: `found`, `not_found` ou `error`
- `rows_count`
- `fetched_at`
- `expires_at`

Observacoes operacionais:

- resultados encontrados vencem em 12 horas
- resultados `not_found` vencem em 1 hora
- a leitura publica usa policy curta `liq_cache_status_select_public`, mantida separada dos nomes longos originais para evitar truncamento de identificadores no Postgres
- a Edge Function `refresh-comprasnet-liquidacoes-cache` atualiza registros vencidos pelo cron horario

### `contratos_api_empenho_liquidacoes_cache`

Finalidade:

- indice materializado de faturas do Comprasnet vinculadas a empenhos para leitura rapida no modal de empenho

Campos-chave:

- `empenho_lookup_key`
- `empenho_numero`
- `empenho_numero_api`
- `unidade_contrato`
- `contrato_api_id`
- `contrato_numero`
- `fatura_id`
- `numero_instrumento_cobranca`
- valores, datas e processo da fatura
- `raw_data` preserva o payload da fatura/empenho e e usado para filtrar exibicao por campus via `raw_data.fatura.contratante`

Consumido por:

- [contratosApi.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/contratosApi.ts)
- [EmpenhoDialog.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/modals/EmpenhoDialog.tsx)

Observacoes operacionais:

- a leitura publica usa policy curta `liq_cache_rows_select_public`, aplicada depois da migration inicial para corrigir leitura vazia no REST anonimo

## PFs e conciliacao

### `pf_fonte_recurso`

- lookup de fontes de recurso de PF

### `pf_solicitacao`

- etapa inicial de solicitacao

### `pf_aprovacao`

- etapa de aprovacao

### `pf_liberacao`

- etapa de liberacao

Views identificadas:

- `vw_controle_pfs_pendentes`
- `vw_documentos_pendentes_pagamento`
- `vw_conciliacao_documento_pf`
- `vw_conciliacao_diaria_pf`
- `vw_rastreabilidade_pf` precisa de confirmacao no banco

Consumido por:

- [pfImportService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/pfImportService.ts)
- [rastreabilidadePFs.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/rastreabilidadePFs.ts)

## Contratos

### `contratos`

- modulo local de contratos

Campos-chave:

- `id`
- `numero`
- `contratada`
- `valor`
- `data_inicio`
- `data_termino`

Observacoes operacionais:

- o campo `contratada` deve guardar apenas a razao social limpa, sem concatenar CNPJ e sem o sufixo textual `Pessoa Juridica`
- o runtime atual do modulo local nao depende de uma coluna `cnpj` em `contratos`; se essa separacao for retomada no banco, a migration correspondente precisa estar aplicada antes da publicacao

### `contratos_empenhos`

- relacao N:N entre contrato local e empenho

### `contratos_api`

- espelho local da API externa de contratos
- a exibicao de ativos usa `situacao_derivada`, nao `situacao` retornada pela API
- campos derivados principais:
  - `situacao_derivada`
  - `vigencia_inicio_derivada`
  - `vigencia_fim_derivada`
  - `situacao_derivada_motivo`
  - `campus_scope_reason`
- `situacao_derivada_motivo` registra se a decisao veio de historico vigente, historico vencido sem renovacao, rescisao/cancelamento, fallback sem historico ou historico vencido com fatura recente (excecao para contratos ativos com faturas nos ultimos 120 dias)
- `campus_scope_reason` registra se o contrato entrou por UG do campus, evidencia operacional da Reitoria ou ficou fora do escopo

### `contratos_api_historico`

- historico de assinatura, aditivos, apostilamentos e rescisao de cada contrato vindo da API externa
- guarda valores originais da API, incluindo `valor_inicial`, `valor_global`, `novo_valor_global`, parcelas, retroativo e UGs do termo/origem
- contratos com `codigo_unidade_origem = 158155` indicam origem Reitoria e devem ser exibidos como tal na UI

### `contratos_api_empenhos`

- empenhos vinculados a cada contrato vindo da API externa
- `valor_empenhado` representa o empenhado original e nao deve ser substituido por base RAP
- `rp_inscrito` e `rp_a_pagar` ficam em colunas dedicadas; outros campos RAP da API (`rpaliquidar`, `rpliquidado`, `rppago`) permanecem em `raw_data`
- em RAP antigo, a UI usa `raw_data.rppago`/`raw_data.rpliquidado` para liquidado/pago de RAP e deriva saldo atual quando `rp_a_pagar` nao vier na resposta
- na lista de contratos, empenhos desta tabela aparecem como badges complementares quando ainda nao existem no vinculo local `contratos_empenhos`; se o mesmo numero existir localmente, a exibicao local prevalece. O saldo desses empenhos complementares tambem entra na coluna `Saldo dos empenhos`

### `contratos_api_faturas`

- faturas vinculadas a cada contrato vindo da API externa
- `raw_data.contratante` identifica a UG/campus da fatura quando a API informa esse campo; a UI usa essa informacao para exibir ao usuario apenas faturas do campus atual sem apagar faturas de outros campi da base sincronizada

### `contratos_api_itens`

- itens de cada contrato vindo da API externa
- guarda `api_item_id`, descricao principal em `catmatseritem_id`, complemento, quantidade, valores e historico do item

### `contratos_api_fatura_itens`

- vinculos entre faturas e itens, derivados de `dados_item_faturado`
- base para calcular execucao por item apenas quando a API informa `id_item_contrato`

### `contratos_api_fatura_empenhos`

- vinculos entre faturas e empenhos, derivados de `dados_empenho`
- usado como contexto no detalhe de faturas do contrato

### `contratos_api_sync_runs`

Consumido por:

- [contratos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/contratos.ts)
- [contratosApi.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/contratosApi.ts)

### `requisicoes_compra`

Finalidade:
- Armazenar o cabeçalho e estado de cada Requisição de Compra cadastrada por prestadores terceirizados.

Campos-chave:
- `id`
- `number`
- `status` ('draft', 'review', 'approved', 'rejected')
- `contrato_id` (FK para contratos)
- `empenho_id` (FK para empenhos; compatibilidade com a primeira NE selecionada)
- `created_by` (FK para auth.users)

Regras:
- `save_requisicao_compra` salva cabecalho, empenhos vinculados e itens na mesma transacao.
- Requisicoes em `review` ou `approved` exigem ao menos uma NE e exigem que cada item tenha `empenho_id`. O saldo e validado separadamente por NE; requisicoes em `review` da mesma NE entram como valor reservado. Para terceirizados, a RPC exige permissao explicita para cada `empenho_id`; permissao de contrato nao autoriza automaticamente as NEs vinculadas ao contrato.
- `fn_empenho_saldo_disponivel` calcula saldo de exercicio com dados SIAFI locais e prioriza `saldo_rap_oficial` para RAP.

### `requisicao_compra_empenhos`

Finalidade:
- Armazenar a relacao N:N entre uma Requisicao de Compra e as NEs selecionadas.

Campos-chave:
- `id`
- `requisicao_compra_id` (FK para requisicoes_compra)
- `empenho_id` (FK para empenhos)
- `empenho_numero`
- `sort_order`

Regras:
- O par `requisicao_compra_id` + `empenho_id` e unico.
- `sort_order` preserva a ordem da selecao no frontend; a primeira NE tambem preenche `requisicoes_compra.empenho_id/empenho_numero` para compatibilidade com leituras legadas.
- A RLS segue o mesmo escopo de leitura/escrita de `requisicoes_compra`: criador, gestor/fiscal/superadmin, ou terceirizado com permissao direta no empenho.

### `requisicao_compra_itens`

Finalidade:
- Armazenar os itens detalhados de cada Requisicao de Compra.

Campos-chave:
- `id`
- `requisicao_compra_id` (FK para requisicoes_compra)
- `description`
- `quantity`
- `unit`
- `unit_price`
- `empenho_id` (FK para empenhos)
- `empenho_numero`
- `source_type` (`manual`, `portal_transparencia_empenho_item` ou `contrato_api_item`)
- `source_item_key`
- `source_reference`
- `source_snapshot`

Regras:
- Cada item pertence a uma NE quando a requisicao vai para `review` ou `approved`; registros antigos sem `empenho_id` usam o empenho legado do cabecalho como fallback nas validacoes.
- Itens originados de empenho preservam a chave do subitem da NE para recalcular reservas por item e por NE em requisicoes em revisao.
- Itens manuais permanecem validos para empenhos sem subitens disponiveis no cache/API.
### `terceirizados`

Finalidade:
- Cadastrar e identificar o perfil/tipo de prestadores de serviços terceirizados (ex: Limpeza/Manutenção ou Refeitório).
- A chave operacional do terceirizado e a `matricula` do SUAP, nao o e-mail.

Campos-chave:
- `id`
- `user_id` (Opcional, FK para auth.users, sincronizado por trigger a partir da matricula SUAP)
- `name`
- `matricula` (unica, normalizada; usada para login SUAP e permissoes)
- `email` (legado/opcional, mantido apenas para compatibilidade)
- `tipo` ('limpeza_manutencao', 'refeitorio')

Consumido por:
- [requisicoesCompra.ts](file:///c:/Users/3128880/Desktop/Programação/Sistema_Gerencial/src/services/requisicoesCompra.ts)
- [CadastroTerceirizados.tsx](file:///c:/Users/3128880/Desktop/Programação/Sistema_Gerencial/src/pages/CadastroTerceirizados.tsx)
- [userAccess.ts](file:///c:/Users/3128880/Desktop/Programação/Sistema_Gerencial/src/services/userAccess.ts)

### `terceirizado_permissions`

Finalidade:
- Controlar o escopo de contratos e empenhos que cada terceirizado pode ver/utilizar nas suas requisições.
- O vinculo principal usa `user_matricula`; `user_email` permanece como fallback legado.
- A página `/cadastro-terceirizados`, dentro da edição do prestador, pode criar múltiplos vínculos de empenho em lote, mas cada empenho autorizado continua sendo persistido como uma linha individual nesta tabela.

Campos-chave:
- `id`
- `user_id` (ID do terceirizado)
- `user_matricula`
- `user_email` (legado/opcional)
- `contrato_id` (Opcional, FK para contratos)
- `empenho_id` (Opcional, FK para empenhos)

Consumido por:
- [requisicoesCompra.ts](file:///c:/Users/3128880/Desktop/Programação/Sistema_Gerencial/src/services/requisicoesCompra.ts)
- [CadastroTerceirizados.tsx](file:///c:/Users/3128880/Desktop/Programação/Sistema_Gerencial/src/pages/CadastroTerceirizados.tsx)
- [RequisicaoCompra.tsx](file:///c:/Users/3128880/Desktop/Programação/Sistema_Gerencial/src/pages/RequisicaoCompra.tsx)

## Importacoes auxiliares

### `price_researches`

Finalidade:

- cabeçalho e estado das pesquisas de preços conduzidas pelo usuário

Campos-chave:

- `id`
- `object_description`
- `responsible_name`
- `institution_name`
- `institution_unit`
- `institution_details`
- `institution_logo`
- `report_servers`
- `research_date`
- `search_filters`
- `calculation_method`
- `methodology_justification`
- `status`
- `created_by`

Observações operacionais:

- os métodos aceitos são `median`, `mean` e `minimum`
- `institution_logo` guarda data URL do logotipo para exportação local; `report_servers` guarda JSONB com nome, função, matrícula/SIAPE e e-mail dos servidores exibidos no relatório
- a RLS restringe a pesquisa ao proprietário, com acesso global para superadministrador
- `search_filters` guarda os filtros avancados usados na busca oficial e na curadoria local para restaurar pesquisas salvas
- o status pode ser `draft`, `review` ou `completed`

### `price_research_items`

Finalidade:

- snapshot dos itens importados e das referências oficiais consideradas no relatório

Campos-chave:

- `research_id`
- `local_id`
- `catalog_type`
- `catalog_code`
- `quantity`
- `unit`
- `target_capacity`
- `target_measure_unit`
- `candidates`

Observações operacionais:

- `candidates` preserva em JSONB preço original, preço comparável, fonte, compra, fornecedor, pontuação, seleção e justificativa de exclusão
- o snapshot evita que alterações futuras da API apaguem a memória de cálculo já salva
- a tabela filha herda o controle de acesso por vínculo com `price_researches`

Consumido por:

- `src/services/priceResearch.ts`
- `src/pages/PesquisaPrecos.tsx`

### `price_research_ead_videos`

Finalidade:

- catalogo global de aulas EAD do modulo Pesquisa de Precos, exibidas em `/pesquisa-precos/ead`

Campos-chave:

- `id`
- `title`
- `description`
- `youtube_url`
- `youtube_video_id`
- `sort_order`
- `is_active`
- `created_by`
- `created_by_email`

Observacoes operacionais:

- usuarios autenticados leem apenas aulas ativas; superadministradores leem todas e podem cadastrar, editar, ativar/desativar, ordenar e excluir
- a tabela guarda somente metadados e o ID do video; o frontend monta o iframe com `youtube-nocookie.com`
- nao ha uso de chave da API do YouTube

Consumido por:

- `src/services/priceResearchEad.ts`
- `src/pages/PriceResearchEad.tsx`

### `suppliers`

Finalidade:

- cadastro de fornecedores por órgão para cotação, envio de e-mails e mapa de regularidade

Campos-chave:

- `id`
- `org_id`
- `name`
- `document`
- `email`
- `phone`
- `contact_name`
- `notes`
- `city`
- `uf`
- `status_regularidade`

Consumido por:

- `src/services/priceResearchEmail.ts`
- `src/pages/CadastroFornecedores.tsx`

Observações operacionais:

- fornecedores são isolados por `org_id`; usuários de um órgão não veem fornecedores cadastrados por outro órgão
- a migration `20260712193000_scope_suppliers_by_org.sql` migra registros antigos para o órgão padrão `ifrn-cn` e troca a unicidade de `document` para o escopo `(org_id, document)`

### `supplier_certificates`

Finalidade:

- histórico de certidões e consultas de regularidade/idoneidade de fornecedores (TCU, CNJ, CEIS, CNEP, RFB, FGTS, CNDT, Falência)

Campos-chave:

- `id`
- `supplier_id`
- `tipo_certidao`
- `numero_certidao`
- `situacao`
- `data_emissao`
- `data_validade`
- `pdf_url`
- `detalhes_sancao`

Consumido por:

- `src/services/supplierCompliance.ts`
- `src/pages/CadastroFornecedores.tsx`

Observações operacionais:

- o acesso herda o escopo do fornecedor vinculado em `suppliers`

### `financeiro_fonte_vinculacao`

- saldo financeiro por fonte/vinculacao carregado por arquivo

### `lc_credores`

- base da lista de credores carregada por arquivo

### `retencoes_efd_reinf`

- base dedicada de auditoria FD-Reinf
- inclui `correcao_realizada` para retirar alertas ja tratados da lista de pendencias abertas sem apagar a inconsistencia original importada

### `email_csv_ingestion_runs`

- trilha operacional da ingestao automatica de anexos CSV vindos do Gmail
- guarda `message_id`, hash do anexo, pipeline detectado, status, volumetria e erro
- usada para idempotencia e auditoria da automacao por e-mail

### `document_templates`

Finalidade:

- catalogo versionado dos modelos DOCX usados pelos fluxos assistidos do editor

Campos-chave:

- `id`
- `code`
- `name`
- `version_label`
- `file_name`
- `mime_type`
- `template_base64`
- `template_text`
- `editable_blocks`
- `questionnaire_schema`
- `status`
- `created_by_email`
- `created_at`
- `updated_at`

Consumido por:

- [documentTemplates.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/documentTemplates.ts)
- [referenceTerms.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/referenceTerms.ts)
- [ModelosDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/ModelosDocumentos.tsx)
- [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx)

Observacoes operacionais:

- a versao atual do Termo de Referencia - Compras fica em `status = active`, com indice unico por `code`
- a tabela guarda o binario do DOCX em base64, o texto integral extraido do modelo, os blocos editaveis detectados localmente e o questionario revisavel do modelo
- `questionnaire_schema` armazena perguntas derivadas de clausulas `OU`, lacunas entre colchetes e trechos opcionais; o editor envia as respostas para a Edge Function antes da geracao final do Termo de Referencia
- leitura e liberada para `authenticated`; escrita fica restrita ao superadministrador por RLS
- `updated_at` e mantido por trigger `trg_update_document_templates_updated_at`

## Base semantica do Consultor

### `normativos`

- catalogo de documentos normativos ingeridos pelo pipeline local [normativos-pipeline](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/normativos-pipeline)
- guarda tipo, titulo, numero, ano, `url_origem`, vigencia, `data_ingestao`, `hash_conteudo` e metadados
- usada para deduplicacao por hash antes de gerar novos chunks

### `normativos_chunks`

- chunks textuais com embedding vetorial `vector(768)`
- cada chunk referencia `normativos.id`
- consultada pela RPC `buscar_normativos` por similaridade vetorial

### `normativos_log`

- trilha de execucao da pipeline de normativos
- guarda titulo, status, quantidade de chunks, mensagem e data da execucao
- deve ser consultada junto do backlog em [NORMATIVOS_CONSULTOR_INGESTION.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/integrations/NORMATIVOS_CONSULTOR_INGESTION.md)

### RPC `buscar_normativos`

- recebe `query_embedding vector(768)`
- aplica filtros opcionais por tipo e vigencia
- retorna trechos de `normativos_chunks` com metadados do normativo

## Autorizacao de telas

### `screen_groups` e `app_screens`

Finalidade:

- catalogo dos grupos de telas e das rotas protegidas pelo frontend

Observacoes operacionais:

- o catalogo deve ficar alinhado com `src/lib/appScreens.ts`
- `/auth` nao entra nesse catalogo porque e rota publica
- `/controle-usuarios`, `/design-system-preview` e `/modelos-documentos` ficam marcadas como telas administrativas

### `user_groups`

Finalidade:

- grupos de usuarios gerenciados pelo superadministrador

Observacoes operacionais:

- o seed inicial cria o grupo `Diretores`
- `Diretores` acessa as telas de producao e nao acessa `Controle de usuarios`

### `user_group_screen_permissions`

Finalidade:

- matriz de permissao entre grupos de usuarios e telas

Consumido por:

- `AuthContext` no frontend, via leitura das permissoes do usuario autenticado

### `user_group_memberships`

Finalidade:

- vinculo entre usuarios do Supabase Auth e grupos de usuarios

Observacoes operacionais:

- a migration inicial associa usuarios existentes, exceto o superadministrador, ao grupo `Diretores`
- escritas administrativas passam pela Edge Function `admin-users` com `SUPABASE_SERVICE_ROLE_KEY`

## Preferencias de usuario

### `user_favorites`

Finalidade:

- favoritos pessoais de empenhos e contratos por usuario autenticado

Campos-chave:

- `id`
- `user_id`
- `entity_type`: `empenho` ou `contrato`
- `empenho_id`
- `contrato_id`
- `created_at`

Consumido por:

- [userFavorites.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/userFavorites.ts)
- [Empenhos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Empenhos.tsx)
- [Contratos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Contratos.tsx)

Observacoes operacionais:

- a RLS permite que cada usuario leia, insira e remova apenas os proprios favoritos
- o `CHECK` da tabela garante que favoritos de empenho usem somente `empenho_id` e favoritos de contrato usem somente `contrato_id`
- FKs com `ON DELETE CASCADE` removem favoritos quando o empenho ou contrato local deixa de existir
- contratos favoritos sempre se referem a `contratos`; dados de `contratos_api*` apenas enriquecem a linha exibida

## Artefatos de licitacao

### `licitacao_document_artifacts`

Finalidade:

- armazenar versoes geradas no fluxo de documentos de licitacao sem reutilizar `documentos_gerados`
- cobrir `etp`, `mapa_riscos`, `termo_referencia` e `minuta_contrato`

Campos-chave:

- `artifact_type`
- `process_id`
- `process_number`
- `manual_object`
- `title`
- `html_content`
- `plain_text`
- `metadata`
- `source_artifact_ids`
- `template_id`
- `docx_export_plan`
- `docx_file_name`
- `created_by`
- `version`
- `created_at`
- `updated_at`

Consumido por:

- [licitacaoArtifacts.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/licitacaoArtifacts.ts)
- [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx)
- [ArtefatosLicitacao.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/ArtefatosLicitacao.tsx)

Observacoes operacionais:

- cada geracao cria nova versao; edicoes no editor atualizam a versao aberta com debounce
- `source_artifact_ids` guarda a linhagem entre ETP, Mapa de Risco, TR e Minuta
- RLS permite leitura a usuarios autenticados, insercao pelo usuario autenticado e update/delete apenas pelo criador ou superadmin
- anexos auxiliares do ETP continuam fora desta tabela; somente snippets e metadados derivados podem ser persistidos

## Licitacoes, pregoes PNCP e ARP

### `licitacoes_pncp`

Finalidade:

- espelho materializado das contratacoes do PNCP usadas na tela de pregoes IFRN
- fonte primaria da lista `/licitacoes-pregoes`

Campos-chave:

- `numero_controle_pncp`
- `cnpj_orgao`
- `ano_compra`
- `sequencial_compra`
- `numero_compra`
- `processo`
- `objeto_compra`
- `uasg_codigo`
- `situacao_compra_nome`
- `valor_total_estimado`
- `valor_total_homologado`
- datas de publicacao, abertura, encerramento e atualizacao
- `raw_data`, preservando o payload PNCP

Consumido por:

- [licitacoesPncp.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/licitacoesPncp.ts)
- [LicitacoesPregoes.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/LicitacoesPregoes.tsx)

Observacoes operacionais:

- a chave unica e `numero_controle_pncp`
- a v1 sincroniza pregao eletronico (`codigoModalidadeContratacao = 6`) no PNCP
- a sincronizacao geral consulta o CNPJ institucional sem restringir UASG, permitindo descobrir todas as unidades publicadas no PNCP; buscas dirigidas por UASG exigem tambem CNPJ
- quando a busca remota recebe `itemBusca`, `raw_data.itens` passa a guardar os itens retornados pelo PNCP para aquela contratacao; a pesquisa local por item depende desse cache materializado
- UASGs IFRN digitadas usam catalogo interno e UASGs externas usam resolucao best-effort via Compras.gov.br
- `Compras.gov.br` entra como enriquecimento best-effort no catalogo de UASG; a lista de pregoes vem do PNCP
- leitura fica liberada para usuarios autenticados; escrita ocorre pela Edge Function com service role

### `licitacoes_pncp_sync_runs`

Finalidade:

- trilha de execucao das sincronizacoes PNCP

Campos-chave:

- `started_at`
- `finished_at`
- `status`
- `cnpj_orgao`
- `unidade_codigos`
- `data_inicial`
- `data_final`
- `total_fetched`
- `total_upserted`
- `details`

### `licitacoes_pncp_uasgs`

Finalidade:

- cache do endpoint de UASG dos Dados Abertos Compras.gov.br para rotulo e contexto institucional

Observacao:

- a tabela nao e fonte de verdade da lista de pregoes; ela apenas melhora exibicao e filtros quando disponivel
- a migration `20260505213000_seed_ifrn_licitacoes_pncp_uasgs.sql` materializa o cache interno IFRN com 19 UASGs unicas, todas com `cnpj_orgao = 10877412000168` e `codigo_orgao = 26435`, evitando consultar o endpoint instavel de UASG do Compras.gov.br para as unidades conhecidas

### `atas_registro_precos`

Finalidade:

- espelho materializado das Atas de Registro de Precos/ARP retornadas pelos Dados Abertos Compras.gov.br
- base da tela `/atas-registro-precos`

Campos-chave:

- `ata_key`
- `numero_ata`
- `numero_compra`
- `ano_compra`
- `unidade_gerenciadora_codigo`
- `unidade_gerenciadora_nome`
- `objeto`
- `data_vigencia_inicial`
- `data_vigencia_final`
- `raw_data`

Observacoes operacionais:

- a chave unica e `ata_key`, derivada de unidade gerenciadora e numero da ata
- leitura fica liberada para usuarios autenticados; escrita ocorre pela Edge Function com service role

### `atas_registro_precos_itens`

Finalidade:

- itens das ARPs, com fornecedor, descricao, quantidade e valores quando retornados pela API

Campos-chave:

- `item_key`
- `ata_key`
- `numero_item`
- `codigo_item`
- `descricao_item`
- `fornecedor_ni`
- `valor_total`

### `atas_registro_precos_unidades`

Finalidade:

- unidades participantes por item de ARP, vindas de `modulo-arp/3_consultarUnidadesItem`
- preserva `raw_data.tipoUnidade`, usado pela view de resumo para nao tratar a unidade gerenciadora como participante

Campos-chave:

- `unidade_item_key`
- `item_key`
- `ata_key`
- `unidade_codigo`
- `quantidade_autorizada`
- `saldo_quantidade`

### `atas_registro_precos_adesoes`

Finalidade:

- adesoes por item de ARP, vindas de `modulo-arp/5_consultarAdesoesItem`

Campos-chave:

- `adesao_key`
- `item_key`
- `ata_key`
- `unidade_codigo`
- `quantidade_aderida`
- `valor_aderido`
- `data_adesao`

### `atas_registro_precos_resumo`

Finalidade:

- view agregada para listar atas com totais de itens, participantes e adesoes por unidade
- `unidades_participantes` exclui linhas cujo `raw_data.tipoUnidade = GERENCIADORA`, mantendo o filtro `Participante` separado do filtro `Gerenciadora`
- expoe `itens_texto_pesquisa`, agregado de numero/codigo/descricao do item e fornecedor, para pesquisa local da lista sem consulta externa em tempo real

Consumido por:

- [atasRegistroPrecos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/atasRegistroPrecos.ts)
- [AtasRegistroPrecos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/AtasRegistroPrecos.tsx)

### `atas_registro_precos_sync_runs`

Finalidade:

- trilha de execucao das sincronizacoes de ARP

Campos-chave:

- `started_at`
- `finished_at`
- `status`
- `unidade_codigos`
- `data_inicial`
- `data_final`
- `total_fetched`
- `total_upserted`
- `details`

## Energia Campus

### `energia_import_runs`

Finalidade:

- trilha das cargas XLSX do painel de energia.

Campos-chave:

- `id`
- `source_file`
- `imported_by`
- `imported_by_email`
- `totals`
- `imported_at`

### `energia_consumo_faturas`

Finalidade:

- faturas/previsões de energia por fonte, competência, subestação e valor.

Campos-chave:

- `fonte`: `cosern` ou `mercatto`
- `competencia`
- `leitura_inicio`
- `leitura_fim`
- `consumo_ativo_fp_kwh`
- `consumo_ativo_np_kwh`
- `consumo_total_kwh`
- `valor_faturado`
- `fatura_numero`
- `parcela`
- `processo`

Observacoes operacionais:

- Mercatto usa kWh real quando a base importada traz essa informação; quando só houver previsão/fatura sem kWh direto, esses campos ficam nulos e a UI exibe `N/D` nas abas específicas.

### `energia_solar_geracao`

Finalidade:

- geração anual ou mensal das UFVs do campus.

Campos-chave:

- `ufv_nome`
- `data_referencia`
- `ano`
- `mes`
- `granularidade`: `anual` ou `mensal`
- `energia_gerada_kwh`
- `observacao`

### `energia_contratos`

Finalidade:

- resumo das fontes/contratos de energia derivados da planilha importada.

Campos-chave:

- `fonte`
- `modalidade`
- `fornecedor`
- `contrato_numero`
- `volume_contratado_kwh`
- `valor_contratado`
- `situacao`

### `energia_contrato_execucoes`

Finalidade:

- execução financeira por parcela quando disponível na planilha.

Campos-chave:

- `fonte`
- `contrato_numero`
- `parcela`
- `valor_executado`
- `valor_previsto`
- `percentual_execucao`

Consumido por:

- [energiaCampusService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/energiaCampusService.ts)
- [EnergiaCampus.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/energia/EnergiaCampus.tsx)

Observacoes operacionais:

- leitura liberada para usuarios autenticados; escrita restrita ao superadministrador por RLS.
- métricas ambientais são calculadas no frontend em `energyMetrics.ts`.

## Automacoes e economia de tempo

### `automation_savings_scenarios`

Finalidade:

- catalogo das interacoes automatizadas usadas pela pagina `/economia-tempo`
- guarda tempo manual, tempo com o sistema, estimativa mensal de execucoes, modulo, origem e ordenacao

Consumido por:

- [automationSavingsService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/automationSavingsService.ts)
- [EconomiaTempo.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EconomiaTempo.tsx)

Observacoes operacionais:

- quando a tabela estiver vazia ou indisponivel, o frontend usa o catalogo local em `DEFAULT_AUTOMATION_SAVINGS_SCENARIOS`
- o seed inicial cadastra os cenarios de SIAFI, relatorios, liquidacoes, PFs/LC, contratos, SUAP, importacoes e geracao de documentos

### `automation_savings_events`

Finalidade:

- eventos reais de uso registrados pelo app, extensoes ou automacoes externas
- cada evento replica os minutos vigentes do cenario no momento do registro para preservar o calculo historico

Consumido por:

- [record-automation-savings-event/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/record-automation-savings-event/index.ts)
- [automationSavingsService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/automationSavingsService.ts)

Observacoes operacionais:

- `metadata.count` multiplica as execucoes reais de um evento em lote
- a escrita passa pela Edge Function `record-automation-savings-event`, com `AUTOMATION_EVENT_SECRET` para extensoes ou JWT para chamadas internas autenticadas

## Limpeza e Manutenção

### `manutencao_ambientes`

Finalidade:

- Cadastro de espaços físicos monitorados por QR Code no campus.

Campos-chave:

- `id`
- `codigo` (ex: SALA-101)
- `nome`
- `bloco`
- `tipo`
- `status`

Observações operacionais:

- Leitura pública liberada; escrita restrita a administradores autenticados.
- O vínculo com o mapa usa diretamente o nome armazenado em `bloco`; o módulo não classifica mais ambientes por zona funcional.

### `manutencao_blocos_mapa`

Finalidade:

- Configuração dos blocos interativos exibidos no mapa do campus.

Campos-chave:

- `id`
- `nome`
- `badge_x`
- `badge_y`
- `geometria_tipo`
- `geometria_data`

Observações operacionais:

- Cada bloco é selecionado e destacado individualmente.
- A coluna legada `zona` foi removida; cores, filtros e estatísticas não dependem mais de zona funcional.

### `manutencao_ocorrencias`

Finalidade:

- Ocorrências e pesquisas de satisfação de limpeza enviadas por usuários.

Campos-chave:

- `id`
- `ambiente_id`
- `respondente_tipo`
- `avaliacao` (1 a 5)
- `problemas` (Array de tags)
- `observacao`
- `foto_path` (caminho opcional no bucket privado `manutencao-ocorrencias`)
- `status` (pendente/resolvido)

Observações operacionais:

- Inserção anônima pública liberada; leitura e resolução restritas a usuários autenticados.
- A foto opcional aceita JPEG, PNG ou WebP com até 5 MB. O banco persiste apenas o caminho; a tela administrativa gera URL assinada temporária para visualização.
- Ocorrências pendentes geram alerta no bloco informado pelo ambiente relacionado em `manutencao_ambientes.bloco`.

### `manutencao_checkins`

Finalidade:

- Registro de passagens e limpezas realizadas pelas equipes.

Campos-chave:

- `id`
- `ambiente_id`
- `responsavel_nome`
- `acao_realizada`
- `observacao`

Observações operacionais:

- Inserção anônima pública liberada (validação de PIN); leitura restrita a usuários autenticados.

## Módulo do SUAP (Processos Eletrônicos)

### `processos`

Finalidade:

- Persistir metadados preliminares e resultados de extrações de processos do SUAP.

Campos-chave:

- `id` (UUID)
- `tenant_id` (UUID, mapeado para `auth.users.id`)
- `suap_id` (ID interno do SUAP)
- `url` (Link direto para o processo no SUAP)
- `num_processo` (Número de processo formatado)
- `beneficiario` (Interessado)
- `cpf_cnpj` (Documento do beneficiário)
- `valor_nf` (Valor financeiro bruto identificado)
- `contrato` (Contrato associado)
- `assunto` (Assunto principal do processo)
- `status` (pending_extraction, pdf_uploaded, concluido etc.)
- `dados_completos` (JSONB com a estrutura de notas, empenhos, dados bancários e dados preliminares)
- `pdf_url` (Caminho para o PDF armazenado no bucket `suap-pdfs`)

Observações operacionais:

- Isolamento por Tenant (RLS `tenant_isolation`): `(auth.uid() = tenant_id)`. O usuário só pode ver e editar processos criados por ele mesmo.
- O inventário preserva dados e PDFs em `processos`, mas a visibilidade na UI depende de pelo menos um vínculo ativo em `suap_processo_caixas`.
- Processos ausentes de uma caixa lida com sucesso perdem apenas esse vínculo; se retornarem a qualquer caixa cadastrada, reaparecem com o mesmo histórico.

### `suap_processo_caixas`

Finalidade:

- Relação N:N entre processos e caixas SUAP ativas, usada para reconciliar o inventário e filtrar a interface.

Campos-chave:

- `processo_id` e `caixa_id` (chave primária composta, ambos com remoção em cascata)
- `tenant_id` (isolamento por usuário)
- `last_seen_at` (última confirmação do processo na caixa)

Observações operacionais:

- Apenas caixas selecionadas e lidas com sucesso são reconciliadas; falhas e caixas não selecionadas não alteram vínculos.
- Uma caixa vazia é um inventário válido e remove seus vínculos anteriores.

### Storage Bucket: `suap-pdfs`

Finalidade:

- Armazenamento de arquivos PDF completos de processos do SUAP baixados durante a sincronização nativa.

Observações operacionais e RLS:

- **Isolamento por pasta**: O caminho do arquivo segue a estrutura `{tenant_id}/{suap_id}.pdf`.
- **INSERT**: Permitido para usuários autenticados na própria pasta: `((bucket_id = 'suap-pdfs'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))`.
- **SELECT**: Leitura permitida para o próprio usuário autenticado que enviou o arquivo.
- **UPDATE**: Atualização permitida para o próprio usuário autenticado dono da pasta (RLS `Tenant can update their own PDFs`), essencial para a funcionalidade de `upsert` na sincronização.
- **DELETE**: Remoção permitida para o próprio usuário autenticado dono da pasta (RLS `Tenant can delete their own PDFs`).

## Fundação operacional e Almoxarifado

A migration 20260706110000 cria cadastros compartilhados e o razão imutável de estoque.

- operational_entities / operational_entity_memberships: instituição operacional, papel e isolamento RLS.
- operational_units, cost_centers e physical_locations: estrutura comum da Fase 4.
- measurement_units e catalog_items: catálogo único de consumo, permanente e serviços.
- warehouses e warehouse_items: depósitos, estoque mínimo e bloqueio.
- stock_movements e stock_movement_items: eventos imutáveis de entrada, saída, transferência, ajuste e devolução.
- stock_balances: view derivada com quantidade e valor por depósito/item.
- post_stock_movement: RPC idempotente que valida entidade, depósito, bloqueio e saldo; saídas usam custo médio da origem.

Consumido por src/services/inventory.ts e src/pages/Almoxarifado.tsx.
