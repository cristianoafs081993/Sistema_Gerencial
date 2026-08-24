# COMPONENT_CATALOG

Este catalogo resume os blocos oficiais do design system do GovAnalytics.

Esta documentacao foi atualizada porque a mudanca altera comportamento visual real em area critica de design system.

## Blocos de pagina

### `SectionPanel`

Arquivo: `src/components/design-system/SectionPanel.tsx`

Container padrão para seções com título, descrição, ações, rodapé opcional e conteúdo. Usa superfície branca, borda clara, rodapé integrado com linha divisória e raio consistente.

### `FilterPanel`

Arquivo: `src/components/design-system/FilterPanel.tsx`

Area padronizada de filtros. Deve ser usada antes de tabelas e consultas operacionais. Suporta slot de rodapé opcional (`footer`).

### `ActiveFilterChips`

Arquivo: `src/components/design-system/ActiveFilterChips.tsx`

Barra institucional de chips e tags para filtros ativos (Eixo 04). Exibe badges individuais com remoção (`X`), botão "Limpar filtros" e contador comparativo de registros filtrados (`totalCount` / `filteredCount`).

### `DataTablePanel`


Arquivo: `src/components/design-system/DataTablePanel.tsx`

Wrapper oficial de tabela baseado em `SectionPanel`, com overflow horizontal padronizado.

### `ChartPanel`

Arquivo: `src/components/design-system/ChartPanel.tsx`

Painel para graficos. Deve aceitar a paleta analitica do dashboard quando o contexto pedir comparacao visual.

### `TableSkeletonRows`

Arquivo: `src/components/design-system/TableSkeletonRows.tsx`

Skeleton reutilizavel para linhas tabulares.

### `RouteLoadingFallback`

Arquivo: `src/components/design-system/RouteLoadingFallback.tsx`

Fallback acessivel para rotas carregadas sob demanda. O modo `screen` ocupa a viewport em paginas publicas e o modo `content` preserva o shell global nas paginas autenticadas. Ambos exibem mensagem visivel e anunciam o carregamento com `role="status"`, `aria-live="polite"` e `aria-busy`.

### `TablePagination`

Arquivo: `src/components/design-system/TablePagination.tsx`

Rodape de tabela com seletor de quantidade, paginas e navegacao.

## Componentes base

