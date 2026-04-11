# COMPONENT_CATALOG

Este catalogo resume os blocos principais do design system proprio do projeto.

## Base de referencia

- [DESIGN_SYSTEM.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/DESIGN_SYSTEM.md)
- [DesignSystemPreview.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/DesignSystemPreview.tsx)

## Blocos de pagina

### `SectionPanel`

Arquivo:

- [SectionPanel.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/design-system/SectionPanel.tsx)

Uso:

- container base para secoes de pagina
- aceita `title`, `description`, `actions`

Quando usar:

- secoes de leitura
- blocos de conteudo
- agrupamento visual de tabelas, listas e formularios
### `FilterPanel`

Arquivo:

- [FilterPanel.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/design-system/FilterPanel.tsx)

Uso:

- area padronizada de filtros com titulo e acoes

Quando usar:

- filtros de busca
- filtros tabulares
- filtros de auditoria
### `DataTablePanel`

Arquivo:

- [DataTablePanel.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/design-system/DataTablePanel.tsx)

Uso:

- wrapper de tabela baseado em `SectionPanel`
- aplica overflow horizontal padrao

Quando usar:

- qualquer tabela principal de listagem
### `ChartPanel`

Arquivo:

- [ChartPanel.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/design-system/ChartPanel.tsx)

Uso:

- cartao padronizado para graficos
- suporta estado `loading`

Quando usar:

- graficos do dashboard
- graficos analiticos em outras telas
### `TableSkeletonRows`

Arquivo:

- [TableSkeletonRows.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/design-system/TableSkeletonRows.tsx)

Uso:

- skeleton de linhas tabulares parametrizado por linhas, colunas e larguras

Quando usar:

- carregamento de tabelas assincronas

### `TablePagination`

Arquivo:

- [TablePagination.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/design-system/TablePagination.tsx)

Uso:

- rodape padronizado de tabela com seletor de quantidade, estado da pagina e navegacao
- suporta page size, total de itens e elipses entre paginas visiveis

Quando usar:

- qualquer tabela paginada do sistema
- tabelas operacionais e tabelas analiticas com mais de uma pagina

## Componentes de apoio frequentemente usados

- `StatCard`
- `HeaderActions`
- componentes `ui/*` do shadcn
## Regra pratica

Se uma tela nova precisa:

- filtros -> comece por `FilterPanel`
- secao com cabecalho -> comece por `SectionPanel`
- tabela -> comece por `DataTablePanel`
- grafico -> comece por `ChartPanel`
- loading tabular -> use `TableSkeletonRows`
- rodape paginado -> use `TablePagination`
