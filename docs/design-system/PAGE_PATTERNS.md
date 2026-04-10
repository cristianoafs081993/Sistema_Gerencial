# PAGE_PATTERNS

## Objetivo

Padronizar a composicao das telas mais comuns do sistema.

## Padrao 1: tabela operacional

Estrutura recomendada:

1. `HeaderActions`
2. `FilterPanel`
3. `DataTablePanel`
4. paginacao/rodape

Exemplos:

- [Financeiro.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Financeiro.tsx)
- [RetencoesFdReinfDesign.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/RetencoesFdReinfDesign.tsx)

## Padrao 2: pagina de consulta com cards e tabela

Estrutura recomendada:

1. `HeaderActions`
2. grid de `StatCard`
3. `FilterPanel`
4. tabela principal

Exemplos:

- [RastreabilidadePFs/index.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/RastreabilidadePFs/index.tsx)
- [LiquidacoesPagamentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/LiquidacoesPagamentos.tsx)

## Padrao 3: pagina com importacao de arquivo

Estrutura recomendada:

1. `HeaderActions` com upload
2. informacao de arquivo atual
3. tabela ou cards derivados

Exemplos:

- [Financeiro.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Financeiro.tsx)
- [LC.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/LC.tsx)

## Padrao 4: dashboard analitico

Estrutura recomendada:

1. filtros globais
2. cards KPI
3. blocos de grafico com `ChartPanel`
4. tabelas ou cards secundarios

Exemplo:

- [Dashboard.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Dashboard.tsx)

## Anti-padroes

- criar card ad hoc se `SectionPanel` ou `DataTablePanel` ja resolvem
- inventar skeleton proprio para tabela quando `TableSkeletonRows` ja atende
- abrir rota nova com visual paralelo sem passar pelo design system