- `Button`: estilo *pill* arredondado (`rounded-full`), 36px de altura padrão, com variantes `default` (primária do tema SUAP), `secondary`, `destructive`, `outline`, `ghost`, `link` e `suap`.
- `Card`: superfície limpa (`bg-card`) com bordas sutis (`border-border`), raio de 12px e sombra suave.
- `Input`, `Textarea`, `Select`: superfícies neutras, borda suave, foco na cor primária do tema ativo do SUAP (`ring-primary/20`).
- `Badge`: padrão `span.status` do SUAP, formato pílula com borda de 1px, fundo translúcido e texto contrastado (`success`, `warning`, `danger`, `info`, `brand`).
- `Tabs`: abas segmentadas com realce ativo na cor primária do tema SUAP.
- `Dialog`, `Sheet`, `Popover`, `DropdownMenu`: superfícies de alta legibilidade com elevação suave.
- `SuapThemeSwitcher`: componente seletor no Header que permite alternar instantaneamente entre os 8 temas oficiais do SUAP (Padrão, IFs, Aurora, Dunas, Gov.br, Luna Dark, Alto Contraste, Modo Daltonismo).
- `RichTextEditor`: editor TipTap do fluxo de documentos; oferece negrito, itálico, sublinhado, listas, alinhamento, desfazer e refazer. Pode destacar marcadores `[CAMPO PENDENTE]` e, quando a página solicitar, placeholders entre colchetes com o token destrutivo.
- `ArtefatosLicitacao`: pagina operacional que combina `SectionPanel`, `FilterPanel`, `DataTablePanel`, badges de tipo e botoes iconicos para abrir, copiar, baixar DOCX e excluir artefatos.
- `LicitacoesPregoes`: pagina operacional que combina `FilterPanel` rotulado em grade responsiva com campos de UASG, objeto, item e busca geral, `DataTablePanel`, `TablePagination`, badges de prazo/status e modal centralizado de detalhe para compras PNCP; a UASG e opcional na consulta institucional e nao ha card de resumo acima dos filtros.
- `AtasRegistroPrecos`: pagina operacional que combina `FilterPanel`, `DataTablePanel`, `TablePagination`, badges de vigencia com contagem de dias restantes, filtro de atas vigentes, badges de vinculo/cobertura de itens com hover de participantes, modal centralizado com cards consolidados de execucao financeira, barras de saldo por item cruzadas com Comprasnet Contratos, SIAFI e Transparência, expansão de itens ao clicar na linha para exibir detalhamento dos empenhos vinculados e atalho para inspeção via `EmpenhoDialog`, além de links diretos ao PNCP.
- `CreditoDisponivel`: pagina operacional que combina `FilterPanel`, `DataTablePanel` e `TablePagination` para leitura do saldo por PTRES/PI, permitindo clicar em qualquer linha ou botão de ação para abrir o modal de drill-down `CreditoDisponivelMovimentacoesModal`.
- `CreditoDisponivelMovimentacoesModal`: modal de drill-down do Relatório de Crédito Disponível. Ao clicar em uma linha da tabela, abre diretamente na aba de empenhos do ano corrente (desconsiderando RAPs/exercícios anteriores e ordenando os empenhos do mais recente para o mais antigo), exibindo os KPI cards da origem (Crédito Disponível SIAFI, Total Descentralizado, Empenhado no Ano e Saldo a Executar), busca textual, filtro rápido por PI e abas segmentadas para visualização detalhada dos empenhos do ano vinculados àquele PTRES (número/processo, favorecido, PI/ND, descrição, status, empenhado/liquidado, saldo e atalho de inspeção via `EmpenhoDialog`) e de todas as descentralizações (data, dimensão, NC/operação, PI, ND, descrição e valor).
- `ContratoApiDetailsSheet`: drawer lateral de detalhes de contratos API com resumo visual no topo e secoes em `Accordion`, fechadas inicialmente; faturas permitem alternar o agrupamento por item ou por fatura.
- `DashboardContractExecutionTab`: aba analitica dedicada a contratos no dashboard, com Heatmap inicialmente filtrado por `Servicos Continuados (Mao de Obra Exclusiva)`, seletor global por bolhas clicaveis, grafico mensal de faturas e bullet chart de projecao anual frente ao empenhado com hover de rastreabilidade.
- `DashboardRapAnnualEvolutionPanel`: painel da aba RAP com `ChartPanel`, seletor de UG, upload CSV restrito a superadmin, grafico anual combinado e tabela resumida do historico agregado.
- `DashboardRapOrigemEmpenhosModal`: modal de drill-down da tabela "Resumo de RAPs por Origem" da aba RAP do Dashboard. Ao clicar em qualquer linha de origem/PTRES, abre modal com KPI cards resumidos da origem e tabela direta com os empenhos que possuem saldo remanescente (NE, favorecido, processo/PI, descrição, inscrito/reinscrito, liquidado no ano, saldo atual em destaque e ação para inspecionar o empenho completo via `EmpenhoDialog`).
- `DashboardOrigemAtividadesModal`: modal de drill-down da tabela "Detalhamento por Origem" da aba Exercício Corrente do Dashboard. Ao clicar em qualquer linha de origem/PTRES, abre modal com cards financeiros da seleção atual (planejado, empenhado e saldo), sendo o saldo oficial `saldo_disponivel` capturado da coluna "Saldo disponível para empenho da atividade" do Plano 8 do SUAP; inclui busca textual, alternador para visualizar apenas atividades com saldo remanescente ou todas as atividades, tabela com código, descrição, dimensão/componente, PI/ND, planejado, empenhado (com quantidade de empenhos), saldo em destaque e ação para visualização e edição direta da atividade via `AtividadeDialog`.
- `EnergiaCampus`: pagina analitica-operacional que combina `StatCard`, `ChartPanel`, `SectionPanel`, `DataTablePanel`, filtros no `HeaderActions` e upload XLSX restrito a superadmin.
- `PesquisaPrecos`: fluxo operacional em etapas que combina breadcrumb contextual clicavel com wizard, menu de exportacao, `SectionPanel`, painel de personalizacao institucional do relatorio, painel compacto de metodos de calculo, seletor horizontal de itens, sugestoes CATMAT/CATSER confirmaveis, barra compacta com icone sanduiche para abrir/retrair o painel de filtros avancados da cesta oficial e aplicar filtros a selecao mediante justificativa obrigatoria, `DataTablePanel` para revisar ate 100 referencias e previa integral do documento PDF/HTML em `iframe` isolado; `Observacoes` e editado na identificacao, enquanto `Alertas e conformidade` permanece como painel operacional externo e ausente de todas as exportacoes. Quando um item esta aberto, o topo exibe `Itens > Nome do item`, o link `Itens` retorna a lista, a entrada normal na etapa Itens sempre abre a lista antes das cotacoes, a busca oficial pendente preserva a estrutura com skeletons e bloqueia acoes dependentes, falhas oferecem nova tentativa, motivos positivos da IA ou estados sem alerta nao geram cards ou avisos visuais, e a atualizacao monetaria global fica no rodape discreto do painel de metodos com aviso transitorio sobre o mes atual.
- `SupplierEmailDialog`: modal de solicitacao de cotacao de `PesquisaPrecos`, com cabecalho, corpo e rodape no mesmo padrao dos modais operacionais; o rodape oferece a acao secundaria `Historico de e-mails`, que abre um modal dedicado com os disparos registrados da pesquisa.
- `PriceResearchValidation`: tela operacional de validação do QR Code da pesquisa de preços, baseada em `HeaderSubtitle`, `SectionPanel`, badges de status e blocos compactos para comparar hash informado e hash recalculado.
- `PriceResearchEad`: subpagina operacional de capacitacao do modulo Pesquisa de Precos, com `HeaderSubtitle`, `SectionPanel`, lista de aulas, player responsivo 16:9 em iframe `youtube-nocookie.com` e painel de gestao exibido apenas para superadministrador.
- `RequisicaoCompra`: pagina operacional que apresenta "Gestão de Requisições de Compra" no header global por meio de `HeaderSubtitle`, sem repetir o titulo na area de conteudo. O formulario usa filtro separado de favorecido e `Empenho / Nota de Empenho` em `Popover + Command` com selecao multipla, relevancia para numero completo da NE, contador no trigger e badges removiveis; os itens ficam agrupados por NE selecionada com saldo, carregamento e botao `Adicionar Item` em cada grupo.
- `CommandPalette`: central de comandos e busca instantânea acionada por `Ctrl+K` ou `Cmd+K` e pelo cabeçalho global. Suporta busca direta por entidades com preview de saldos: pesquisa de Empenhos por número (ex: `2026NE...`), credor, processo ou PI com exibição de saldo disponível em tempo real, omitindo empenhos com saldo zero, e abertura imediata do `EmpenhoDialog`; pesquisa de Contratos por número, fornecedor ou objeto com abertura imediata do modal centralizado `ContratoApiDetailsSheet`; atalhos por prefixo (`ne `, `empenho `, `contrato `, `tela `, `acao `) e chips de escopo; atalhos para todos os módulos permitidos e ações rápidas (Nova Requisição, Pesquisa de Preços, Sincronizar SUAP).
- `ContratoApiDetailsSheet`: modal centralizado (`Dialog`) de alta performance e acessibilidade para exibição detalhada de contratos, contendo métricas gerais de valor acumulado e executado, vigência, objeto, unidade de origem, histórico de termos aditivos, detalhamento por item/fatura com agrupamento em abas e faturas vinculadas.
- `Layout`: shell global com sidebar responsiva com suporte a modo expandido (`w-72`) e modo compacto (*Rail Mode* `w-18`) com persistência em `localStorage`, tooltips flutuantes nos ícones, campo de busca com atalho visual `Ctrl K`, seletor de temas do SUAP (`SuapThemeSwitcher`) e drawer mobile.
- `NotificationCenter`: central de notificações ativa ancorada no cabeçalho global (`Layout`). Exibe menu suspenso (`Popover`) com indicador visual de novidades (ponto verde animado e badges), feed unificado e limpo com os **últimos 20 eventos orçamentários** (empenhos emitidos e descentralizações de crédito consolidados cronologicamente na mesma lista pela data de criação `createdAt`), status de liquidação/pagamento, valores monetários formatados, inspeção direta de empenhos via `EmpenhoDialog` e ação de marcar todas como lidas.

