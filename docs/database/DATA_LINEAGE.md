# DATA_LINEAGE

## Objetivo

Mostrar a linhagem operacional dos dados de forma curta:

- origem
- parser ou service
- tabela ou view
- pagina consumidora

## Linhagens principais

### Orcamento base

- entrada manual de atividades
  - pagina: [Atividades.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Atividades.tsx)
  - service: [atividades.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/atividades.ts)
  - tabela: `atividades`
  - observacao: normaliza `componente_funcional` sem prefixo numerico, limpa labels legados de atividades da dimensao `EN` e persiste `tipo_atividade` para definir a aba de planejamento

- entrada manual de empenhos e imports auxiliares
  - pagina: [Empenhos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Empenhos.tsx)
  - service: [empenhos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/empenhos.ts)
  - tabela: `empenhos`
  - observacao: normaliza `componente_funcional` sem prefixo numerico antes de persistir

### Financeiro

- arquivo `4 - Financeiro.csv`
  - parser: [financeiroImportService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/financeiroImportService.ts)
  - tabela: `financeiro_fonte_vinculacao`
  - pagina: [Financeiro.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Financeiro.tsx)

### Credito disponivel

- arquivo `3 - Credito Disponivel.csv`
  - parser e persistencia: [creditosDisponiveisDetalhes.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/creditosDisponiveisDetalhes.ts)
  - tabelas:
    - `creditos_disponiveis_detalhes`, snapshot por PTRES/PI para consulta
    - `creditos_disponiveis`, agregado por PTRES para compatibilidade
  - pagina: [CreditoDisponivel.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/CreditoDisponivel.tsx)
  - observacao: aceita o layout tabulado com descricao e valor sem cabecalho, alem do formato agregado legado

### LC

- arquivo `7 - LC.csv`
  - parser: [lcImportService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/lcImportService.ts)
  - tabela: `lc_credores`
  - pagina: [LC.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/LC.tsx)

- PDFs de pagamento
  - extracao: [bolsistasPdfService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/bolsistasPdfService.ts)
  - comparacao: [lcComparisonService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/lcComparisonService.ts)
  - saida operacional: macro em [siafiMacroService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/siafiMacroService.ts)

### PFs

- arquivos de solicitacao e aprovacao/liberacao
  - parser e correlacao: [pfImportService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/pfImportService.ts)
  - tabelas:
    - `pf_fonte_recurso`
    - `pf_solicitacao`
    - `pf_aprovacao`
    - `pf_liberacao`
  - views de consumo:
    - `vw_controle_pfs_pendentes`
    - `vw_documentos_pendentes_pagamento`
    - `vw_rastreabilidade_pf`
  - pagina: [RastreabilidadePFs/index.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/RastreabilidadePFs/index.tsx)

### Contratos locais

- cadastro legado em `contratos` e `contratos_empenhos`
  - persistencia: [contratos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/contratos.ts)
  - tabelas:
    - `contratos`
    - `contratos_empenhos`
- observacao: o upload manual XLSX deixou de ser o fluxo operacional da tela de contratos. A base local permanece para favoritos, CNPJ e saldos/vinculos locais quando casar por numero normalizado com `contratos_api`. Linhas vindas apenas da API aparecem sem favorito local. O contrato legado `00089/2016` da CAERN continua como excecao operacional fora da exibicao
  - pagina: [Contratos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Contratos.tsx)

### Requisicoes de compra

- cadastro por `/requisicao-compra`
  - pagina: [RequisicaoCompra.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/RequisicaoCompra.tsx)
  - service: [requisicoesCompra.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/requisicoesCompra.ts)
  - RPC transacional: `save_requisicao_compra`
  - tabelas:
    - `requisicoes_compra`
    - `requisicao_compra_empenhos`
    - `requisicao_compra_itens`
    - `terceirizado_permissions`
  - observacao: a requisicao pode vincular multiplas NEs em `requisicao_compra_empenhos`; cada item carrega seu proprio `empenho_id`. Os campos legados `requisicoes_compra.empenho_id/empenho_numero` continuam preenchidos com a primeira NE para compatibilidade. Em `review`/`approved`, a RPC valida permissao de terceirizado e saldo oficial separadamente por NE, sem abater outras requisicoes abertas.

