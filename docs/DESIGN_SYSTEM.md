# Design System - Sistema Gerencial

Este documento define o padrao visual e de componentes do sistema.
Toda nova interface, ajuste visual e componente deve seguir estas diretrizes.

## Regra para novas paginas

- Toda nova pagina deve nascer no design system do sistema.
- Antes de abrir uma nova rota, reutilize o shell oficial de pagina, `SectionPanel`, `FilterPanel`, `DataTablePanel`, `StatCard` e os tokens semanticos existentes.
- Nao aprovamos paginas novas com padrao visual paralelo ou componentes ad hoc se ja existir equivalente no design system.

## 1) Principios

- Clareza operacional: foco em leitura rapida para rotinas de execucao financeira.
- Sobridade institucional: visual moderno, mas sem excesso de efeitos.
- Fundo recuado: a base da pagina deve ser clara, neutra e discreta, deixando cards, tabelas e filtros conduzirem a hierarquia.
- Consistencia: decisoes de estilo devem reutilizar tokens e componentes existentes.
- Escalabilidade: padroes reutilizaveis para paginas, modais, tabelas e fluxos de upload.

## 2) Fundacao Visual

### Tipografia

- Interface (padrao global): `Public Sans`
- Dados/codigos: `IBM Plex Mono`
- Fallbacks ja configurados em `src/index.css`.
- Tokens/aliases:
  - `font-ui` para interface textual
  - `font-data` para campos numericos/codigos
  - `label-eyebrow` para rotulos de secao em caixa alta

### Tokens e Temas

- Tokens em `src/index.css` e `tailwind.config.ts`.
- Light/Dark com os mesmos papeis semanticos:
  - superficies (`surface-*`)
  - texto (`text-*`)
  - acoes (`action-*`)
  - estados (`status-*`)
  - bordas (`border-*`)

### Sombras

- Escala oficial:
  - `shadow-soft`
  - `shadow-card`
  - `shadow-lifted`
  - `shadow-primary`
- Em light mode, cards e paineis devem usar elevacao contida; a separacao visual vem primeiro de contraste de superficie e borda, nao de sombra forte.
- Evitar sombras arbitrarias fora da escala.

### Glass

- `glass` e `glass-heavy` existem como recurso de apoio, nao como linguagem dominante.
- Em light mode, preferir glass mais opaco, com blur moderado e brilho interno discreto.
- Cards informativos devem parecer superficies limpas primeiro; o efeito de vidro deve ser secundario.

## 3) Padroes de Layout

- Shell de pagina com hierarquia:
  - breadcrumb/contexto
  - titulo da tela
  - acoes principais
- Sidebar oficial:
  - rail de atalhos + navegacao contextual por dominio.
  - implementacao canonica em `src/components/Layout.tsx`
  - deve manter blocos expansivos por dominio
  - modo expandido prioriza texto sem icones por item
  - modo colapsado com icones e tooltips
- Grid de conteudo com espacamento em escala de tokens.

## 4) Componentes Obrigatorios

- Formularios: `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Label`.
- Dados: `Table`, `Badge`, `Pagination`.
- Feedback: `Alert`, `Progress`, `Skeleton`.
- Overlays: `Dialog`, `AlertDialog`, `Sheet`, `Popover`, `DropdownMenu`, `Tooltip`.
- IA/Editor: `RichTextEditor` + painel lateral de sugestoes/checklist.

### Blocos de Pagina (Design System)

- `SectionPanel`
  - arquivo: `src/components/design-system/SectionPanel.tsx`
  - uso: bloco padrao para secoes com `title`, `description`, `actions` e conteudo.
- `DataTablePanel`
  - arquivo: `src/components/design-system/DataTablePanel.tsx`
  - uso: tabela padronizada com container responsivo e header consistente.
- `TableSkeletonRows`
  - arquivo: `src/components/design-system/TableSkeletonRows.tsx`
  - uso: skeleton reutilizavel para linhas de tabela assincronas.

## 5) Padroes de Graficos (Dashboard)

- Cartoes de grafico devem usar o padrao `ChartPanel`:
  - arquivo: `src/components/design-system/ChartPanel.tsx`
  - inclui estilo visual + skeleton de carregamento.
- Graficos atualmente cobertos:
  - Evolucao da Execucao
  - Distribuicao do Orcamento
  - Descentralizacoes
  - Top Naturezas

### Observacao

- O grafico **Funil de Execucao** esta explicitamente fora desta rodada e sera redesenhado depois.

## 6) Skeletons

Todo bloco assincrono deve ter skeleton dedicado:

- cards/KPIs
- tabelas
- formularios/modais
- upload/processamento
- editor IA
- graficos
- listas/tabelas: preferir `TableSkeletonRows` em vez de skeletons ad hoc

Referencia visual: pagina `DesignSystemPreview`.

## 7) Fonte de Verdade

- Preview completo: `src/pages/DesignSystemPreview.tsx`
- Tokens globais: `src/index.css`
- Base Tailwind: `tailwind.config.ts`

## 8) Regra de Evolucao

Antes de criar novo componente visual:

1. Verificar se ja existe padrao equivalente no Design System.
2. Reutilizar o padrao existente.
3. Se nao existir, criar no Design System primeiro e depois aplicar nas paginas.
4. Atualizar este documento ao introduzir novo padrao.
