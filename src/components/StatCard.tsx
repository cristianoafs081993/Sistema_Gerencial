import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface StatCardProps {
  title: React.ReactNode;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'primary' | 'accent' | 'warning';
  trend?: {
    value: number;
    label: string;
  };
  stitchColor?: 'vibrant-blue' | 'purple' | 'amber' | 'emerald-green' | 'red-500';
  progress?: number;
  /** Texto curto ao lado da barra explicando o que ela mede (ex.: "do planejado"). */
  progressLabel?: string;
  isLoading?: boolean;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  trend,
  stitchColor,
  progress,
  progressLabel,
  isLoading,
}: StatCardProps) {

  if (stitchColor) {
    /* ── Layout "metric" (Paretto Institucional) ──
       - Card branco com borda sutil e cantos de 12px
       - Rótulo discreto + ícone neutro no topo
       - Valor em tom claro da cor do card (sem gradiente)
       - Barra de progresso fina na cor semântica */

    const iconColorMap = {
      'vibrant-blue': 'text-primary',
      'purple': 'text-brand-sky',
      'amber': 'text-warning',
      'emerald-green': 'text-brand-green',
      'red-500': 'text-destructive',
    };

    const valueColorMap = {
      'vibrant-blue': 'text-primary',
      'purple': 'text-brand-sky',
      'amber': 'text-warning',
      'emerald-green': 'text-brand-green',
      'red-500': 'text-destructive',
    };

    const progressBgMap = {
      'vibrant-blue': 'bg-primary',
      'purple': 'bg-brand-sky',
      'amber': 'bg-warning',
      'emerald-green': 'bg-brand-green',
      'red-500': 'bg-destructive',
    };

    return (
      <div className={cn(
        "relative overflow-hidden rounded-xl",
        "bg-card border border-border",
        "shadow-xs hover:shadow-md hover:border-primary/25",
        "transition-all duration-200",
        "p-5",
        "group",
      )}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="text-xs font-semibold text-muted-foreground">
            {title}
          </div>
          <Icon className={cn("w-4 h-4 shrink-0", iconColorMap[stitchColor])} />
        </div>

        {isLoading ? (
          <Skeleton className="h-8 w-3/5 mt-1 mb-1" />
        ) : (
          <h3 className={cn("text-[26px] font-bold tracking-[-0.03em] leading-tight", valueColorMap[stitchColor])}>
            {value}
          </h3>
        )}

        {isLoading && subtitle ? (
          <Skeleton className="h-3.5 w-3/4 mt-2" />
        ) : (
          subtitle && (
            <p className="text-xs text-muted-foreground mt-1.5 leading-tight">{subtitle}</p>
          )
        )}

        {progress !== undefined && (
          <div className="mt-4 flex items-center gap-3">
            <div
              className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label={progressLabel ?? "Progresso"}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(Math.min(progress, 100))}
            >
              {isLoading ? (
                <div className="h-full w-full animate-shimmer rounded-full" />
              ) : (
                <div
                  className={cn("h-full rounded-full transition-all duration-700 ease-spring", progressBgMap[stitchColor])}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              )}
            </div>
            {!isLoading && (
              <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                {progress.toFixed(1).replace(".", ",")}%{progressLabel ? ` ${progressLabel}` : ""}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Legacy Layout (mantido para compatibilidade) ──
  const variantStyles = {
    default: 'stat-card',
    primary: 'stat-card-primary',
    accent: 'stat-card-accent',
    warning: 'stat-card-warning',
  };

  const iconBgStyles = {
    default: 'bg-accent text-accent-foreground',
    primary: 'bg-white/20 text-white',
    accent: 'bg-white/20 text-white',
    warning: 'bg-white/20 text-white',
  };

  return (
    <div className={cn(variantStyles[variant], 'relative group')}>
      <div className={cn(
        "absolute top-4 right-4 rounded-lg p-2",
        iconBgStyles[variant]
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="pr-16">
        <div className={cn(
          "text-sm font-medium",
          variant === 'default' ? 'text-muted-foreground' : 'text-white/80'
        )}>
          {title}
        </div>
        {isLoading ? (
          <Skeleton className="h-9 w-1/2 mt-2 mb-1" />
        ) : (
          <p className={cn(
            "text-3xl font-extrabold mt-2 tracking-[-0.03em]",
            variant === 'default' ? 'text-foreground' : 'text-white'
          )}>
            {value}
          </p>
        )}
        {isLoading && subtitle ? (
          <Skeleton className="h-4 w-3/4 mt-2" />
        ) : (
          subtitle && (
            <p className={cn(
              "text-sm mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300",
              variant === 'default' ? 'text-muted-foreground' : 'text-white/70'
            )}>
              {subtitle}
            </p>
          )
        )}
        {trend && (
          <div className={cn(
            "flex items-center gap-1 mt-2 text-sm",
            trend.value >= 0 ? 'text-success' : 'text-destructive',
            variant !== 'default' && (trend.value >= 0 ? 'text-green-300' : 'text-red-300')
          )}>
            <span className="font-medium">
              {trend.value >= 0 ? '+' : ''}{trend.value.toFixed(1)}%
            </span>
            <span className={cn(
              variant === 'default' ? 'text-muted-foreground' : 'text-white/70'
            )}>
              {trend.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