- `AIAssistantWidget`: widget flutuante global de chat com IA para consultas gerenciais em linguagem natural sobre contratos, empenhos, orçamento, energia e conciliação; inclui alternador de tamanho (expandir/recolher), sugestões dinâmicas de perguntas, fontes consultadas, histórico persistido localmente por usuário autenticado e suporte completo a markdown.
- `SuapeCommandPalette` (extensao 1.9.22): central de comandos e busca flutuante global na extensão do SUAP (`command-palette.js` e `command-palette.css`) disparada por `Ctrl+K` ou `Cmd+K`. Inclui botão direto para alternar entre os modos **Claro** e **Escuro** com persistência no `localStorage` e suporte automático a temas do SUAP (`theme-luna`). Focada no acesso rápido a **Empenhos** (com saldo em tempo real, credor, PI, processo, omitindo empenhos com saldo zero, e modal de detalhamento com métricas de execução) e **Contratos Ativos** (com consulta à API Comprasnet, valores, modal de detalhamento com histórico de aditivos e abas Fatura/Item com Fatura como padrão).



- `ComprasnetEtpAssistant` (extensão 1.9.21): botão adicional `br-button secondary small` na tela oficial de ETP e modal responsivo com iframe isolado, dimensionado em harmonia com os botões nativos (`Voltar` e `Concluir ETP`). O cabeçalho dispõe de botão com ícone de engrenagem para abrir as configurações da minuta (`Configurar minuta`) e campo de número do processo com botão `Buscar processo` alinhado em linha. Usa `br-card`, `br-input`, alertas, estados de foco e tokens computados do próprio Comprasnet. A prévia completa marca as demais seções somente como referência e permite aplicar exclusivamente a seção atual. O painel não oferece modo escuro próprio, não altera o `body` da página e nunca aciona `Concluir ETP`.
- `SuapePlanTableHeaders` (extensão 1.9): cabeçalhos das tabelas originais do Plano de Atividades concluído 8 viram botões de ordenação acessíveis, com indicador visual reforçado. O filtro `Exibir somente atividades com saldo` permanece no card nativo de filtros do SUAP.

