import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SectionPanelProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

export function SectionPanel({
  title,
  description,
  actions,
  className,
  contentClassName,
  children,
}: SectionPanelProps) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <Card className={cn('card-system shadow-soft', className)}>
      {hasHeader && (
        <CardHeader className="pb-3 px-0 pt-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              {title ? <CardTitle className="table-title">{title}</CardTitle> : null}
              {description ? <CardDescription className="table-description">{description}</CardDescription> : null}
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>
        </CardHeader>
      )}
      <CardContent className={cn('p-0', contentClassName)}>{children}</CardContent>
    </Card>
  );
}