### Contratos API Comprasnet

- API `https://contratos.comprasnet.gov.br/api`
  - sincronizacao automatica: [sync-contratos-comprasnet/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/sync-contratos-comprasnet/index.ts)
  - service de leitura no frontend: [contratosApi.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/contratosApi.ts)
  - tabelas:
    - `contratos_api`
    - `contratos_api_historico`
    - `contratos_api_empenhos`
    - `contratos_api_faturas`
    - `contratos_api_itens`
    - `contratos_api_fatura_itens`
    - `contratos_api_fatura_empenhos`
    - `contratos_api_sync_runs`
  - pagina: [Contratos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Contratos.tsx)
- observacao: a tela principal de contratos vem de `contratos_api` filtrada por `situacao_derivada = true`. A sincronizacao diaria busca UGs `158366` e `158155`; o endpoint de "ativos" do Comprasnet nao e confiavel sozinho, portanto a vigencia real e derivada do historico (`vigencia_fim_derivada` = maior `vigencia_fim` valida). Rescisao/cancelamento inativa o contrato; sem historico, `vigencia_fim` da listagem e fallback com motivo registrado. Como excecao para evitar falsos inativos por atraso no cadastro de aditivos, se a vigencia do historico estiver vencida mas o contrato constar como ativo no Comprasnet e possuir faturas emitidas ou pagas nos ultimos 120 dias, ele e reativado com o motivo `historico_vencido_com_fatura_recente`. Contratos da UG `158155` so entram com evidencia operacional estruturada do campus `158366`, como empenho ou fatura com UG/contratante do campus. Valor Total usa `contratos_api_historico` como fonte principal quando houver API, somando `valor_inicial` de cada termo; `valor_global` da API nao entra nessa metrica. Sem historico com `valor_inicial`, usa `contratos.valor` como fallback. A execucao por item soma faturas com situacao `Pago` ou `Siafi Apropriado` que tenham `dados_item_faturado`. O valor contratado por item no drawer soma `contratos_api_itens.historico_item[].valor_total` quando existir e cai para `contratos_api_itens.valor_total` sem historico do item. Em contratos, Valor Empenhado usa `contratos_api_empenhos.valor_empenhado` quando houver API, com fallback para o valor original do empenho local; os badges/popovers da lista principal mostram empenhos locais e completam com `contratos_api_empenhos` quando a API trouxer numeros ainda ausentes no vinculo local. Para RAP da API, `raw_data.rppago` e `raw_data.rpliquidado` alimentam o liquidado/pago de RAP, e o saldo atual vem de `rp_a_pagar` ou da diferenca derivada sobre a base RAP.

### Cache de liquidações Comprasnet por empenho

- API `https://contratos.comprasnet.gov.br/api`
  - atualizacao: [refresh-comprasnet-liquidacoes-cache/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/refresh-comprasnet-liquidacoes-cache/index.ts)
  - service de leitura no frontend: [contratosApi.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/contratosApi.ts)
  - tabelas:
    - `contratos_api_empenho_liquidacoes_cache_status`
    - `contratos_api_empenho_liquidacoes_cache`
  - consumidor: [EmpenhoDialog.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/modals/EmpenhoDialog.tsx)
- observacao: o modal nao varre a API publica em tempo real quando usa as UGs padrao `158366` e `158155`; ele le o cache e aciona a function para preencher ou revalidar entradas. Resultados encontrados vencem em 12 horas, e `not_found` vence em 1 hora.

### Pregoes PNCP

- API `https://pncp.gov.br/api/consulta`
  - sincronizacao automatica: [sync-licitacoes-pncp/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/sync-licitacoes-pncp/index.ts)
  - service de leitura no frontend: [licitacoesPncp.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/licitacoesPncp.ts)
  - tabelas:
    - `licitacoes_pncp`
    - `licitacoes_pncp_sync_runs`
    - `licitacoes_pncp_uasgs`
  - pagina: [LicitacoesPregoes.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/LicitacoesPregoes.tsx)
