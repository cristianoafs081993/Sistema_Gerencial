# Exemplos de Uso - IFRN Design System

## Componentes Base

### Button

```tsx
import { IFRNButton } from '@/design-system/components';

export default function ButtonExample() {
  return (
    <div className="space-y-4">
      {/* Variantes */}
      <IFRNButton variant="primary">Primário</IFRNButton>
      <IFRNButton variant="secondary">Secundário</IFRNButton>
      <IFRNButton variant="outline">Outline</IFRNButton>
      <IFRNButton variant="ghost">Ghost</IFRNButton>

      {/* Tamanhos */}
      <IFRNButton size="sm">Pequeno</IFRNButton>
      <IFRNButton size="md">Médio</IFRNButton>
      <IFRNButton size="lg">Grande</IFRNButton>

      {/* Estados */}
      <IFRNButton disabled>Desabilitado</IFRNButton>
      <IFRNButton loading>Carregando...</IFRNButton>
      <IFRNButton fullWidth>Largura Total</IFRNButton>
    </div>
  );
}
```

### Card

```tsx
import { IFRNCard, IFRNButton } from '@/design-system/components';

export default function CardExample() {
  return (
    <IFRNCard
      header={<h3>Título do Card</h3>}
      footer={<IFRNButton variant="primary">Ação</IFRNButton>}
    >
      <p>Conteúdo principal do card</p>
    </IFRNCard>
  );
}
```

## Componentes Avançados

### Badge

```tsx
import { IFRNBadge } from '@/design-system/components';

export default function BadgeExample() {
  return (
    <div className="space-y-2">
      <IFRNBadge variant="success">Ativo</IFRNBadge>
      <IFRNBadge variant="warning">Pendente</IFRNBadge>
      <IFRNBadge variant="error">Erro</IFRNBadge>
      <IFRNBadge variant="info">Informação</IFRNBadge>
    </div>
  );
}
```

### Alert

```tsx
import { IFRNAlert } from '@/design-system/components';

export default function AlertExample() {
  return (
    <div className="space-y-4">
      <IFRNAlert variant="success" title="Sucesso!">
        Operação realizada com sucesso
      </IFRNAlert>

      <IFRNAlert variant="warning" title="Aviso" dismissible>
        Verifique as informações antes de prosseguir
      </IFRNAlert>

      <IFRNAlert variant="error" title="Erro">
        Ocorreu um erro ao processar a solicitação
      </IFRNAlert>

      <IFRNAlert variant="info" title="Informação">
        Esta é uma mensagem informativa
      </IFRNAlert>
    </div>
  );
}
```

### StatCard

```tsx
import { IFRNStatCard } from '@/design-system/components';

export default function StatCardExample() {
  return (
    <div className="grid grid-cols-4 gap-4">
      <IFRNStatCard
        title="Total Planejado"
        value="R$ 1.2M"
        subtitle="0 atividades filtradas"
        borderColor="green"
        icon="📊"
        trend={{ value: 12, direction: 'up' }}
      />

      <IFRNStatCard
        title="Descentralizado"
        value="R$ 850K"
        subtitle="Recursos descentralizados"
        borderColor="blue"
        icon="✓"
      />

      <IFRNStatCard
        title="Total Empenho"
        value="R$ 650K"
        subtitle="Empenhos realizados"
        borderColor="purple"
        icon="💰"
        trend={{ value: 5, direction: 'down' }}
      />

      <IFRNStatCard
        title="A Descentralizar"
        value="R$ 350K"
        subtitle="Pendente de descentralização"
        borderColor="orange"
        icon="⏱️"
      />
    </div>
  );
}
```

## Padrões Comuns

### Dashboard Layout

```tsx
import { IFRNCard, IFRNButton, IFRNStatCard, IFRNBadge } from '@/design-system/components';

export default function DashboardExample() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
        <p className="text-ifrn-gray-600">Visão geral do orçamento e execução</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <IFRNStatCard title="Planejado" value="R$ 1.2M" borderColor="green" />
        <IFRNStatCard title="Descentralizado" value="R$ 850K" borderColor="blue" />
        <IFRNStatCard title="Empenho" value="R$ 650K" borderColor="purple" />
        <IFRNStatCard title="Pendente" value="R$ 350K" borderColor="orange" />
      </div>

      {/* Content */}
      <IFRNCard header={<h2>Atividades Recentes</h2>}>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 border-b">
            <div>
              <p className="font-semibold">Atividade 1</p>
              <p className="text-sm text-ifrn-gray-600">Descrição da atividade</p>
            </div>
            <IFRNBadge variant="success">Ativo</IFRNBadge>
          </div>
        </div>
      </IFRNCard>

      {/* Actions */}
      <div className="flex gap-2">
        <IFRNButton variant="primary">Novo</IFRNButton>
        <IFRNButton variant="outline">Exportar</IFRNButton>
      </div>
    </div>
  );
}
```

## Temas e Customização

### Usando CSS Variables

```css
/* Sobrescrever cores */
:root {
  --ifrn-green: #1f6e2f;  /* Verde mais escuro */
  --ifrn-red: #9d1318;    /* Vermelho mais escuro */
}
```

### Estendendo Componentes

```tsx
import { IFRNButton } from '@/design-system/components';

export default function CustomButton() {
  return (
    <IFRNButton
      variant="primary"
      className="rounded-full uppercase tracking-wide"
    >
      Botão Customizado
    </IFRNButton>
  );
}
```

## Acessibilidade

Todos os componentes seguem as melhores práticas de acessibilidade:

- ✓ Atributos ARIA apropriados
- ✓ Contraste de cores adequado
- ✓ Navegação por teclado
- ✓ Suporte a leitores de tela
- ✓ Estados visuais claros

## Performance

- Componentes são otimizados com React.forwardRef
- CSS é carregado uma única vez
- Sem dependências externas desnecessárias
- Suporte a tree-shaking

## Próximos Passos

1. Implementar componentes de formulário
2. Adicionar componentes de tabela
3. Criar componentes de layout
4. Adicionar animações e transições
