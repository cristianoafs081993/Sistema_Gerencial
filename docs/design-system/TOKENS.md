# TOKENS — SUAP Design System (IFRN)

## Fontes de verdade

- `src/index.css`
- `tailwind.config.ts`
- `src/components/suap/SuapThemeSwitcher.tsx`
- Referência oficial: `https://suap.ifrn.edu.br/comum/design_system`

Os tokens visuais foram consolidados em `src/index.css` e `tailwind.config.ts` para refletir com fidelidade o **Design System oficial do SUAP (IFRN)**.

## Tipografia

- **Interface de Usuário (UI SUAP)**: `Open Sans, Lato, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- **Dados e Códigos (Monospace)**: `IBM Plex Mono, Monaco, Consolas, monospace` com alinhamento tabular (`font-variant-numeric: tabular-nums`).
- **Peso base**: `400` (Regular) e `500` (Medium).
- **Títulos (Headings)**: `600` (Semi-bold) e `700` (Bold) com tracking compacto (`tracking-tight`).

## Temas e Paletas Oficiais do SUAP

O sistema suporta alternância dinâmica de temas via atributo `data-suap-theme` e seletor `SuapThemeSwitcher`:

1. **Padrão (Teal SUAP - Default)**:
   - Primária: `#0A7F70` (`--primary-700`), `#00BDA4` (`--primary-600`), `#00E5C7` (`--primary-500`).
   - Fundo: `#F8F9FA` / `#F2F2F2`, superfícies `#FFFFFF`, texto `#1A1A1A` e `#666666`.
2. **IFs (Institutos Federais / IFRN)**:
   - Primária Verde IFRN `#1F7A2D`, Destaque Vermelho `#E41D1B`.
3. **Aurora**:
   - Roxo / Violeta `#4456BB` com degradê elegante.
4. **Dunas**:
   - Tons de areia e ocre `#B98746`.
5. **Gov.br**:
   - Azul padrão federal `#1351B4`.
6. **Luna (Dark Mode)**:
   - Fundo escuro `#1A1A1A` com realces em ciano `#14B8AA`.
7. **Alto Contraste**:
   - Amarelo `#FFFF00` sobre preto absoluto para acessibilidade e baixa visão.
8. **Modo Daltonismo**:
   - Paleta otimizada para discromatopsia com magenta `#B94686` e verde `#009E73`.

## Tokens semânticos

- `--background`: HSL do fundo da página (específico por tema SUAP).
- `--foreground`: HSL do texto principal.
- `--card`: fundo dos cartões e tabelas.
- `--border` e `--input`: divisores e contornos sutis.
- `--muted`: superfície de apoio e cabeçalhos de tabela.
- `--primary`: cor primária do tema ativo do SUAP.
- `--success`: verde semântico (`#1FAD34`).
- `--warning`: amarelo/oliva de atenção (`#989301` / `#CAC302`).
- `--info`: azul informativo (`#008DCC`).
- `--destructive`: vermelho de erro/perigo (`#C20A0A`).

## Componentes e Padrões SUAP

- **Botões (`Button`, `.btn`, `.button`)**: Estilo *pill* arredondado (`rounded-full`), altura 36px, padding `8px 16px`.
- **Badges (`Badge`, `span.status`)**: Formato pílula com borda de 1px, fundo translúcido e texto contrastado.
- **Tabelas (`Table`, `table.listagem`)**: Cabeçalhos em `bg-muted/70`, linhas com hover suave `bg-primary/4`.
- **Sidebar & Header**: Menu colapsável com indicador ativo na cor do tema, busca rápida e `SuapThemeSwitcher` integrado.