- observacao: o endpoint PNCP `/v1/contratacoes/publicacao` usa datas `yyyyMMdd`, limita cada consulta a ate 365 dias e e consultado por `cnpj=10877412000168` sem UASG na sincronizacao institucional; quando a consulta filtra `codigoUnidadeAdministrativa`, o CNPJ tambem e obrigatorio. A v1 busca pregao eletronico (`codigoModalidadeContratacao = 6`), nao envia `tamanhoPagina` e grava o payload integral em `raw_data`. Quando `itemBusca` e informado, a function tambem consulta `/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens` e salva o resultado em `raw_data.itens` para pesquisa local por item.

### Pesquisa de preços

- planilha XLSX/XLS/CSV
  - parser e normalização: `src/lib/priceResearch.ts`
  - página: `src/pages/PesquisaPrecos.tsx`
- código CATMAT/CATSER
  - consulta autenticada: `supabase/functions/pesquisar-precos/index.ts`
  - fonte de preços homologados: Dados Abertos Compras.gov.br, módulo de pesquisa de preços
  - enriquecimento opcional: Gemini reordena aderência sem alterar valores
  - rastreabilidade complementar: link de pesquisa no PNCP por UASG/número/ano
- revisão humana
  - seleção ou exclusão justificada de cada referência
  - cálculo local de estatísticas e preço estimado
- persistência
  - `price_researches`
  - `price_research_items`
- saída
  - relatório HTML imprimível
  - workbook XLSX com resumo e detalhamento das cotações

- capacitacao EAD
  - pagina: `src/pages/PriceResearchEad.tsx`
  - service: `src/services/priceResearchEad.ts`
  - helper: `src/lib/youtube.ts`
  - tabela: `price_research_ead_videos`
  - saida: iframe `youtube-nocookie.com` montado localmente a partir do ID validado do video
  - observacao: nao usa API key do YouTube; cadastro e manutencao ficam restritos ao superadministrador

- API `https://dadosabertos.compras.gov.br`
  - enriquecimento best-effort: `/modulo-uasg/1_consultarUasg`
  - tabela: `licitacoes_pncp_uasgs`
  - observacao: os endpoints de pregoes/contratacoes dos Dados Abertos foram tratados como apoio futuro, pois responderam com instabilidade/timeout na validacao inicial. Para UASGs IFRN, a tabela `licitacoes_pncp_uasgs` tambem recebe seed local com CNPJ e codigo do orgao pela migration `20260505213000_seed_ifrn_licitacoes_pncp_uasgs.sql`; assim a resolucao de CNPJ das unidades conhecidas nao depende do endpoint de UASG do Compras.gov.br.

### Atas de Registro de Precos / ARP

- API `https://dadosabertos.compras.gov.br`
  - sincronizacao: [sync-atas-registro-precos/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/sync-atas-registro-precos/index.ts)
  - service de leitura no frontend: [atasRegistroPrecos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/atasRegistroPrecos.ts)
  - endpoints:
    - `/modulo-arp/1_consultarARP`
    - `/modulo-arp/2_consultarARPItem`
    - `/modulo-arp/3_consultarUnidadesItem`
    - `/modulo-arp/5_consultarAdesoesItem`
  - tabelas:
    - `atas_registro_precos`
    - `atas_registro_precos_itens`
    - `atas_registro_precos_unidades`
    - `atas_registro_precos_adesoes`
    - `atas_registro_precos_sync_runs`
  - view de consumo: `atas_registro_precos_resumo`
  - pagina: [AtasRegistroPrecos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/AtasRegistroPrecos.tsx)
