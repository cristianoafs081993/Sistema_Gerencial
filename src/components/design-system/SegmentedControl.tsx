import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Contagem opcional exibida ao lado do rótulo (ex.: número de registros). */
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  'aria-label': string;
  className?: string;
}

/**
 * Alternador segmentado (Paretto Institucional) para trocar visões de uma mesma tela
 * — substitui abas "folder" e pares de botões avulsos.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  ...props
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={props['aria-label']}
      className={cn('inline-flex items-center gap-1 rounded-lg border border-border bg-muted p-1', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-md px-3.5 text-xs font-semibold transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              active ? 'bg-card text-foreground shadow-sm font-bold' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
            {typeof option.count === 'number' ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-px font-mono text-[10px] font-semibold',
                  active ? 'bg-accent text-accent-foreground' : 'bg-card/70 text-muted-foreground',
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
