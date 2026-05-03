# TOKENS

## Fontes de verdade

- `src/index.css`
- `src/manus-stage1.css`
- `tailwind.config.ts`

`src/manus-stage1.css` voltou a ser importado pelo runtime para restaurar a paleta verde, sombras e fundos legados solicitados.

Esta documentacao foi atualizada porque a mudanca altera comportamento visual real em area critica de design system.

## Tipografia

- Interface: `Open Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Dados e codigos: `IBM Plex Mono`.
- Peso base: 500.
- Headings usam 600 ou 700.

## Cores

- Verde institucional: `#2f9e41`, acao primaria, estado ativo e foco.
- Verde ativo: derivado HSL `130 54% 34%`, hover/active de acao primaria.
- Azul vibrante: `#1a5ce6`, graficos e destaques analiticos.
- Roxo: `#7c3aed`, graficos e destaques analiticos.
- Amber: `#f59e0b`, alertas leves e funil do dashboard.
- Branco: `#ffffff`, fundo e cards.
- Cinza suave: superficies secundarias.
- Borda clara: divisores e contornos.
- Ink legado: `#34322d`, texto principal.
- Cinza secundario: `#858481`, texto de apoio.
- Erro: vermelho destrutivo.

## Tokens semanticos

- `--background`: branco.
- `--foreground`: `#34322d`.
- `--card`: branco.
- `--border` e `--input`: divisor claro.
- `--muted`: superficie suave.
- `--primary`: verde institucional.
- `--success`: verde institucional.
- `--warning`: amber.
- `--info`: azul.
- `--destructive`: vermelho de erro.

## Sombras e efeitos

- `--shadow-sm`, `--shadow-md`, `--shadow-lg` e `--shadow-xl` preservam a elevacao suave anterior.
- `--shadow-primary` usa verde com baixa opacidade.
- `--gradient-primary`, `--gradient-accent` e `--gradient-warning` existem para compatibilidade com superficies legadas.
- `app-bg-soft` aplica fundo claro com textura radial leve.

## Classes recorrentes

- `card-system`: painel branco com borda clara.
- `filter-panel`: area de filtros no mesmo padrao de card.
- `table-title` e `table-description`: titulos de painel.
- `input-system`: campo com foco verde.
- `stat-card`: KPI com tom opcional ou `stitchColor` legado.
- `table-pagination`: rodape de tabela com divisor superior.
- `pending-field-marker`: destaque inline para `[CAMPO PENDENTE]`, usando vermelho destrutivo com fundo de baixa opacidade.
- `Layout`: sidebar branca de 248px, divisor `#dddddd`, grupos sem contorno de card, item ativo com superficie `#f7f7f7` e texto reforcado.

## Atualizacao de artefatos

- A pagina `/artefatos-licitacao` nao introduz novos tokens; ela reutiliza `card-system`, `filter-panel`, `table-title`, `table-description`, `input-system`, badges e botoes iconicos existentes.
