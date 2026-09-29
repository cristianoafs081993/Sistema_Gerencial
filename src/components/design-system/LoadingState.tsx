import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

interface LoadingStateProps {
  label?: string;
  className?: string;
}

/**
 * Carregamento dentro de um painel, lista ou área já renderizada.
 * Para tabelas prefira `TableSkeletonRows`; para páginas inteiras, `PageLoadingSkeleton`.
 */
export function LoadingState({ label = 'Carregando...', className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn('flex items-center justify-center gap-2.5 py-12 text-sm font-medium text-muted-foreground', className)}
    >
      <Loader2 className="h-4 w-4 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
      {label}
    </div>
  );
}
