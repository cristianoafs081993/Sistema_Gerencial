import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface StatCardProps {
  title: string;
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
    // New Stitch Premium Layout
    const bgColorMap = {
      'vibrant-blue': 'bg-vibrant-blue',
      'purple': 'bg-purple',
      'amber': 'bg-amber',
      'emerald-green': 'bg-emerald-green',
      'red-500': 'bg-red-500',
    };

    const textColorMap = {
      'vibrant-blue': 'text-vibrant-blue',
      'purple': 'text-purple',
      'amber': 'text-amber',
      'emerald-green': 'text-emerald-green',
      'red-500': 'text-red-500',
    };

    const bgLightMap = {
      'vibrant-blue': 'bg-vibrant-blue/10',
      'purple': 'bg-purple/10',
      'amber': 'bg-amber/10',
      'emerald-green': 'bg-emerald-green/10',
      'red-500': 'bg-red-500/10',
    };

    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden animate-fade-in">
        <div className={cn("absolute left-0 top-0 bottom-0 w-1", bgColorMap[stitchColor])}></div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <div className={cn("p-1.5 rounded-md", bgLightMap[stitchColor], textColorMap[stitchColor])}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        {isLoading ? (
          <Skeleton className="h-8 w-1/2 mt-1 mb-1" />
        ) : (
          <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
        )}
        {isLoading && subtitle ? (
          <Skeleton className="h-4 w-3/4 mt-2" />
        ) : (
          subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
        )}
        {progress !== undefined && (
          <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <div className={cn("h-full rounded-full", bgColorMap[stitchColor])} style={{ width: `${progress}%` }}></div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Legacy Layout
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
    <div className={cn(variantStyles[variant], 'animate-fade-in relative')}>
      <div className={cn(
        "absolute top-4 right-4 rounded-lg p-2",
        iconBgStyles[variant]
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="pr-16">
        <p className={cn(
          "text-sm font-medium",
          variant === 'default' ? 'text-muted-foreground' : 'text-white/80'
        )}>
          {title}
        </p>
        {isLoading ? (
          <Skeleton className="h-9 w-1/2 mt-2 mb-1" />
        ) : (
          <p className={cn(
            "text-3xl font-bold mt-2 tracking-tight",
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
