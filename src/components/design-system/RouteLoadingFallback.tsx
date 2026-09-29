import { AppSplash } from '@/components/design-system/AppSplash';
import { PageLoadingSkeleton } from '@/components/design-system/PageLoadingSkeleton';

interface RouteLoadingFallbackProps {
  mode?: 'screen' | 'content';
  label?: string;
}

/**
 * Fallback de rotas lazy.
 * - `screen`: fora do shell (tela de abertura com logotipo);
 * - `content`: dentro do Layout (esqueleto de página, sem mover sidebar/header).
 */
export function RouteLoadingFallback({
  mode = 'content',
  label = 'Carregando página...',
}: RouteLoadingFallbackProps) {
  if (mode === 'screen') {
    return <AppSplash label={label} />;
  }
  return <PageLoadingSkeleton label={label} />;
}
