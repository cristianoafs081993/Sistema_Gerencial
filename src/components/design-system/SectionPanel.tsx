import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SectionPanelProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

export function SectionPanel({
  title,
  description,
  actions,
  footer,
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
            {(title || description) ? (
              <div className="space-y-1">
                {title ? <CardTitle className="table-title">{title}</CardTitle> : null}
                {description ? <CardDescription className="table-description">{description}</CardDescription> : null}
              </div>
            ) : null}
            {actions ? <div className="shrink-0 ml-auto">{actions}</div> : null}
          </div>
        </CardHeader>
      )}
      <CardContent className={cn('p-0', contentClassName)}>{children}</CardContent>
      {footer && (
        <CardFooter className="border-t border-border-default/60 px-0 pb-0 pt-5 mt-5 flex justify-between items-center w-full">
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}
