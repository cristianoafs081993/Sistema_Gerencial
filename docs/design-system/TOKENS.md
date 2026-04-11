# TOKENS

## Fontes de verdade

- [index.css](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/index.css)
- [manus-stage1.css](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/manus-stage1.css)
- [tailwind.config.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/tailwind.config.ts)

## Tipografia

Fontes observadas:

- `Open Sans`
- `IBM Plex Mono`

Uso esperado:

- interface: `Open Sans`
- dados e codigos: `IBM Plex Mono`

Hierarquia atual:

- titulos principais: `Open Sans` 700 com tracking negativo curto
- titulos de painel e tabela: `Open Sans` 700, mais compactos e densos
- subtitulos e descricoes: `Open Sans` 400 em `#858481`
- labels/eyebrows: `Open Sans` 700 em caixa alta com espacamento amplo e neutro escuro proximo de `#1a1a19`
- shell e header: titulos principais em `#34322d`

## Tokens semanticos principais

### Cores

- `--background`
- `--foreground`
- `--card`
- `--border`
- `--muted`
- `--primary`
- `--accent`
- `--destructive`
- `--success`
- `--warning`
- `--info`

Base recomendada para a pagina:

- `--background`: branco puro, proximo de `#ffffff`
- `--primary` e `--accent`: verde IFRN, proximo de `#2f9e41`
- `--destructive`: vermelho forte, proximo de `#cd191e`
- `--muted`, `--border` e `--input`: neutros quase brancos, sem puxar para bege ou azul

### Sombras

- `--shadow-xs`
- `--shadow-sm`
- `--shadow-md`
- `--shadow-lg`
- `--shadow-xl`
- `--shadow-primary`

Regra visual:

- superfices em light mode devem depender mais de borda e contraste sutil do que de sombra pesada
- hover de cards deve sugerir interacao sem parecer flutuacao excessiva

### Glass e gradientes

- `--glass-border`
- `--glass-bg`
- `--glass-highlight`
- `--gradient-primary`
- `--gradient-accent`
- `--gradient-warning`
- `--gradient-card`

Regra visual:

- glass em light mode deve ficar proximo de uma superficie semitransparente, nao de um painel brilhante
- blur e highlight devem ser usados com contencao para nao adicionar peso desnecessario aos cards

## Classes semanticas recorrentes

- `card-system`
- `filter-panel`
- `table-title`
- `table-description`
- `input-system`
- `stat-card`
- `table-pagination`
- `table-pagination__label`
- `table-pagination__select`
- `table-pagination__page-chip`

Uso atual de superficies de apoio:

- shell principal deve usar branco ou quase branco, com verde apenas como respiro muito sutil
- tabelas e filtros devem usar branco ou quase branco, evitando `slate` azulado
- `input-system` deve parecer campo claro, com borda quente suave e foco verde IFRN
- `table-pagination` deve usar superficie branca, divisor sutil e navegacao compacta
- estados vazios e skeletons devem usar contraste baixo e neutros quentes

## Regra pratica

Ao documentar ou criar componentes novos:

- prefira nome semantico ao inves de valor bruto
- reutilize tokens de superficie, texto e acao
- evite cor ou sombra arbitraria fora da base definida em `index.css`
