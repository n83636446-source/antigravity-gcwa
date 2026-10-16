'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, RotateCcw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTablePrefs, type SortState } from '@/hooks/use-table-prefs';

export type DataTableColumn<T> = {
  id: string;
  label: string;
  cell: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number | null | undefined;
  className?: string;
  headClassName?: string;
};

type DataTableProps<T> = {
  tableKey: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onRowDoubleClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  defaultSort?: SortState;
  emptyMessage?: React.ReactNode;
};

const isEmptyValue = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === '';

export function useClearSelectionOnOutsideClick(
  containerRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  onClear: () => void
) {
  const onClearRef = React.useRef(onClear);

  React.useEffect(() => {
    onClearRef.current = onClear;
  });

  React.useEffect(() => {
    if (!enabled) return;
    const handleMouseDown = (e: MouseEvent) => {
      const container = containerRef.current;
      const target = e.target as Element | null;
      if (!container || !target || container.contains(target)) return;
      if (target.closest?.('[role="dialog"], [role="alertdialog"], [role="tooltip"], [role="alert"]')) return;
      onClearRef.current();
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [containerRef, enabled]);
}

export function DataTable<T>({
  tableKey,
  columns,
  rows,
  getRowId,
  selectedIds,
  onSelectionChange,
  onRowDoubleClick,
  rowClassName,
  defaultSort,
  emptyMessage,
}: DataTableProps<T>) {
  const columnIds = React.useMemo(() => columns.map((c) => c.id), [columns]);
  const { userSort, setUserSort, resetPrefs } = useTablePrefs(tableKey, columnIds);
  const activeSortColumnId = userSort?.columnId ?? defaultSort?.columnId;
  const activeSortDirection = userSort?.direction ?? defaultSort?.direction ?? 'asc';
  const lastIndexRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (selectedIds.size === 0) lastIndexRef.current = null;
  }, [selectedIds]);

  const displayRows = React.useMemo(() => {
    const column = columns.find((c) => c.id === activeSortColumnId);
    const getValue = column?.sortValue;
    if (!getValue) return rows;
    const factor = activeSortDirection === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      const aEmpty = isEmptyValue(va);
      const bEmpty = isEmptyValue(vb);
      if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1;
      if (typeof va === 'number' && typeof vb === 'number') return factor * (va - vb);
      return factor * String(va).localeCompare(String(vb), 'fr', { numeric: true, sensitivity: 'base' });
    });
  }, [rows, columns, activeSortColumnId, activeSortDirection]);

  const handleRowClick = (row: T, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey && lastIndexRef.current !== null) {
      const from = Math.min(lastIndexRef.current, index);
      const to = Math.max(lastIndexRef.current, index);
      const next = new Set(selectedIds);
      displayRows.slice(from, to + 1).forEach((r) => next.add(getRowId(r)));
      onSelectionChange(next);
      return;
    }
    const id = getRowId(row);
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
    lastIndexRef.current = index;
  };

  const handleSortClick = (column: DataTableColumn<T>) => {
    if (!column.sortValue) return;
    lastIndexRef.current = null;
    if (column.id === activeSortColumnId) {
      setUserSort({ columnId: column.id, direction: activeSortDirection === 'asc' ? 'desc' : 'asc' });
    } else {
      setUserSort({ columnId: column.id, direction: 'asc' });
    }
  };

  if (rows.length === 0) {
    return (
      <>
        {emptyMessage ?? (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            Aucun élément à afficher.
          </div>
        )}
      </>
    );
  }

  return (
    <div>
      {userSort && (
        <div className="mb-2 flex justify-end">
          <Button variant="ghost" size="sm" onClick={resetPrefs}>
            <RotateCcw className="mr-1 h-3 w-3" />
            Réinitialiser
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => {
              const sortable = !!column.sortValue;
              const isActive = sortable && column.id === activeSortColumnId;
              return (
                <TableHead
                  key={column.id}
                  className={cn(sortable && 'cursor-pointer select-none', column.headClassName)}
                  onClick={() => handleSortClick(column)}
                >
                  <span className="inline-flex items-center gap-1">
                    {column.label}
                    {sortable &&
                      (isActive ? (
                        activeSortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />
                      ))}
                  </span>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayRows.map((row, index) => {
            const id = getRowId(row);
            const isSelected = selectedIds.has(id);
            return (
              <TableRow
                key={id}
                onClick={(e) => handleRowClick(row, index, e)}
                onDoubleClick={() => onRowDoubleClick?.(row)}
                className={cn(
                  'cursor-pointer select-none transition-colors duration-150 ease-out',
                  isSelected ? 'bg-sky-500/10 hover:bg-sky-500/20' : 'hover:bg-muted/50',
                  rowClassName?.(row)
                )}
              >
                {columns.map((column) => (
                  <TableCell key={column.id} className={column.className}>
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
