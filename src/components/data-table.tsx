'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, RotateCcw } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type SortState } from '@/hooks/use-table-prefs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type DataTableColumn<T> = {
  id: string;
  label: string;
  cell: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number | null | undefined;
  className?: string;
  headClassName?: string;
};

export type TablePrefs = {
  userSort: SortState | null;
  setUserSort: (next: SortState | null) => void;
  columnOrder: string[] | null;
  setColumnOrder: (next: string[] | null) => void;
  resetPrefs: () => void;
  isCustomized: boolean;
};

type DataTableProps<T> = {
  prefs: TablePrefs;
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

export function ResetSortButton({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            'h-8 w-8 transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
            visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
          aria-hidden={!visible}
          tabIndex={visible ? 0 : -1}
          onClick={onClick}
        >
          <RotateCcw className="h-4 w-4" />
          <span className="sr-only">Réinitialiser le tri et les colonnes</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Réinitialiser le tri et les colonnes</TooltipContent>
    </Tooltip>
  );
}

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
      // Dialog overlays (class "bg-black/50") are plain divs without a dialog role: clicks on them must not clear the selection.
      if (target.closest?.('[role="dialog"], [role="alertdialog"], [role="tooltip"], [role="alert"], [class*="bg-black/50"]')) return;
      console.log('[selection-clear]', target.tagName, String((target as HTMLElement).className ?? ''), (target.outerHTML ?? '').slice(0, 300)); // TEMP DIAGNOSTIC: remove later
      onClearRef.current();
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [containerRef, enabled]);
}

function SortableHeadCell({
  id,
  className,
  onClick,
  children,
}: {
  id: string;
  className?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <TableHead
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={className}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      {children}
    </TableHead>
  );
}

export function DataTable<T>({
  prefs,
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
  const { userSort, setUserSort, columnOrder, setColumnOrder } = prefs;
  const activeSortColumnId = userSort?.columnId ?? defaultSort?.columnId;
  const activeSortDirection = userSort?.direction ?? defaultSort?.direction ?? 'asc';
  const lastIndexRef = React.useRef<number | null>(null);
  const suppressClickRef = React.useRef(false);
  const dndId = React.useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const orderedColumns = React.useMemo(() => {
    if (!columnOrder) return columns;
    const byId = new Map(columns.map((c) => [c.id, c]));
    const ordered = columnOrder.map((id) => byId.get(id)).filter((c): c is DataTableColumn<T> => !!c);
    const missing = columns.filter((c) => !columnOrder.includes(c.id));
    return [...ordered, ...missing];
  }, [columns, columnOrder]);

  const orderedIds = React.useMemo(() => orderedColumns.map((c) => c.id), [orderedColumns]);

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
    if (suppressClickRef.current) return;
    if (!column.sortValue) return;
    lastIndexRef.current = null;
    if (column.id === activeSortColumnId) {
      setUserSort({ columnId: column.id, direction: activeSortDirection === 'asc' ? 'desc' : 'asc' });
    } else {
      setUserSort({ columnId: column.id, direction: 'asc' });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(String(active.id));
    const newIndex = orderedIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    setColumnOrder(arrayMove(orderedIds, oldIndex, newIndex));
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
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableContext items={orderedIds} strategy={horizontalListSortingStrategy}>
                {orderedColumns.map((column) => {
                  const sortable = !!column.sortValue;
                  const isActive = sortable && column.id === activeSortColumnId;
                  return (
                    <SortableHeadCell
                      key={column.id}
                      id={column.id}
                      className={cn(sortable && 'cursor-pointer', 'select-none', column.headClassName)}
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
                    </SortableHeadCell>
                  );
                })}
              </SortableContext>
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
                  {orderedColumns.map((column) => (
                    <TableCell key={column.id} className={column.className}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DndContext>
    </div>
  );
}