- observacao: a tela filtra por UASG e tipo de vinculo (`gerenciadora`, `participante`, `aderente` ou qualquer vinculo). O endpoint de ARP do Compras.gov.br pode oscilar; a Edge Function registra falhas por escopo em `details.errors` e preserva o payload bruto em `raw_data`.
- observacao: para filtro `participante`, a API nao possui parametro direto por UASG participante; o frontend materializa o cache das atas gerenciadas pelas UASGs IFRN com `includeParticipantes=true` e filtra localmente a view `atas_registro_precos_resumo`. Para filtro `aderente`, a API exige ata, gerenciadora e item antes de consultar adesoes; por isso o frontend varre gerenciadoras IFRN e envia a UASG alvo em `adesaoUnidadeCodigos`. A view exclui `raw_data.tipoUnidade = GERENCIADORA` do agregado `unidades_participantes`.

### Favoritos de empenhos e contratos

- acao do usuario nas telas:
  - [Empenhos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Empenhos.tsx)
  - [Contratos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Contratos.tsx)
- persistencia: [userFavorites.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/userFavorites.ts)
- tabela: `user_favorites`
- cruza com:
  - `empenhos`
  - `contratos`
- observacao: favoritos sao pessoais por `user_id`; o filtro `Favoritos` nas telas usa apenas os IDs do usuario autenticado e nao altera os dados originais de empenhos ou contratos.

### Documentos habeis

- arquivo de documentos/situacoes/itens
  - parser: [JsonImportDialog.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/JsonImportDialog.tsx)
  - transformacao: [transparencia.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/transparencia.ts)
  - tabelas:
    - `documentos_habeis`
    - `documentos_habeis_itens`
    - `documentos_habeis_situacoes`
  - pagina: [LiquidacoesPagamentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/LiquidacoesPagamentos.tsx)

### Modelos de documentos e Termo de Referencia

- upload manual do modelo DOCX vigente
  - pagina: [ModelosDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/ModelosDocumentos.tsx)
  - parser local do DOCX: [docxDocumentTemplate.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/docxDocumentTemplate.ts)
  - persistencia: [documentTemplates.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/documentTemplates.ts)
  - tabela: `document_templates`
  - saida derivada: `questionnaire_schema`, com perguntas de clausulas `OU`, lacunas e trechos opcionais do modelo AGU

- processo sincronizado do SUAP + modelo DOCX ativo
  - leitura do PDF do processo: [referenceTerms.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/referenceTerms.ts)
  - extracao de contexto do PDF: [referenceTermProcessPdf.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/referenceTermProcessPdf.ts)
  - etapa intermediaria: [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx) apresenta o questionario do modelo, permitindo responder ou pular perguntas
  - geracao assistida: [gerar-termo-referencia-compras/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/gerar-termo-referencia-compras/index.ts)
  - consumidor frontend: [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx)
  - saida operacional: HTML editavel no editor e download do DOCX final montado sobre o template ativo, com destaque para IA, pendencias e trechos nao adotados

### Artefatos de licitacao

- ETP gerado no Editor
  - geracao: [preliminaryStudies.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/preliminaryStudies.ts) + [gerar-etp-servicos-continuos/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/gerar-etp-servicos-continuos/index.ts)
  - persistencia: [licitacaoArtifacts.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/licitacaoArtifacts.ts)
  - tabela: `licitacao_document_artifacts`, `artifact_type = 'etp'`

- Mapa de Risco gerado a partir do ETP editado
  - geracao: [riskMaps.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/riskMaps.ts) + [gerar-mapa-riscos-licitacao/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/gerar-mapa-riscos-licitacao/index.ts)
  - entrada: snippets `sourceType: "etp"` montados do HTML atual do editor
  - persistencia: `licitacao_document_artifacts`, `artifact_type = 'mapa_riscos'`, com `source_artifact_ids` apontando para o ETP quando existir

- Termo de Referencia gerado a partir de ETP + Mapa de Risco
  - geracao: [referenceTerms.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/referenceTerms.ts) + [gerar-termo-referencia-compras/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/gerar-termo-referencia-compras/index.ts)
  - entrada: snippets `sourceType: "etp"` e `sourceType: "mapa_riscos"` montados dos HTMLs revisados
  - persistencia: `licitacao_document_artifacts`, `artifact_type = 'termo_referencia'`, com plano DOCX quando houver template ativo

