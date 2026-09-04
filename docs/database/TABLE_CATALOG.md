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
- `saldo_disponivel` (saldo oficial do Plano 8 do SUAP para atividades sincronizadas)
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

### `contratos_api_documentos`

- documentos oficiais e anexos (PDFs de contratos, aditivos, apostilamentos e publicações) consultados e sincronizados a partir da API do PNCP (`GET /orgaos/{cnpj}/contratos/{ano}/{seq}/arquivos`)
- campos principais:
  - `contrato_api_id`: chave estrangeira referenciando `contratos_api(id)`
  - `sequencial_documento`: sequencial do documento retornado pelo PNCP
  - `titulo`: título ou nome amigável do documento
  - `tipo_documento_nome`: tipo documental (ex: `Contrato`, `Termo Aditivo`, `Apostilamento`, `Outros Documentos`)
  - `url`: link direto para visualização ou download do arquivo PDF oficial
  - `data_publicacao_pncp`: data/hora de publicação no PNCP
  - `tamanho`: tamanho em bytes do documento
- consumido em tempo real pelo modal de detalhes do contrato ([`ContratoApiDetailsSheet.tsx`](file:///c:/Users/3128880/Desktop/Programação/Sistema_Gerencial/src/components/contratos/ContratoApiDetailsSheet.tsx)) e sincronizado pelo job diário `sync-contratos-pncp-documentos`

### `contratos_api_instrumentos_cobranca`

- instrumentos de cobrança (Notas Fiscais Eletrônicas - NF-e, Faturas, Recibos) consultados e sincronizados a partir da API do PNCP (`GET /orgaos/{cnpj}/contratos/{ano}/{seq}/instrumentocobranca`)
- campos principais:
  - `contrato_api_id`: chave estrangeira referenciando `contratos_api(id)`
  - `sequencial_instrumento_cobranca`: sequencial do instrumento de cobrança no PNCP
  - `tipo_nome`: tipo documental (ex: `Nota Fiscal Eletrônica (NF-e)`)
  - `numero_instrumento_cobranca`: número da nota fiscal emitida pelo fornecedor
  - `data_emissao`: data de emissão do documento fiscal
  - `chave_nfe`: chave de acesso de 44 dígitos da SEFAZ
  - `data_consulta_nfe`: timestamp da consulta realizada junto à SEFAZ/Receita Federal
  - `valor_nota_fiscal`: valor total da NF-e
  - `tipo_evento_mais_recente`: status fiscal oficial da SEFAZ (ex: `Autorização de Uso`, `Cancelamento`)
  - `itens`: lista discriminada de produtos/serviços faturados com NCM/SH, CFOP, quantidade, unidade e valor unitário
  - `eventos`: eventos registrados no Fisco
- consumido em tempo real pelo modal de detalhes do contrato ([`ContratoNfeRastreabilidade.tsx`](file:///c:/Users/3128880/Desktop/Programação/Sistema_Gerencial/src/components/contratos/ContratoNfeRastreabilidade.tsx)) e sincronizado pelo job diário `sync-contratos-pncp-documentos`

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
- `status` ('draft', 'enviada_fornecedor', 'liquidada')
- `consumo_iniciado_em` (data em que a requisição deixou de ser rascunho; nulo enquanto `draft`)
- `contrato_id` (FK para contratos)
- `empenho_id` (FK para empenhos; compatibilidade com a primeira NE selecionada)
- `created_by` (FK para auth.users)

Regras:
- `save_requisicao_compra` salva cabeçalho, empenhos vinculados e itens na mesma transação.
- O fluxo utiliza 3 status: `draft` (Rascunho), `enviada_fornecedor` (Enviada ao Fornecedor) e `liquidada` (Liquidada).
- Requisições em `enviada_fornecedor` exigem ao menos uma NE, itens com `empenho_id` e permissão explícita para terceirizados. O saldo disponível valida e abate concorrentemente outras requisições já enviadas ao fornecedor da mesma NE.
- Requisições com status `liquidada` não acumulam desconto no módulo para evitar duplicidade com as liquidações oficiais registradas no SIAFI.
- Itens de requisições com status diferente de `draft` compõem o consumo automático de insumos no ambiente canônico `REFEITORIO` / Refeitório. A data analítica é `consumo_iniciado_em`.
- `fn_empenho_saldo_disponivel` calcula saldo de exercício com dados SIAFI locais e prioriza `saldo_rap_oficial` para RAP.

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
- Para o terceirizado de refeitório, vínculos com `contrato_id` são exibidos como contratos autorizados em `/contratos`; eles não liberam os empenhos do contrato sem vínculos diretos por `empenho_id`.

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

### `lc_saved_lists`

Finalidade:

- persistir listas de trabalho da Lista de Credores, incluindo as contas selecionadas e os arquivos PDF de origem

Campos-chave:

- `id`
- `org_id`
- `name`
- `source_pdf_names`
- `rows`
- `created_by`
- `created_at`
- `updated_at`

Observacoes operacionais:

- `rows` e `source_pdf_names` sao JSONB para preservar o snapshot da grade e permitir a reabertura sem alterar `lc_credores`
- a RLS permite listar, inserir, atualizar e excluir listas para qualquer usuario autenticado do mesmo `org_id`; superadministrador pode operar em todos os orgaos
- `org_id` e preenchido por `public.default_org_id()` no insert e nao precisa ser enviado pelo frontend
- a tela `/lc` usa `lcSavedListsService.ts`; `localStorage` e somente fallback de contingencia e nao e fonte de compartilhamento entre orgaos

Consumido por:

- [lcSavedListsService.ts](/C:/Users/3128880/Desktop/Programação/Sistema_Gerencial/src/services/lcSavedListsService.ts)
- [LC.tsx](/C:/Users/3128880/Desktop/Programação/Sistema_Gerencial/src/pages/LC.tsx)

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

- `candidates`…1499 tokens truncated…reens.ts`
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

### `manutencao_consumo_insumos`

Finalidade:

- View analítica que unifica os materiais de check-ins e os itens de requisições de compra não-rascunho.

Campos-chave:

- `origem` (`checkin` ou `requisicao_compra`)
- `consumo_em`, `ambiente_*`, `material`, `quantidade`, `unidade`, `valor_unitario`, `valor_total`
- `requisicao_compra_id`, `requisicao_numero`, `requisicao_status` (quando a origem é requisição)

Observações operacionais:

- A view usa `security_invoker`; portanto, a leitura respeita as permissões das tabelas de origem.
- Requisições sempre são associadas ao Refeitório e não geram linhas físicas de check-in.

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

### `process_mappings`

Finalidade:

- Publicar o mapeamento BPMN e o guia operacional usado para explicar o caminho esperado de cada tipo de processo.

Campos-chave:

- `id`, `org_id`, `code`, `slug`, `title`, `category` e `version`;
- `status` (`draft`, `published` ou `archived`);
- `definition` (JSONB com raias, nos, conexoes, responsaveis, prazos, checklists e links);
- `created_by`, `created_at`, `updated_at` e `published_at`.

Observacoes operacionais:

- O isolamento e feito por `org_id` com `current_user_org_id()`.
- Usuarios autenticados leem mapas do proprio orgao; insercao, edicao e exclusao exigem papel `admin` do orgao ou superadmin.
- A extensao recebe somente um resumo derivado do mapa publicado. A pagina `/mapeamentos/:mappingId` renderiza a definicao completa em modo somente leitura.

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

### `suap_processo_documentos`

Finalidade:

- Inventário por processo dos PDFs individuais localizados no HTML do SUAP para o piloto manual de extração.

Campos-chave:

- `tenant_id`, `processo_id`, `suap_documento_id` (únicos por documento);
- `ordem`, `titulo`, `tipo`, `url_original`;
- `classificacao` e `motivo_classificacao`;
- `download_status`, `storage_path`, `byte_size`, `page_count`, `download_error` e `downloaded_at`.

Observações operacionais e RLS:

- A política de `FOR ALL` restringe leitura e escrita a `auth.uid() = tenant_id`.
- Somente documentos `included` e `downloaded` podem entrar em uma extração `eligible_documents`; os títulos desconhecidos entram por padrão.

### `process_extraction_runs`

Finalidade:

- Histórico imutável de cada solicitação de extração, separado do job reutilizável por processo.

Campos-chave:

- `job_id`, `tenant_id`, `suap_id`, `input_strategy`, `input_document_ids` e `status`;
- contagem, bytes e páginas da entrada; métricas de etapas; provedor; fallback; snapshot do resultado e erro.

Observações operacionais e RLS:

- A RLS de leitura permite somente o próprio `tenant_id`.
- `process_extraction_jobs.current_run_id` aponta para a execução ativa/mais recente, sem substituir os históricos anteriores.

### Storage Bucket: `suap-pdfs`

Finalidade:

- Armazenamento do PDF completo canônico em `{tenant_id}/{suap_id}.pdf` e, no piloto, das peças elegíveis em `{tenant_id}/{suap_id}/documents/{suap_documento_id}.pdf`.

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

- `quantity` aceita zero para rascunhos e impressao; valores negativos continuam invalidos na RPC `save_requisicao_compra`.
- A RLS de `terceirizados` e `terceirizado_permissions` tambem reconhece o grupo `assistencia`, que possui acesso explicito ao cadastro e a gestao de vinculos em `/cadastro-terceirizados`.

- A política de exclusão de `requisicoes_compra` permite ao criador remover registros em `draft`, mantendo a exclusão irrestrita por gestores e superadministradores.

## Sincronização do Plano SUAP

### `suap_connections`
Sessões SUAP cifradas, de curta duração, vinculadas ao usuário e ao órgão. A tabela tem RLS e não concede leitura ao cliente; somente a Edge Function usa o conteúdo cifrado.

### `suap_plan_sync_runs`
Histórico das capturas do Plano 8: modo (`preview`/`apply`), status, checksum, contagens, tempos e erro.

### `suap_plan_activity_snapshots`
Snapshot normalizado e bruto de cada atividade capturada, por execução e ID estável do SUAP. Preserva `saldo_disponivel`, lido da coluna "Saldo disponível para empenho da atividade".

### Campos de sincronização em `atividades`
`sync_source`, `suap_plan_id`, `suap_activity_id`, `sync_active` e `sync_last_seen_run_id` permitem upsert idempotente e arquivamento lógico dos itens ausentes. Para registros `suap_plan_8`, `saldo_disponivel` é a fonte oficial do saldo exibido no drill-down do Dashboard.

### `suap_document_reviews`

Finalidade:

- Persistir cada analise concluida de TR/ETP iniciada pela extensao do SUAP, permitindo consultar a mais recente sem baixar o PDF novamente.

Campos-chave:

- `id`, `created_by`, `created_at`;
- `suap_id`, `document_id`, `document_type`, `document_title`, `process_number`;
- `checked_at` e `result` (JSONB normalizado da analise).

RLS e indices:

- leitura e insercao ficam restritas a `created_by = auth.uid()`;
- indice por usuario, processo, documento e `checked_at` decrescente suporta a consulta do ultimo resultado.

## Observabilidade e Ingestão de Dados

### `data_import_runs`

Finalidade:

- Rastrear execuções de importação manual de dados (CSV, XLSX, JSON) para observabilidade, auditoria e detecção de falhas.

Campos-chave:

- `id`, `org_id`, `user_id`, `user_email`;
- `pipeline` (identificador do pipeline, ex: `descentralizacoes`, `empenhos_siafi`, `financeiro_fontes`, `energia_campus`);
- `pipeline_name` (rótulo amigável);
- `source_type` (`manual_upload`, `email_csv`, `api_sync`);
- `source_name` (nome do arquivo ou identificador da origem);
- `status` (`processing`, `success`, `warning`, `failed`, `skipped`);
- `rows_detected`, `rows_written`, `rows_skipped`, `rows_updated`;
- `error_message`, `metadata` (JSONB com contagens e detalhes);
- `started_at`, `finished_at`, `created_at`, `updated_at`.

RLS e índices:

- RLS por `org_id` permitindo `SELECT`, `INSERT`, `UPDATE` para usuários autenticados do órgão ou superadmin;
- Índices em `(org_id, created_at DESC)`, `(pipeline, created_at DESC)` e `status`.

Consumido por:

- [dataImportLogsService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/dataImportLogsService.ts)
- [ImportacaoDados.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/ImportacaoDados.tsx)
- [ObservabilityCenter.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/observabilidade/ObservabilityCenter.tsx)
