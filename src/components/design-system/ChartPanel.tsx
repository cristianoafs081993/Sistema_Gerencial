import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ChartPanelProps {
  title: ReactNode;
  titleClassName?: string;
  description?: string;
  actions?: ReactNode;
  loading?: boolean;
  heightClassName?: string;
  className?: string;
  children: ReactNode;
}

export function ChartPanel({
  title,
  titleClassName,
  description,
  actions,
  loading = false,
  heightClassName = 'h-[300px]',
  className,
  children,
}: ChartPanelProps) {
  return (
    <Card className={cn('card-system border border-border-default/80 shadow-soft', className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className={cn('text-base font-semibold', titleClassName)}>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className={cn('rounded-radius-md border border-border-default/60 bg-surface-subtle/30 p-3', heightClassName)}>
            <Skeleton className="h-full w-full" />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
