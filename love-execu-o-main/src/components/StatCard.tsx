import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

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
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  trend
}: StatCardProps) {
  const variantStyles = {
    default: 'stat-card',
    primary: 'stat-card-primary',
    accent: 'stat-card-accent',
    warning: 'bg-warning text-warning-foreground rounded-xl p-6 shadow-lg',
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
        <p className={cn(
          "text-3xl font-bold mt-2 tracking-tight",
          variant === 'default' ? 'text-foreground' : 'text-white'
        )}>
          {value}
        </p>
        {subtitle && (
          <p className={cn(
            "text-sm mt-1",
            variant === 'default' ? 'text-muted-foreground' : 'text-white/70'
          )}>
            {subtitle}
          </p>
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