- Consulta e reabertura
  - pagina: [ArtefatosLicitacao.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/ArtefatosLicitacao.tsx)
  - rota de reabertura: `/editor-documentos/:modelId?artifactId=<id>`
  - observacao: edicoes posteriores atualizam a versao aberta; uma nova geracao cria nova versao

### Processos SUAP

- entrada: HTML das caixas SUAP lido por `SuapSyncPanel` e `suapScraperService`
- persistencia: `processos` guarda dados, extrações e PDF; `suap_processo_caixas` guarda a presença atual por caixa
- reconciliação: somente caixas selecionadas e lidas com sucesso removem vínculos de processos ausentes; processos e PDFs não são apagados
- consumo: `suapProcessosService.getAll` retorna somente processos com vínculo ativo, agregando as caixas para a UI de `/suap`

### Processos SUAP: piloto por PDFs individuais

- entrada adicional: HTML da página de processo -> `parseSuapProcessDocumentManifest` -> `suap_processo_documentos`;
- seleção: títulos classificados como `included` -> até quatro downloads via `suap-proxy` -> `suap-pdfs/{tenant}/{suap}/documents/*`;
- prioridade: quando ao menos uma peça elegível fica disponível, ela entra imediatamente na estratégia `eligible_documents`; a geração do PDF completo segue em paralelo e só vira uma segunda extração `full` se a primeira ficar incompleta ou não trouxer nota fiscal utilizável;
- extração: `process-pdf` valida inventário e tenant -> `process_extraction_jobs`/`process_extraction_runs` -> worker une PDFs temporariamente -> `processos.dados_completos`;
- comparação A/B: usar `process_extraction_runs` para mediana até `success`/`incomplete_extraction`, bytes, páginas, provedor/fallback e completude de campos nos 10 processos representativos.

### Liquidacoes e fonte SOF

- arquivo de liquidacoes
  - transformacao: [transparencia.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/transparencia.ts)
  - atualiza: `documentos_habeis`
  - cruza com: `empenhos`

### Ordens bancarias

- arquivo de OBs/pagos
  - transformacao: [transparencia.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/transparencia.ts)
  - atualiza:
    - `documentos_habeis_itens`
    - `documentos_habeis`

### Energia Campus

- planilha `Levantamento de Consumo - COSERN.xlsx`
  - parser: [energiaCampusService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/energiaCampusService.ts)
  - métricas: [energyMetrics.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/utils/energyMetrics.ts)
  - tabelas:
    - `energia_import_runs`
    - `energia_consumo_faturas`
    - `energia_solar_geracao`
    - `energia_contratos`
    - `energia_contrato_execucoes`
  - pagina: [EnergiaCampus.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/energia/EnergiaCampus.tsx)
- observacao: a geração solar mensal é extraída das tabelas laterais `Período - AAAA` / `Geração (kwh)` na aba `Consumo`, além das bases anuais em `UFV's`.
- observacao: Mercatto usa kWh real quando a coluna L da aba `Consumo` estiver preenchida no periodo do ambiente livre. Na Visão Geral, quando o período não tiver kWh direto de Mercatto, `contratos_api_faturas` ou `contratos_api_empenho_liquidacoes_cache` podem alimentar kWh estimado pela tarifa média conhecida para exibir o contrato Mercatto nos KPIs e gráficos. Linhas de previsão sem base de kWh ou valor continuam como `N/D`.

### Limpeza e Manutencao

- avaliacao publica por QR Code
  - pagina: [PublicFeedback.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/PublicFeedback.tsx)
  - service: [manutencao.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/manutencao.ts)
  - persistencia: `manutencao_ocorrencias`
  - foto opcional: bucket privado `manutencao-ocorrencias`; o registro guarda `foto_path`
  - formatos: JPEG, PNG ou WebP, com limite de 5 MB
