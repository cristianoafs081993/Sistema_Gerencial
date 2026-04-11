import { TableCell, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface TableSkeletonRowsProps {
  rows?: number;
  columns: number;
  widths?: string[];
  cellClassName?: string;
}

export function TableSkeletonRows({
  rows = 6,
  columns,
  widths = [],
  cellClassName,
}: TableSkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={`sk-row-${rowIndex}`}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <TableCell key={`sk-cell-${rowIndex}-${columnIndex}`} className={cn('px-4 py-3', cellClassName)}>
              <Skeleton className={cn('h-4 rounded-full bg-[rgba(237,234,226,0.95)]', widths[columnIndex] || 'w-24')} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
