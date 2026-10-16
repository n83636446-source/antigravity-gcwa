'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, RotateCcw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
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
  showCheckboxes?: boolean;
};

const isEmptyValue = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === '';

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
  showCheckboxes = true,
}: DataTableProps<T>) {
  const columnIds = React.useMemo(() => columns.map((c) => c.id), [columns]);
  const { userSort, setUserSort, resetPrefs } = useTablePrefs(tableKey, columnIds);
  const activeSortColumnId = userSort?.columnId ?? defaultSort?.columnId;
  const activeSortDirection = userSort?.direction ?? defaultSort?.direction ?? 'asc';
  const lastIndexRef = React.useRef<number | null>(null);

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

  const toggleId = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const handleRowClick = (row: T, index: number, e: React.MouseEvent) => {
    const id = getRowId(row);
    if (e.shiftKey && lastIndexRef.current !== null) {
      const from = Math.min(lastIndexRef.current, index);
      const to = Math.max(lastIndexRef.current, index);
      const next = e.ctrlKey || e.metaKey ? new Set(selectedIds) : new Set<string>();
      displayRows.slice(from, to + 1).forEach((r) => next.add(getRowId(r)));
      onSelectionChange(next);
      return;
    }
    lastIndexRef.current = index;
    if (e.ctrlKey || e.metaKey) {
      toggleId(id);
      return;
    }
    if (selectedIds.size === 1 && selectedIds.has(id)) {
      onSelectionChange(new Set());
      return;
    }
    onSelectionChange(new Set([id]));
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

  const allSelected = displayRows.length > 0 && displayRows.every((r) => selectedIds.has(getRowId(r)));

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
            {showCheckboxes && (
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={() =>
                    onSelectionChange(allSelected ? new Set<string>() : new Set(displayRows.map(getRowId)))
                  }
                  aria-label="Tout sélectionner"
                />
              </TableHead>
            )}
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
                className={cn('cursor-pointer select-none', isSelected && 'bg-muted/50', rowClassName?.(row))}
              >
                {showCheckboxes && (
                  <TableCell
                    className="w-10"
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => {
                        lastIndexRef.current = index;
                        toggleId(id);
                      }}
                      aria-label="Sélectionner la ligne"
                    />
                  </TableCell>
                )}
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
