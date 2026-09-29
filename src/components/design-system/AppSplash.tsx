import { LogoIcon } from '@/components/Logo';
import { cn } from '@/lib/utils';

interface AppSplashProps {
  label?: string;
  description?: string;
  className?: string;
}

/**
 * Tela de abertura (antes do shell existir): logotipo, nome do sistema e barra indeterminada.
 * Usada na carga inicial, na validação de sessão e em rotas fora do Layout.
 */
export function AppSplash({ label = 'Carregando...', description, className }: AppSplashProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn('flex min-h-dvh w-full flex-col items-center justify-center gap-5 bg-background px-6 text-center animate-fade-in', className)}
    >
      <div className="flex flex-col items-center gap-3">
        <LogoIcon size={56} className="hover:scale-100" />
        <span className="text-xl font-extrabold tracking-[-0.04em] text-foreground">SIAGES</span>
      </div>
      <div className="loading-bar" aria-hidden="true" />
      <div className="space-y-1">
        <p className="m-0 text-sm font-semibold text-foreground">{label}</p>
        {description ? <p className="m-0 max-w-xs text-xs text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}
