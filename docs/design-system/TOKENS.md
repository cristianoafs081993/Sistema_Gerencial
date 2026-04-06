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

### Sombras

- `--shadow-xs`
- `--shadow-sm`
- `--shadow-md`
- `--shadow-lg`
- `--shadow-xl`
- `--shadow-primary`

### Glass e gradientes

- `--glass-border`
- `--glass-bg`
- `--glass-highlight`
- `--gradient-primary`
- `--gradient-accent`
- `--gradient-warning`
- `--gradient-card`

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
