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

- historico das sincronizacoes da API de contratos
- guarda tambem contadores de historico, itens, vinculos fatura-item e vinculos fatura-empenho

Consumido por:

- [contratos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/contratos.ts)
- [contratosApi.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/contratosApi.ts)

## Importacoes auxiliares

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
