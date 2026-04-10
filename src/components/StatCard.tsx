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
  isLoading,
}: StatCardProps) {

  if (stitchColor) {
    /* ── "Stitch Color" layout — Aura Style ──
       - Border-glow: borda luminosa sutil
       - Barra lateral colorida como accent
       - Valor com text-gradient baseado na cor
       - Ícone com fundo glassmorphism leve
       - Micro-interação: hover sobe 1px */

    const accentBarMap = {
      'vibrant-blue': 'bg-[#3b82f6]',
      'purple': 'bg-[#a855f7]',
      'amber': 'bg-[#f59e0b]',
      'emerald-green': 'bg-[#10b981]',
      'red-500': 'bg-[#ef4444]',
    };

    const iconBgMap = {
      'vibrant-blue': 'bg-[#3b82f6]/10 text-[#3b82f6]',
      'purple': 'bg-[#a855f7]/10 text-[#a855f7]',
      'amber': 'bg-[#f59e0b]/10 text-[#a16207]',
      'emerald-green': 'bg-[#10b981]/10 text-[#10b981]',
      'red-500': 'bg-[#ef4444]/10 text-[#ef4444]',
    };

    const valueGradientMap = {
      'vibrant-blue': 'from-[#1a5ce6] to-[#3b82f6]',
      'purple': 'from-[#7c3aed] to-[#a855f7]',
      'amber': 'from-[#b45309] to-[#f59e0b]',
      'emerald-green': 'from-[#047857] to-[#10b981]',
      'red-500': 'from-[#dc2626] to-[#ef4444]',
    };

    const progressBgMap = {
      'vibrant-blue': 'bg-[#3b82f6]',
      'purple': 'bg-[#a855f7]',
      'amber': 'bg-[#f59e0b]',
      'emerald-green': 'bg-[#10b981]',
      'red-500': 'bg-[#ef4444]',
    };

    return (
      <div className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-card border border-border/70",
        "shadow-soft hover:shadow-card hover:-translate-y-[1px]",
        "transition-all duration-200",
        "p-5",
      )}>
        {/* Barra lateral colorida — Aura Style accent indicator */}
        <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl", accentBarMap[stitchColor])} />

        {/* Brilho de fundo sutil no canto superior direito */}
        <div className={cn(
          "absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-5 blur-2xl",
          accentBarMap[stitchColor]
        )} />

        <div className="flex items-start justify-between mb-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </div>
          {/* Ícone com glassmorphism leve */}
          <div className={cn("p-2 rounded-xl", iconBgMap[stitchColor])}>
            <Icon className="w-4 h-4" />
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-8 w-3/5 mt-1 mb-1" />
        ) : (
          /* Valor com text-gradient — Aura Style */
          <h3 className={cn(
            "text-2xl font-black tracking-tight",
            "bg-gradient-to-br bg-clip-text text-transparent",
            valueGradientMap[stitchColor]
          )}>
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

        {/* Progress bar refinada */}
        {progress !== undefined && (
          <div className="mt-4 w-full bg-muted rounded-full h-1 overflow-hidden">
            {isLoading ? (
              <div className="h-full w-full animate-shimmer rounded-full" />
            ) : (
              <div
                className={cn("h-full rounded-full transition-all duration-700 ease-spring", progressBgMap[stitchColor])}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
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
    default: 'bg-primary/10 text-primary',
    primary: 'bg-white/20 text-white',
    accent: 'bg-white/20 text-white',
    warning: 'bg-white/20 text-white',
  };

  return (
    <div className={cn(variantStyles[variant], 'relative')}>
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
            "text-3xl font-bold mt-2 tracking-tight",
            variant === 'default' ? 'text-gradient-dark' : 'text-white'
          )}>
            {value}
          </p>
        )}
        {isLoading && subtitle ? (
          <Skeleton className="h-4 w-3/4 mt-2" />
        ) : (
          subtitle && (
            <p className={cn(
              "text-sm mt-1",
              variant === 'default' ? 'text-muted-foreground' : 'text-white/70'
            )}>
              {subtitle}
            </p>
          )
        )}
        {trend && (
          <div className={cn(
            "flex items-center gap-1 mt-2 text-sm",
            trend.value >= 0 ? 'text-green-600' : 'text-red-600',
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
