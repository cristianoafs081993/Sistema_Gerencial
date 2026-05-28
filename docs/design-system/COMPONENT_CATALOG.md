# COMPONENT_CATALOG

Este catalogo resume os blocos oficiais do design system do GovFlow.

Esta documentacao foi atualizada porque a mudanca altera comportamento visual real em area critica de design system.

## Blocos de pagina

### `SectionPanel`

Arquivo: `src/components/design-system/SectionPanel.tsx`

Container padrao para secoes com titulo, descricao, acoes e conteudo. Usa superficie branca, borda clara e radius consistente.

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
- `RichTextEditor`: editor TipTap do fluxo de documentos; pode destacar marcadores `[CAMPO PENDENTE]` com o token destrutivo quando a pagina habilitar revisao visual.
- `ArtefatosLicitacao`: pagina operacional que combina `SectionPanel`, `FilterPanel`, `DataTablePanel`, badges de tipo e botoes iconicos para abrir, copiar, baixar DOCX e excluir artefatos.
- `LicitacoesPregoes`: pagina operacional que combina `SectionPanel`, `FilterPanel`, `DataTablePanel`, `TablePagination`, badges de prazo/status e drawer lateral de detalhe para compras PNCP.
- `CreditoDisponivel`: pagina operacional que combina `StatCard`, `FilterPanel`, `DataTablePanel` e `TablePagination` para leitura do saldo por PTRES/PI e importacao CSV no header.
- `ContratoApiDetailsSheet`: drawer lateral de detalhes de contratos API com resumo visual no topo e secoes em `Accordion`, fechadas inicialmente; faturas permitem alternar o agrupamento por item ou por fatura.
- `DashboardContractExecutionTab`: aba analitica dedicada a contratos no dashboard, com seletor global por bolhas clicaveis, grafico mensal de faturas e bullet chart de projecao anual frente ao empenhado com hover de rastreabilidade.
- `Layout`: sidebar global compacta com campo de busca visual, grupos expansivos, submenus expansivos, indicador ativo lateral e drawer mobile.

## Regra pratica

- Filtros: `FilterPanel`.
- Tabela: `DataTablePanel` + `TablePagination`.
- Secao: `SectionPanel`.
- Grafico: `ChartPanel`.
- KPI: `StatCard` com `tone` ou `stitchColor` legado.
