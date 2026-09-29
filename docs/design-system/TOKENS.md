# TOKENS — Paretto Institucional

## Fontes de verdade

- `src/index.css`
- `tailwind.config.ts`
- `index.html` (carregamento das fontes)
- Referência de origem: design system do site Paretto Concursos (`Paretto-Concursos-Site/app/globals.css`), adaptado com viés institucional e **sem o mascote**.

O sistema usa um **tema único**. Os antigos temas SUAP (Padrão, IFs, Aurora, Dunas, Gov.br, Luna, Alto Contraste e Modo Daltonismo), o atributo `data-suap-theme` e o seletor `SuapThemeSwitcher` foram removidos. Não há modo escuro ativo: classes `dark:` remanescentes em páginas são inertes.

## Tipografia

- **Interface**: `Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif` (pesos 400–800).
- **Dados e códigos (monospace)**: `IBM Plex Mono, Monaco, Consolas, monospace` com `font-variant-numeric: tabular-nums`.
- **Títulos**: `h1` 28px / `800` / tracking `-0.02em`; `h2` 24px / `800`; `h3` 16–18px / `700`.
- **Rótulos e eyebrows**: 10–11px, `700`, caixa alta, tracking `0.14em–0.2em`, cor `muted-foreground`.
- A fonte manuscrita do Paretto (Caveat) **não** é usada: não combina com o viés institucional.

## Paleta

| Token | Valor | Uso |
| --- | --- | --- |
| `--background` | `#F6F8FA` | fundo da aplicação |
| `--foreground` | `#122B40` | texto principal |
| `--card` / `--popover` | `#FFFFFF` | superfícies |
| `--border` / `--input` | `#DCE5EB` | divisores e contornos |
| `--muted` / `--secondary` | `#EEF3F6` | superfícies de apoio, cabeçalho de tabela |
| `--muted-foreground` | `#5D7282` | texto secundário (5:1 sobre branco) |
| `--primary` / `--ring` | `#007F91` (teal) | links, ícones ativos, foco, badges de marca |
| `--accent` / `--accent-foreground` | `#EAF6F6` / `#006C79` | hover e seleção suaves, item ativo da sidebar |
| `--brand-navy` | `#0B2945` | ação principal (`Button` default, `.btn-primary`), avatar, página ativa da paginação, cards de destaque |
| `--brand-cyan` | `#00B7DC` | realces em gráficos |
| `--brand-lime` | `#C9F263` | **acento discreto**: somente sobre navy ou como ponto/indicador (ex.: selo "Beta" da sidebar). Nunca como texto sobre branco. |
| `--success` | `#1F7A4D` | sucesso |
| `--warning` | `#8A5A00` | atenção |
| `--info` | `#0079A8` | informativo |
| `--destructive` | `#C0262D` | erro/perigo |

Classes Tailwind correspondentes: `bg-brand-navy`, `text-brand-navy-foreground`, `bg-brand-lime`, `text-brand-lime`, `text-brand-cyan`, `bg-brand-teal` (alias de `primary`).

Aliases legados (`ifrn-green`, `sebrae-blue`, `sebrae-navy`, `sebrae-gold`) continuam existindo, mapeados para a paleta atual. As cores `suap-*` foram removidas.

## Forma e elevação

- `--radius`: `0.625rem` (10px). Botões e inputs usam `rounded-lg`; cards e painéis `rounded-xl` (12px); badges permanecem em pílula.
- Sombras tingidas de navy e discretas: `--shadow-xs` a `--shadow-xl` e `--shadow-primary`. As utilidades Tailwind `shadow-xs`, `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-soft`, `shadow-card`, `shadow-lifted`, `shadow-float` e `shadow-primary` apontam para essas variáveis.
- Cards não se deslocam no hover; apenas reforçam a sombra/borda.
- Gradientes: `--gradient-primary` (navy), `--gradient-accent` (teal), `--gradient-warning` (âmbar), `--gradient-card`.

## Diretrizes para gráficos (Recharts)

- **Linhas de grade**: `stroke="hsl(var(--border))"`.
- **Eixos**: `tick={{ fill: 'currentColor', fontSize: 12 }}` com `className="text-muted-foreground"`.
- **Séries**: preferir, nesta ordem, navy `#0B2945`, teal `#007F91`, ciano `#00B7DC`, âmbar `#B07A0E` e as cores semânticas.
- **Tooltips**: `bg-card border border-border text-foreground shadow-lg`.

## Componentes e padrões

- **Botões**: cantos de 8px (`rounded-lg`), peso `700`, altura 36px. `default`/`suap` em navy; `brand` em teal; `outline` branco com borda; `lime` reservado a um único CTA sobre superfície navy.
- **Badges**: pílula com borda de 1px, fundo translúcido (10%) e texto na cor semântica.
- **Tabelas**: cabeçalhos em `bg-muted`, hover de linha `row-hover` em `accent`.
- **Sidebar**: fundo branco, itens em `sidebar-foreground`, item ativo em `sidebar-accent` com ponto teal à direita; rótulos de grupo em caixa alta espaçada.
- **Header**: 64px, fundo branco sólido, busca `rounded-lg` sobre `background`.
- **Marca**: logotipo institucional do SIAGES + selo "Beta" navy/lima. O símbolo "P" e o mascote do Paretto **não** são usados.