### Revisão de documentos SUAP

`siages-suap-document-ai-button` é um botão iconográfico compacto inserido dentro do card nativo do documento. Usa foco visível, `aria-label`, estado de carregamento e os mesmos tokens isolados `--suape-*` do toolkit. O modal de análise é exibido no iframe do SIAGES e mantém a página SUAP ao fundo. Os resultados são somente leitura: achados, fontes, limitações e texto sugerido, sem aplicação automática. Cada achado é exibido em uma seção colapsável fechada inicialmente; o resumo oferece ações para baixar a análise em HTML, imprimir e alternar entre os modos claro e escuro. O fechamento é feito por um único botão iconográfico dentro do iframe.

## Regra pratica

- Filtros: `FilterPanel`.
- Tabela: `DataTablePanel` + `TablePagination`.
- Secao: `SectionPanel`.
- Grafico: `ChartPanel`.
- KPI: `StatCard` com `tone` ou `stitchColor` legado.



- Almoxarifado: página operacional que combina HeaderActions, StatCard, FilterPanel, DataTablePanel, Tabs e Dialog para catálogo, saldos e movimentos, com estados explícitos de estoque crítico.
O acordeao Resumo financeiro por dimensao segue a estrutura nativa do SUAP e exibe os totais das quatro colunas financeiras agrupados por dimensao.

- Na revisão de documentos SUAP, o ícone de histórico fica ao lado do ícone de geração e carrega a última análise salva sem baixar novamente o PDF.
