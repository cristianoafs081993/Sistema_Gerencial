# TOKENS

## Fontes de verdade

- [index.css](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/index.css)
- [tailwind.config.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/tailwind.config.ts)

## Tipografia

Fontes observadas:

- `Public Sans`
- `Inter`
- `IBM Plex Mono`

Uso esperado:

- interface: `Public Sans`
- dados e codigos: `IBM Plex Mono`

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

- `--background`: off-white neutro e claro, hoje em torno de `#f7f8fa`
- `--muted`: apoio de superficie levemente mais visivel que o fundo, sem puxar o azul
- `--border` e `--input`: contraste suave, suficiente para formularios e divisorias sem pesar a tela

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

## Regra pratica

Ao documentar ou criar componentes novos:

- prefira nome semantico ao inves de valor bruto
- reutilize tokens de superficie, texto e acao
- evite cor ou sombra arbitraria fora da base definida em `index.css`
