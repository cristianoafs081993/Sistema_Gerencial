import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type TablePaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
  summary?: ReactNode;
  pageLabel?: ReactNode;
  className?: string;
};

function buildVisiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 3) {
    return {
      pages: Array.from({ length: totalPages }, (_, index) => index + 1),
      showLeadingEllipsis: false,
      showTrailingEllipsis: false,
    };
  }

  if (currentPage <= 2) {
    return {
      pages: [1, 2, 3],
      showLeadingEllipsis: false,
      showTrailingEllipsis: totalPages > 3,
    };
  }

  if (currentPage >= totalPages - 1) {
    return {
      pages: [totalPages - 2, totalPages - 1, totalPages],
      showLeadingEllipsis: totalPages > 3,
      showTrailingEllipsis: false,
    };
  }

  return {
    pages: [currentPage - 1, currentPage, currentPage + 1],
    showLeadingEllipsis: true,
    showTrailingEllipsis: true,
  };
}

function buildRangeLabel(page: number, pageSize: number, totalItems: number) {
  if (totalItems <= 0) return 'Mostrando 0 de 0 registros';

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return `Mostrando ${start} a ${end} de ${totalItems} registros`;
}

export function TablePagination({
  page,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 20, 50, 100],
  onPageSizeChange,
  summary,
  pageLabel,
  className,
}: TablePaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(page, 1), safeTotalPages);
  const visible = buildVisiblePages(safePage, safeTotalPages);
  const resolvedSummary =
    summary ??
    (typeof totalItems === 'number' && typeof pageSize === 'number' ? buildRangeLabel(safePage, pageSize, totalItems) : null);
  const resolvedPageLabel = pageLabel ?? `Pagina ${safePage} de ${safeTotalPages}`;

  return (
    <div className={cn('table-pagination', className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-5">
        {resolvedSummary ? <span className="table-pagination__summary">{resolvedSummary}</span> : null}

        {typeof pageSize === 'number' && onPageSizeChange ? (
          <>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="table-pagination__label">Exibir</span>
              <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
                <SelectTrigger className="table-pagination__select">
                  <SelectValue placeholder={String(pageSize)} />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="table-pagination__divider" />
          </>
        ) : null}

        <span className="table-pagination__label">{resolvedPageLabel}</span>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="table-pagination__nav-button"
          onClick={() => onPageChange(1)}
          disabled={safePage <= 1}
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="table-pagination__nav-button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>

        <div className="flex items-center gap-1">
          {visible.showLeadingEllipsis ? (
            <span className="table-pagination__ellipsis" aria-hidden>
              <MoreHorizontal className="h-3.5 w-3.5" />
            </span>
          ) : null}

          {visible.pages.map((pageNumber) => (
            <Button
              key={pageNumber}
              type="button"
              variant={pageNumber === safePage ? 'default' : 'ghost'}
              size="icon-sm"
              className={cn('table-pagination__page-chip', pageNumber === safePage && 'table-pagination__page-chip--active')}
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </Button>
          ))}

          {visible.showTrailingEllipsis ? (
            <span className="table-pagination__ellipsis" aria-hidden>
              <MoreHorizontal className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="table-pagination__nav-button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= safeTotalPages}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="table-pagination__nav-button"
          onClick={() => onPageChange(safeTotalPages)}
          disabled={safePage >= safeTotalPages}
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
