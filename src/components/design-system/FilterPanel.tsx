import type { ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FilterPanelProps {
  title?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  actions?: ReactNode;
}

export function FilterPanel({
  title = 'Filtros',
  children,
  className,
  contentClassName,
  actions,
}: FilterPanelProps) {
  const isDefaultTitle = title.trim().toLowerCase() === 'filtros';

  return (
    <Card className={cn('filter-panel', className)}>
      <CardHeader className="filter-panel-header">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className={cn('filter-title', !isDefaultTitle && 'filter-title-custom')}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {title}
          </CardTitle>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </CardHeader>
      <CardContent className={cn('filter-content', contentClassName)}>{children}</CardContent>
    </Card>
  );
}
