import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ChartPanelProps {
  title: string;
  description: string;
  loading?: boolean;
  heightClassName?: string;
  className?: string;
  children: ReactNode;
}

export function ChartPanel({
  title,
  description,
  loading = false,
  heightClassName = 'h-[300px]',
  className,
  children,
}: ChartPanelProps) {
  return (
    <Card className={cn('card-system border border-border-default/80 shadow-soft', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
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

