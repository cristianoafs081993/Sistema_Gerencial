# TOKENS — Design system Céu (base Paretto)

## Fontes de verdade

- `src/index.css`
- `tailwind.config.ts`
- `index.html` (carregamento das fontes)
- Referência de origem: design system do site Paretto Concursos (`Paretto-Concursos-Site/app/globals.css`) para tipografia, forma e componentes, **sem o mascote**. A paleta foi clareada para transmitir leveza e modernidade: azul-céu como ação, superfícies brancas com leve tom azulado e ciano como realce.

O sistema usa um **tema único**. Os antigos temas SUAP (Padrão, IFs, Aurora, Dunas, Gov.br, Luna, Alto Contraste e Modo Daltonismo), o atributo `data-suap-theme` e o seletor `SuapThemeSwitcher` foram removidos. Não há modo escuro ativo: classes `dark:` remanescentes em páginas são inertes.

## Tipografia

- **Interface**: `Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif` (pesos 400–800).
- **Dados e códigos (monospace)**: `IBM Plex Mono, Monaco, Consolas, monospace` com `font-variant-numeric: tabular-nums`.
- **Títulos**: `h1` 28px / `800` / tracking `-0.02em`; `h2` 24px / `800`; `h3` 16–18px / `700`.
- **Rótulos e eyebrows**: 10–11px, `700`, caixa alta, tracking `0.14em–0.2em`, cor `muted-foreground`.
- A fonte manuscrita do Paretto (Caveat) **não** é usada.

## Paleta

| Token | Valor | Uso |
| --- | --- | --- |
| `--background` | `#F6F9FD` | fundo da aplicação |
| `--foreground` | `#1B2B3A` | texto principal |
| `--card` / `--popover` | `#FFFFFF` | superfícies |
| `--border` / `--input` | `#DDE6F0` | divisores e contornos |
| `--muted` / `--secondary` | `#EEF3F9` | superfícies de apoio, cabeçalho de tabela |
| `--muted-foreground` | `#5B6B7B` | texto secundário (5,5:1 sobre branco) |
| `--primary` | `#1976D2` | botões, links, abas e paginação ativas, avatar (4,6:1 com texto branco) |
| `--ring` / `--brand-sky` | `#1E88E5` | foco, barras de progresso, indicadores e séries de gráfico |
| `--accent` / `--accent-foreground` | `#EAF3FD` / `#1565C0` | hover e seleção suaves, item ativo da sidebar, selo "Beta" |
| `--brand-cyan` | `#00B7DC` | realce secundário (liquidado, gradientes) |
| `--brand-navy` | `#0B2945` | **somente** superfícies escuras — hoje, o painel lateral do login |
| `--success` | `#1F7A4D` | sucesso |
| `--warning` | `#9A5C00` | atenção |
| `--info` | `#0079A8` | informativo |
| `--destructive` | `#D03434` | erro/perigo |

`#1E88E5` não é usado como fundo de texto branco (contraste 3,7:1, abaixo de AA); nesses casos use `primary`.

Escala completa `brand-50` … `brand-900` (azul-céu, `brand-500` = `#1E88E5`, `brand-600` = `#1976D2`) disponível para telas com muitas variações de tom, como o Mapeamento de Processos; ela substituiu o antigo verde-esmeralda (`emerald-*`) e o `blue-*` avulso ali.

Classes Tailwind de marca: `bg-brand-sky`, `text-brand-sky`, `bg-brand-cyan`, `bg-brand-navy` (login). Aliases legados (`ifrn-green`, `sebrae-blue`, `sebrae-navy`, `sebrae-gold`) continuam existindo, mapeados para a paleta atual. As cores `suap-*` e o acento lima foram removidos.

## Forma e elevação

- `--radius`: `0.625rem` (10px). Botões e inputs usam `rounded-lg`; cards e painéis `rounded-xl` (12px); badges permanecem em pílula.
- Sombras azuladas e leves: `--shadow-xs` a `--shadow-xl` e `--shadow-primary`. As utilidades Tailwind `shadow-xs`, `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-soft`, `shadow-card`, `shadow-lifted`, `shadow-float` e `shadow-primary` apontam para essas variáveis.
- Cards não se deslocam no hover; apenas reforçam a sombra/borda.
- Gradientes: `--gradient-primary` (azul-céu), `--gradient-accent` (céu → ciano), `--gradient-warning` (âmbar), `--gradient-card`.

## Diretrizes para gráficos (Recharts)

- **Linhas de grade**: `stroke="hsl(var(--border))"`.
- **Eixos**: `tick={{ fill: 'currentColor', fontSize: 12 }}` com `className="text-muted-foreground"`.
- **Séries**: preferir, nesta ordem, azul-céu `#1E88E5`, ciano `#00B7DC`, azul profundo `#1565C0`, âmbar `#F2A93B`, verde `#2E9E6A`, cinza-azulado `#7C8DA6`.
- **Velocímetros (`GaugeChart`)**: mantêm a escala semântica vermelho → âmbar → verde.
- **Tooltips**: `bg-card border border-border text-foreground shadow-lg`.

## Componentes e padrões

- **Botões**: cantos de 8px (`rounded-lg`), peso `700`, altura 36px. `default`/`suap`/`brand` em `primary`; `outline` branco com borda.
- **Badges**: pílula com borda de 1px, fundo translúcido (10%) e texto na cor semântica.
- **Tabelas**: cabeçalhos em `bg-muted`, hover de linha em `accent`, números tabulares.
- **Sidebar**: fundo branco, itens em `sidebar-foreground`, item ativo em `sidebar-accent` com ponto azul à direita; rótulos de grupo em caixa alta espaçada.
- **Header**: 64px, fundo branco sólido, busca `rounded-lg` sobre `background`.
- **Login**: painel lateral escuro (navy com brilho azul) mantido para contraste de entrada; formulário claro.
- **Marca**: logotipo institucional do SIAGES + selo "Beta" em `accent`. O símbolo "P" e o mascote do Paretto **não** são usados.
