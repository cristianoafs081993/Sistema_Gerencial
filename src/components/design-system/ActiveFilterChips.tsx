import type React from 'react';
import { RotateCcw, X, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface ActiveFilterItem {
  id: string;
  label: string;
  value: string;
  onRemove: () => void;
}

export interface ActiveFilterChipsProps {
  filters: ActiveFilterItem[];
  onClearAll?: () => void;
  filteredCount?: number;
  totalCount?: number;
  className?: string;
}

export function ActiveFilterChips({
  filters,
  onClearAll,
  filteredCount,
  totalCount,
  className,
}: ActiveFilterChipsProps) {
  if (!filters || filters.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="active-filter-chips"
      className={cn(
        'flex flex-wrap items-center gap-2 pt-2.5 mt-2.5 border-t border-border/50 text-xs animate-fade-in select-none',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider shrink-0">
        <Filter className="h-3.5 w-3.5 text-primary" />
        <span>Filtros ativos:</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
        {filters.map((filter) => (
          <span
            key={filter.id}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 border border-border/80 text-foreground font-medium transition-all hover:bg-muted group shadow-2xs"
          >
            <span className="text-muted-foreground font-normal">{filter.label}:</span>
            <strong className="font-semibold text-foreground">{filter.value}</strong>
            <button
              type="button"
              onClick={filter.onRemove}
              className="p-0.5 ml-0.5 rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-muted-foreground/20 transition-colors cursor-pointer"
              title={`Remover filtro ${filter.label}`}
              aria-label={`Remover filtro ${filter.label}: ${filter.value}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {onClearAll && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-7 px-2 text-[11px] font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg gap-1 transition-colors cursor-pointer ml-1"
          >
            <RotateCcw className="h-3 w-3" />
            Limpar filtros
          </Button>
        )}
      </div>

      {filteredCount !== undefined && (
        <div className="text-[11px] font-medium text-muted-foreground shrink-0 ml-auto tabular-nums">
          {totalCount !== undefined ? (
            <span>
              <strong className="text-foreground">{filteredCount}</strong> de {totalCount} registros
            </span>
          ) : (
            <span>
              <strong className="text-foreground">{filteredCount}</strong> encontrado(s)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
