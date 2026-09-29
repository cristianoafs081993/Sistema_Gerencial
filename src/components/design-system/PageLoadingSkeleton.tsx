import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface PageLoadingSkeletonProps {
  label?: string;
  className?: string;
}

/**
 * Esqueleto de página exibido dentro do shell (sidebar e header já visíveis) enquanto a rota carrega:
 * barra de seletor/ações, linha de indicadores e um painel de tabela. Evita o "salto" de layout
 * quando o conteúdo real chega.
 */
export function PageLoadingSkeleton({ label = 'Carregando página...', className }: PageLoadingSkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn('min-h-[50vh] w-full space-y-6 animate-fade-in', className)}
    >
      <span className="sr-only">{label}</span>

      <div className="flex flex-wrap items-center justify-between gap-3" aria-hidden="true">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-xs">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-1 w-full rounded-full" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs" aria-hidden="true">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-6 px-6 py-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-28 sm:block" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
