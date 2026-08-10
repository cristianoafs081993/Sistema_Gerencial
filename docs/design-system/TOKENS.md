# TOKENS

## Fontes de verdade

- `src/index.css`
- `tailwind.config.ts`

Os tokens visuais do antigo `src/manus-stage1.css` foram completamente incorporados e consolidados em `src/index.css` para servir como fonte única de verdade do Design System v3.0, assegurando a paleta institucional verde, sombras realçadas e fundos aprimorados em um só arquivo.

## Tipografia

- **Interface de Usuário (UI)**: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- **Dados e Códigos (Monospace)**: `IBM Plex Mono` com alinhamento tabular (`font-variant-numeric: tabular-nums`).
- **Peso base**: `500` (Medium) para legibilidade encorpada premium.
- **Títulos (Headings)**: Usam peso `600` ou `700` com tracking compacto (`tracking-[-0.03em]`).

## Cores

- **Verde institucional**: `#2f9e41` / HSL `130 54% 40%`, usado como ação primária, estado ativo e foco.
- **Verde ativo (Hover/Active)**: HSL `130 54% 34%`, para estados de interação.
- **Azul vibrante**: `#1a5ce6` / HSL `220 80% 52%`, para gráficos e realces analíticos.
- **Roxo**: `#7c3aed`, para detalhes analíticos.
- **Amber**: `#f59e0b`, para alertas leves e avisos visuais.
- **Branco**: `#ffffff`, para fundos principais de seções e cartões.
- **Cinza suave**: superfícies secundárias neutras.
- **Ink legado**: `#34322d`, texto principal de alta legibilidade.
- **Cinza secundário**: `#858481`, texto de apoio e descrição.
- **Erro**: Vermelho destrutivo para alertas críticos e exclusão.

## Tokens semânticos

- `--background`: HSL do branco.
- `--foreground`: `#34322d` (Ink legado).
- `--card`: branco.
- `--border` e `--input`: cinza divisor claro.
- `--muted`: superfície de fundo suave.
- `--primary`: verde institucional.
- `--success`: verde institucional.
- `--warning`: amber.
- `--info`: azul informativo.
- `--destructive`: vermelho de erro.

## Sombras e efeitos premium

- `--shadow-sm`, `--shadow-md`, `--shadow-lg` e `--shadow-xl` são sombras multicamadas de alta definição para profundidade.
- `--shadow-primary` usa verde com baixa opacidade para glow de foco.
- `.border-glow` e `.border-glow-primary` para bordas realçadas com aura de luz.
- `.glass` e `.glass-heavy` aplicam efeitos modernos de translucidez com desfoque de fundo (`backdrop-filter`).
- `app-bg-soft` aplica fundo branco com um gradiente radial verde institucional extremamente sutil (`rgba(47, 158, 65, 0.02)`) e padrão de pontos discretos.

## Classes recorrentes

- `card-system`: painel branco com borda suave e transição física física spring no hover.
- `filter-panel`: área de filtros unificada com ícone de controle.
- `input-system`: campo de entrada com foco verde suavizado e transição de anel.
- `stat-card`: KPI numérico com realce luminoso no hover e gradiente opcional.
- `table-pagination`: rodapé de tabela paginada com layout otimizado.
- `Layout`: sidebar global com indicador lateral verde no link ativo, cabeçalhos de grupo em caixa alta e cabeçalho com efeito de vidro.

## Tokens isolados da extensao Suape

O arquivo `process-toolkit.css` define tokens semânticos alinhados ao Design System do SUAP sob `#siages-suap-toolkit`: `--suape-bg`, `--suape-surface`, `--suape-surface-2`, `--suape-border`, `--suape-text`, `--suape-muted`, `--suape-primary` (verde IFRN / ciano escuro), `--suape-primary-strong`, `--suape-primary-soft` e `--suape-danger`. O atributo `data-theme="light"` troca estes valores para paletas neutras e verdes oficiais; nenhuma variável global ou regra nativa do SUAP é sobrescrita e a largura permanece 100% contida no `<aside class="right">`.
