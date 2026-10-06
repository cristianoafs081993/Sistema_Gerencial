import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  children: ReactNode;
  error?: string | null;
  hasInitialDataError?: boolean;
  blocksContent: boolean;
  isRefreshing?: boolean;
  onRetry: () => Promise<void> | void;
};

export function DataAvailabilityBoundary({ children, error, hasInitialDataError, blocksContent, isRefreshing, onRetry }: Props) {
  if (!error) return <>{children}</>;
  return <>
    <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
      <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Dados temporariamente indisponíveis</p>
        <p className="text-sm">{error}</p>
        <p className="text-sm text-muted-foreground">
          {hasInitialDataError
            ? 'Aguarde a conexão ser restabelecida e tente novamente.'
            : 'Exibindo os últimos dados carregados. Os valores podem estar desatualizados.'}
        </p>
      </div>
      <Button variant="outline" disabled={isRefreshing} onClick={() => void onRetry()}>
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        {isRefreshing ? 'Tentando novamente...' : 'Tentar novamente'}
      </Button>
    </div>
    {!(blocksContent && hasInitialDataError) && children}
  </>;
}
