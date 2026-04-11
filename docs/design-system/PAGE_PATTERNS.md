# PAGE_PATTERNS

## Objetivo

Padronizar a composicao das telas mais comuns do sistema.

## Shell global

O shell principal em [Layout.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/Layout.tsx) segue a etapa atual do redesign inspirado na referencia externa:

1. sidebar clara com agrupamento por secao
2. item ativo em verde com fundo suave
3. header e sidebar brancos, com divisorias suaves
4. fundo da area principal branco, com apenas um vestigio de verde IFRN no topo
5. tipografia do shell com titulos em `#34322d`, subtitulos em `#858481` e labels de secao em neutro escuro `#1a1a19`
6. header global sem titulo da pagina; a identificacao da pagina deve ficar no conteudo ou nos paineis

## Textos e encoding

- textos de interface, exemplos e documentacao do design system devem ser mantidos em UTF-8 legivel, com acentos reais em portugues
- nao commitar mojibake em labels, titulos, mensagens, comentarios ou documentacao; exemplos tipicos sao acentos renderizados como sequencias iniciadas por `A`/`C` com til visual ou simbolos renderizados como tres caracteres no lugar de travessao, seta ou triangulo
- quando uma importacao precisar aceitar cabecalhos externos com encoding quebrado, normalize isso na borda do parser e nao copie o texto quebrado para componentes visuais
- depois de alterar copy de UI ou documentacao do design system, rode `npm test -- src/__tests__/encoding.test.ts` para barrar regressao de encoding

## Padrao 1: tabela operacional

Estrutura recomendada:

1. `HeaderActions`
2. `FilterPanel`
3. `DataTablePanel`
4. `TablePagination`

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
