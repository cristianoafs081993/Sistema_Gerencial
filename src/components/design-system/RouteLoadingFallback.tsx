import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

interface RouteLoadingFallbackProps {
  mode?: 'screen' | 'content';
  label?: string;
}

export function RouteLoadingFallback({
  mode = 'content',
  label = 'Carregando página...',
}: RouteLoadingFallbackProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'flex w-full items-center justify-center bg-background px-6',
        mode === 'screen' ? 'min-h-dvh' : 'min-h-[50vh]',
      )}
    >
      <div className="flex min-w-0 flex-col items-center rounded-radius-xl border border-border-default bg-surface-card px-8 py-7 text-center shadow-soft">
        <Loader2 className="h-8 w-8 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
        <p className="mt-4 font-ui text-sm font-semibold text-text-secondary">{label}</p>
      </div>
    </div>
  );
}
