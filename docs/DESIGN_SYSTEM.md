# Design System - GovAnalytics

Este documento define o padrao visual atual do sistema. A revisao mais recente manteve parte da simplificacao estrutural dos componentes, mas restaurou a identidade visual anterior: verde institucional como cor primaria, dashboard multicolorido e shell com sidebar.

Esta documentacao foi atualizada porque a mudanca altera comportamento visual real em area critica de design system.

## Principios

- O verde institucional `#2f9e41` e a cor principal para acoes, estados ativos, foco e navegacao.
- O dashboard pode usar a paleta analitica anterior: azul, verde, roxo, amber, rosa, indigo e teal.
- O shell global usa sidebar fixa/colapsavel em desktop e drawer lateral em mobile.
- O texto principal usa `#34322d`; texto secundario usa `#858481`.
- Fundos permanecem claros, com cards brancos, bordas discretas e sombras suaves.
- Gradientes e efeitos herdados podem existir apenas quando fazem parte da linguagem legada controlada, como `--gradient-primary`, `--shadow-primary` e a textura leve de `app-bg-soft`.

## Fundacao

Fontes:

- Interface: `Open Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Dados e codigos: `IBM Plex Mono`.
- Peso padrao de texto: 500.

Tokens principais:

- `--primary`: verde institucional `#2f9e41`.
- `--foreground`: ink legado `#34322d`.
- `--background` e `--card`: branco.
- `--muted`: superficie suave.
- `--border`: divisor claro.
- `vibrant-blue`: `#1a5ce6`.
- `purple`: `#7c3aed`.
- `amber`: `#f59e0b`.
- `emerald-green`: `#2f9e41`.
- `destructive`: vermelho de erro.

## Layout

- `src/components/Layout.tsx` e o shell oficial.
- Desktop usa sidebar com grupos expansivos derivados de `appScreenGroups` e `appScreens`.
- A sidebar pode ser recolhida; itens recolhidos exibem tooltip.
- Mobile usa botao de menu no topo e overlay lateral, preservando todos os itens disponiveis pelas permissoes.
- O topo interno fica reservado para `HeaderActions` e subtitulo de pagina.
- O conteudo usa `app-bg-soft` e largura maxima operacional de `1600px`.

## Componentes

- `Button`: primario em verde; secundarios em branco com borda.
- `Card`: branco, borda clara, radius consistente e sombra suave quando necessario.
- `Input` e `Select`: branco, borda clara, foco verde.
- `Table`: cabecalho suave, linhas com divisor claro e texto denso.
- `StatCard`: tons `default`, `primary`, `plus`, `luxe` e `error`; o legado `stitchColor` segue aceito para compatibilidade.
- `SectionPanel`, `FilterPanel`, `DataTablePanel`, `ChartPanel` e `TablePagination` sao os blocos oficiais de composicao.
- A pagina `/credito-disponivel` reutiliza `StatCard`, `FilterPanel`, `DataTablePanel` e `TablePagination` para exibir o relatorio detalhado sem introduzir tokens visuais novos.

## Regras

- Nao substituir a sidebar por top nav sem validar cobertura de todos os itens de menu.
- Preservar a paleta verde institucional e as cores analiticas do dashboard.
- Nao criar componentes visuais ad hoc quando houver componente em `src/components/design-system`.
- Se uma mudanca alterar comportamento visual real, atualizar este documento e os arquivos em `docs/design-system`.

## Prototipo Cloudscape-inspired isolado

A rota `/dashboard-cloudscape-preview` e um prototipo navegavel separado do dashboard oficial (`/`). Ela combina um shell operacional inspirado no Cloudscape (cabecalho compacto, abas, paineis neutros e filtros em drawer) com os tokens institucionais existentes. Os KPIs, tabelas e filtros consomem o `DataContext` real; os graficos continuam em Recharts para preservar a leitura atual. O prototipo nao altera a navegacao nem o comportamento da rota de producao.
