import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { SectionPanel } from '@/components/design-system/SectionPanel';

interface DataTablePanelProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  tableContainerClassName?: string;
  children: ReactNode;
}

export function DataTablePanel({
  title,
  description,
  actions,
  className,
  tableContainerClassName,
  children,
}: DataTablePanelProps) {
  return (
    <SectionPanel
      title={title}
      description={description}
      actions={actions}
      className={cn('overflow-hidden', className)}
    >
      <div className={cn('overflow-x-auto', tableContainerClassName)}>{children}</div>
    </SectionPanel>
  );
}

