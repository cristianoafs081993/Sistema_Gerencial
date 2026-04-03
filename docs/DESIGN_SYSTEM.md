# Design System - Sistema Gerencial

Este documento define o padrão visual e de componentes do sistema.
Toda nova interface, ajuste visual e componente deve seguir estas diretrizes.

## 1) Princípios

- Clareza operacional: foco em leitura rápida para rotinas de execução financeira.
- Sobridade institucional: visual moderno, mas sem excesso de efeitos.
- Consistência: decisões de estilo devem reutilizar tokens e componentes existentes.
- Escalabilidade: padrões reutilizáveis para páginas, modais, tabelas e fluxos de upload.

## 2) Fundação Visual

### Tipografia

- Interface (padrão global): `Public Sans`
- Dados/códigos: `IBM Plex Mono`
- Fallbacks já configurados em `src/index.css`.
- Tokens/aliases:
  - `font-ui` para interface textual
  - `font-data` para campos numéricos/códigos
  - `label-eyebrow` para rótulos de seção em caixa alta

### Tokens e Temas

- Tokens em `src/index.css` e `tailwind.config.ts`.
- Light/Dark com os mesmos papéis semânticos:
  - superfícies (`surface-*`)
  - texto (`text-*`)
  - ações (`action-*`)
  - estados (`status-*`)
  - bordas (`border-*`)

### Sombras

- Escala oficial:
  - `shadow-soft`
  - `shadow-card`
  - `shadow-lifted`
  - `shadow-primary`
- Evitar sombras arbitrárias fora da escala.

## 3) Padrões de Layout

- Shell de página com hierarquia:
  - breadcrumb/contexto
  - título da tela
  - ações principais
- Sidebar oficial:
  - rail de atalhos + navegação contextual por domínio.
  - implementação canônica em `src/components/Layout.tsx`
  - deve manter blocos expansíveis por domínio
  - modo colapsado com tooltips
- Grid de conteúdo com espaçamento em escala de tokens.

## 4) Componentes Obrigatórios

- Formulários: `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Label`.
- Dados: `Table`, `Badge`, `Pagination`.
- Feedback: `Alert`, `Progress`, `Skeleton`.
- Overlays: `Dialog`, `AlertDialog`, `Sheet`, `Popover`, `DropdownMenu`, `Tooltip`.
- IA/Editor: `RichTextEditor` + painel lateral de sugestões/checklist.

### Blocos de Página (Design System)

- `SectionPanel`
  - arquivo: `src/components/design-system/SectionPanel.tsx`
  - uso: bloco padrão para seções com `title`, `description`, `actions` e conteúdo.
- `DataTablePanel`
  - arquivo: `src/components/design-system/DataTablePanel.tsx`
  - uso: tabela padronizada com container responsivo e header consistente.
- `TableSkeletonRows`
  - arquivo: `src/components/design-system/TableSkeletonRows.tsx`
  - uso: skeleton reutilizável para linhas de tabela assíncronas.

## 5) Padrões de Gráficos (Dashboard)

- Cartões de gráfico devem usar o padrão `ChartPanel`:
  - arquivo: `src/components/design-system/ChartPanel.tsx`
  - inclui estilo visual + skeleton de carregamento.
- Gráficos atualmente cobertos:
  - Evolução da Execução
  - Distribuição do Orçamento
  - Descentralizações
  - Top Naturezas

### Observação

- O gráfico **Funil de Execução** está explicitamente fora desta rodada e será redesenhado depois.

## 6) Skeletons

Todo bloco assíncrono deve ter skeleton dedicado:

- cards/KPIs
- tabelas
- formulários/modais
- upload/processamento
- editor IA
- gráficos
- listas/tabelas: preferir `TableSkeletonRows` em vez de skeletons ad hoc

Referência visual: página `DesignSystemPreview`.

## 7) Fonte de Verdade

- Preview completo: `src/pages/DesignSystemPreview.tsx`
- Tokens globais: `src/index.css`
- Base Tailwind: `tailwind.config.ts`

## 8) Regra de Evolução

Antes de criar novo componente visual:

1. Verificar se já existe padrão equivalente no Design System.
2. Reutilizar o padrão existente.
3. Se não existir, criar no Design System primeiro e depois aplicar nas páginas.
4. Atualizar este documento ao introduzir novo padrão.
