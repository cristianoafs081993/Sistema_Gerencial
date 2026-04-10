# IFRN Design System

Sistema de design completo para aplicações do Instituto Federal do Rio Grande do Norte, seguindo a identidade visual institucional com cores verde (#2f9e41) e vermelho (#cd191e).

## 📋 Estrutura

```
src/design-system/
├── components/          # Componentes reutilizáveis
├── hooks/              # Hooks customizados
├── styles/             # Estilos e temas
└── documentation/      # Documentação
```

## 🎨 Cores Principais

- **Verde IFRN**: `#2f9e41` (Primária)
- **Vermelho IFRN**: `#cd191e` (Secundária)
- **Cinza**: Escala de `#f9fafb` a `#111827`

## 🧩 Componentes Base (Fase 1)

### IFRNButton
Botão reutilizável com variantes e tamanhos.

```tsx
import { IFRNButton } from '@/design-system/components';

<IFRNButton variant="primary" size="md">
  Clique aqui
</IFRNButton>
```

**Props:**
- `variant`: 'primary' | 'secondary' | 'outline' | 'ghost'
- `size`: 'sm' | 'md' | 'lg'
- `fullWidth`: boolean
- `loading`: boolean

### IFRNCard
Card reutilizável com header e footer opcionais.

```tsx
import { IFRNCard } from '@/design-system/components';

<IFRNCard header={<h3>Título</h3>}>
  Conteúdo do card
</IFRNCard>
```

**Props:**
- `variant`: 'default' | 'elevated' | 'outlined'
- `header`: React.ReactNode
- `footer`: React.ReactNode

## 📦 Componentes Planejados

### Fase 2 - Componentes Avançados
- [ ] IFRNBadge
- [ ] IFRNAlert
- [ ] IFRNModal
- [ ] IFRNTable
- [ ] IFRNForm
- [ ] IFRNDropdown
- [ ] IFRNPagination
- [ ] IFRNStatCard

### Fase 3 - Páginas Completas
- [ ] Dashboard
- [ ] Atividades
- [ ] Descentralizações
- [ ] Empenhos
- [ ] Financeiro
- [ ] Contratos
- [ ] Documentos
- [ ] Atas
- [ ] Consultor Jurídico

## 🚀 Como Usar

1. Importe o componente desejado:
```tsx
import { IFRNButton, IFRNCard } from '@/design-system/components';
```

2. Use no seu componente:
```tsx
export default function MyComponent() {
  return (
    <IFRNCard>
      <IFRNButton variant="primary">
        Ação Principal
      </IFRNButton>
    </IFRNCard>
  );
}
```

## 📝 Tipografia

- **Font**: Open Sans
- **Tamanhos**: xs (0.75rem) até 4xl (2.25rem)
- **Pesos**: 400 (regular), 600 (semibold), 700 (bold)

## 🔄 Commits Planejados

1. `feat: setup design system structure` - Estrutura base
2. `feat: add base components (Button, Card)` - Componentes base
3. `feat: add advanced components` - Componentes avançados
4. `feat: implement dashboard page` - Páginas
5. `docs: complete design system documentation` - Documentação

## 📚 Referências

- Manual de Identidade Visual do IFRN
- Componentes shadcn/ui
- Tailwind CSS 4.0
