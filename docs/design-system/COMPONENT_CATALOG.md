# COMPONENT_CATALOG

Este catalogo resume os blocos oficiais do design system do GovAnalytics.

Esta documentacao foi atualizada porque a mudanca altera comportamento visual real em area critica de design system.

## Blocos de pagina

### `SectionPanel`

Arquivo: `src/components/design-system/SectionPanel.tsx`

Container padrão para seções com título, descrição, ações, rodapé opcional e conteúdo. Usa superfície branca, borda clara, rodapé integrado com linha divisória e raio consistente.

### `FilterPanel`

Arquivo: `src/components/design-system/FilterPanel.tsx`

Area padronizada de filtros. Deve ser usada antes de tabelas e consultas operacionais.

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

- `Button`: verde institucional para acao primaria; branco com borda para acoes secundarias.
- `Card`: superficie branca com borda clara.
- `Input`, `Textarea`, `Select`: branco, borda clara, foco verde.
- `Badge`: pill neutro; variantes usam status semanticos e baixa opacidade.
- `Tabs`: segmentado com ativo verde quando usado em paginas operacionais.
- `Dialog`, `Sheet`, `Popover`, `DropdownMenu`: superficies brancas com elevacao suave.
- `RichTextEditor`: editor TipTap do fluxo de documentos; oferece negrito, italico, sublinhado, listas, alinhamento, desfazer e refazer. Pode destacar marcadores `[CAMPO PENDENTE]` e, quando a pagina solicitar, placeholders entre colchetes com o token destrutivo.
- `ArtefatosLicitacao`: pagina operacional que combina `SectionPanel`, `FilterPanel`, `DataTablePanel`, badges de tipo e botoes iconicos para abrir, copiar, baixar DOCX e excluir artefatos.
- `LicitacoesPregoes`: pagina operacional que combina `FilterPanel` rotulado em grade responsiva com campos de UASG, objeto, item e busca geral, `DataTablePanel`, `TablePagination`, badges de prazo/status e drawer lateral de detalhe para compras PNCP; a UASG e opcional na consulta institucional e nao ha card de resumo acima dos filtros.
- `AtasRegistroPrecos`: pagina operacional que combina `FilterPanel`, `DataTablePanel`, `TablePagination`, badges de vinculo/cobertura de itens com hover de participantes, drawer lateral de detalhe e destaque inline do item que corresponde a busca.
- `CreditoDisponivel`: pagina operacional que combina `StatCard`, `FilterPanel`, `DataTablePanel` e `TablePagination` para leitura do saldo por PTRES/PI e importacao CSV no header.
- `ContratoApiDetailsSheet`: drawer lateral de detalhes de contratos API com resumo visual no topo e secoes em `Accordion`, fechadas inicialmente; faturas permitem alternar o agrupamento por item ou por fatura.
- `DashboardContractExecutionTab`: aba analitica dedicada a contratos no dashboard, com Heatmap inicialmente filtrado por `Servicos Continuados (Mao de Obra Exclusiva)`, seletor global por bolhas clicaveis, grafico mensal de faturas e bullet chart de projecao anual frente ao empenhado com hover de rastreabilidade.
- `DashboardRapAnnualEvolutionPanel`: painel da aba RAP com `ChartPanel`, seletor de UG, upload CSV restrito a superadmin, grafico anual combinado e tabela resumida do historico agregado.
- `EnergiaCampus`: pagina analitica-operacional que combina `StatCard`, `ChartPanel`, `SectionPanel`, `DataTablePanel`, filtros no `HeaderActions` e upload XLSX restrito a superadmin.
- `PesquisaPrecos`: fluxo operacional em etapas que combina breadcrumb contextual clicavel com wizard, menu de exportacao, `SectionPanel`, painel de personalizacao institucional do relatorio, painel compacto de metodos de calculo, seletor horizontal de itens, sugestoes CATMAT/CATSER confirmaveis, barra compacta com icone sanduiche para abrir/retrair o painel de filtros avancados da cesta oficial e aplicar filtros a selecao mediante justificativa obrigatoria, `DataTablePanel` para revisar ate 100 referencias e previa integral do documento PDF/HTML em `iframe` isolado; `Observacoes` e editado na identificacao, enquanto `Alertas e conformidade` permanece como painel operacional externo e ausente de todas as exportacoes. Quando um item esta aberto, o topo exibe `Itens > Nome do item`, o link `Itens` retorna a lista, a entrada normal na etapa Itens sempre abre a lista antes das cotacoes, a busca oficial pendente preserva a estrutura com skeletons e bloqueia acoes dependentes, falhas oferecem nova tentativa, motivos positivos da IA ou estados sem alerta nao geram cards ou avisos visuais, e a atualizacao monetaria global fica no rodape discreto do painel de metodos com aviso transitorio sobre o mes atual.
- `SupplierEmailDialog`: modal de solicitacao de cotacao de `PesquisaPrecos`, com cabecalho, corpo e rodape no mesmo padrao dos modais operacionais; o rodape oferece a acao secundaria `Historico de e-mails`, que abre um modal dedicado com os disparos registrados da pesquisa.
- `PriceResearchValidation`: tela operacional de validação do QR Code da pesquisa de preços, baseada em `HeaderSubtitle`, `SectionPanel`, badges de status e blocos compactos para comparar hash informado e hash recalculado.
- `PriceResearchEad`: subpagina operacional de capacitacao do modulo Pesquisa de Precos, com `HeaderSubtitle`, `SectionPanel`, lista de aulas, player responsivo 16:9 em iframe `youtube-nocookie.com` e painel de gestao exibido apenas para superadministrador.
- `RequisicaoCompra`: pagina operacional que apresenta "Gestão de Requisições de Compra" no header global por meio de `HeaderSubtitle`, sem repetir o titulo na area de conteudo. O formulario usa filtro separado de favorecido e `Empenho / Nota de Empenho` em `Popover + Command` com selecao multipla, relevancia para numero completo da NE, contador no trigger e badges removiveis; os itens ficam agrupados por NE selecionada com saldo, carregamento e botao `Adicionar Item` em cada grupo.
- `Layout`: sidebar global compacta com campo de busca visual, grupos expansivos, submenus expansivos, indicador ativo lateral e drawer mobile.
- `SuapeProcessToolkit` (extensao 1.9): painel lateral prefixado por `suape-`, inserido no topo do `<aside class="right">` da página de processos do SUAP, exibindo 4 abas no modo lateral (Resumo, Financeiro, IA e Configurações) e habilitando a 5ª aba (Atalhos) exclusivamente na visualização maximizada (`data-maximized="true"`). O cabeçalho possui botões de Minimizar (`−`/`⌄`) e Maximizar (`⛶`/`🗗`); a troca de tema permanece exclusiva na aba Configurações. Utiliza os tokens e paleta do Design System do SUAP (verde IFRN e superfícies neutras no modo claro/escuro) com distribuição limpa e sem sobreposição de texto.
- `SuapePlanTableHeaders` (extensão 1.9): cabeçalhos das tabelas originais do Plano de Atividades concluído 8 viram botões de ordenação acessíveis, com indicador visual reforçado. O filtro `Exibir somente atividades com saldo` permanece no card nativo de filtros do SUAP.

### Revisão de documentos SUAP

`siages-suap-document-ai-button` é um botão iconográfico compacto inserido dentro do card nativo do documento. Usa foco visível, `aria-label`, estado de carregamento e os mesmos tokens isolados `--suape-*` do toolkit. O modal de análise é exibido no iframe do SIAGES e mantém a página SUAP ao fundo. Os resultados são somente leitura: achados, fontes, limitações e texto sugerido, sem aplicação automática.

## Regra pratica

- Filtros: `FilterPanel`.
- Tabela: `DataTablePanel` + `TablePagination`.
- Secao: `SectionPanel`.
- Grafico: `ChartPanel`.
- KPI: `StatCard` com `tone` ou `stitchColor` legado.

- Almoxarifado: página operacional que combina HeaderActions, StatCard, FilterPanel, DataTablePanel, Tabs e Dialog para catálogo, saldos e movimentos, com estados explícitos de estoque crítico.
O acordeao Resumo financeiro por dimensao segue a estrutura nativa do SUAP e exibe os totais das quatro colunas financeiras agrupados por dimensao.