- acompanhamento administrativo
  - pagina: [ManutencaoAdmin.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/ManutencaoAdmin.tsx)
  - visualizacao da foto: URL assinada temporaria gerada pelo service
  - alerta do mapa: ocorrencias pendentes -> `ambiente_id` -> `manutencao_ambientes.bloco` -> `manutencao_blocos_mapa.nome`
  - observacao: o alerta pertence ao bloco exato do ambiente e nao depende de zona funcional

### Retencoes FD-Reinf

- arquivo CSV de auditoria
  - parser: [retencoesEfdReinfImportService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/retencoesEfdReinfImportService.ts)
  - tabela: `retencoes_efd_reinf`
  - pagina: [RetencoesFdReinfDesign.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/RetencoesFdReinfDesign.tsx)
  - observacao: a tela busca a OB de pagamento vinculada em `documentos_habeis_itens`, exibe o numero da OB usada no calculo e permite marcar `correcao_realizada` para retirar o item das pendencias abertas.

### Ingestao automatica por Gmail

- e-mail com anexo `.csv`
  - coleta: [gmailCsvIngress.gs](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/scripts/google-apps-script/gmailCsvIngress.gs)
  - roteamento e parse: [ingest-email-csv/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/ingest-email-csv/index.ts) + [emailCsvIngestion.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/emailCsvIngestion.ts)
  - trilha operacional: `email_csv_ingestion_runs`
  - destino: tabela do pipeline detectado
  - observacao: a conta agregada de descentralizacoes recebida por e-mail grava `descentralizacoes_conta_saldos`, separada dos lancamentos detalhados; em credito disponivel e conta de descentralizacoes, linhas sem valor preenchido ou parseavel sao ignoradas para evitar sobrescrita com zero; o pipeline siafi_empenhos aplica a mesma regra do upload manual; quando recebe o CSV dedicado de RAP, atualiza apenas saldo_rap_oficial, e quando recebe o CSV legado combinado continua usando RESTOS A PAGAR NAO PROCES. LIQUIDADOS A PAGAR para compor o saldo operacional

### Economia de tempo

- catalogo de cenarios
  - seed: [20260425100000_create_automation_savings.sql](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/migrations/20260425100000_create_automation_savings.sql)
  - tabela: `automation_savings_scenarios`
  - fallback frontend: [automationSavings.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/utils/automationSavings.ts)

- eventos reais de automacao
  - entrada externa: [record-automation-savings-event/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/record-automation-savings-event/index.ts)
  - primeira extensao local: [suap-atividades-extension/popup.js](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/suap-atividades-extension/popup.js)
  - tabela: `automation_savings_events`
  - service agregador: [automationSavingsService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/automationSavingsService.ts)
  - pagina: [EconomiaTempo.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EconomiaTempo.tsx)
  - observacao: quando um cenario nao possui evento real no periodo, a pagina usa a estimativa mensal proporcional ao intervalo filtrado

### Normativos do Consultor

- fontes HTML oficiais e PDFs locais
  - extracao: [normativos-pipeline/pipeline/extract.py](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/normativos-pipeline/pipeline/extract.py)
  - chunking e embeddings: [normativos-pipeline/pipeline/process.py](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/normativos-pipeline/pipeline/process.py)
  - persistencia e log: [normativos-pipeline/pipeline/ingest.py](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/normativos-pipeline/pipeline/ingest.py)
  - tabelas:
    - `normativos`
    - `normativos_chunks`
    - `normativos_log`
  - busca: RPC `buscar_normativos`
  - consumidor frontend: [ConsultorSessions.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/ConsultorSessions.tsx)
  - backlog: [NORMATIVOS_CONSULTOR_INGESTION.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/integrations/NORMATIVOS_CONSULTOR_INGESTION.md)

### Almoxarifado

App.tsx  Almoxarifado.tsx  inventoryService  post_stock_movement  stock_movements / stock_movement_items  stock_balances.

Cadastros seguem inventoryService  operational_entities / measurement_units / catalog_items / warehouses. O saldo é sempre derivado do razão; não existe edição direta.
