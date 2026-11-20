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
  columnWidths: Record<string, number> | null;
  setColumnWidths: (next: Record<string, number> | null) => void;
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

const MIN_COLUMN_WIDTH = 60;
const MAX_COLUMN_WIDTH = 1200;
const RESIZE_CURSOR_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 18 18'><path d='M1 9L5.5 4.5V7.5H12.5V4.5L17 9L12.5 13.5V10.5H5.5V13.5Z' fill='black' stroke='white' stroke-width='1.2' stroke-linejoin='round'/></svg>";
const RESIZE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(RESIZE_CURSOR_SVG)}") 9 9, col-resize`;

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
      onClearRef.current();
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [containerRef, enabled]);
}

function SortableHeadCell({
  id,
  className,
  width,
  onClick,
  onResizeStart,
  onAutoFit,
  children,
}: {
  id: string;
  className?: string;
  width?: number;
  onClick: () => void;
  onResizeStart: (e: React.PointerEvent<HTMLElement>) => void;
  onAutoFit: (e: React.MouseEvent<HTMLElement>) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <TableHead
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform ? { ...transform, y: 0 } : null),
        transition,
        opacity: isDragging ? 0.5 : 1,
        width,
      }}
      className={cn('relative', className)}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      {children}
      <span
        role="separator"
        aria-orientation="vertical"
        className="absolute right-0 top-0 z-10 h-full w-2 touch-none select-none hover:bg-sky-500/40"
        style={{ cursor: RESIZE_CURSOR }}
        onPointerDown={onResizeStart}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={onAutoFit}
      >
        <span aria-hidden="true" className="pointer-events-none absolute right-0 top-[32%] h-[36%] w-px bg-foreground/20" />
      </span>
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
  const { userSort, setUserSort, columnOrder, setColumnOrder, columnWidths, setColumnWidths } = prefs;
  const activeSortColumnId = userSort?.columnId ?? defaultSort?.columnId;
  const activeSortDirection = userSort?.direction ?? defaultSort?.direction ?? 'asc';
  const lastIndexRef = React.useRef<number | null>(null);
  const suppressClickRef = React.useRef(false);
  const dndId = React.useId();
  const [liveWidths, setLiveWidths] = React.useState<Record<string, number> | null>(null);

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

  const effectiveWidths = liveWidths ?? columnWidths;
  const tableWidth = effectiveWidths ? orderedIds.reduce((sum, id) => sum + (effectiveWidths[id] ?? 0), 0) : undefined;

  const startResize = (columnId: string, e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const headRow = e.currentTarget.closest('tr');
    const cells = headRow ? Array.from(headRow.querySelectorAll('th')) : [];
    const base: Record<string, number> = {};
    orderedIds.forEach((id, i) => {
      const measured = cells[i]?.getBoundingClientRect().width;
      base[id] = Math.max(MIN_COLUMN_WIDTH, Math.round(effectiveWidths?.[id] ?? measured ?? 120));
    });
    const startX = e.clientX;
    const startWidth = base[columnId];
    let latest = base;
    let moved = false;
    setLiveWidths(base);

    const onMove = (ev: PointerEvent) => {
      const next = Math.max(MIN_COLUMN_WIDTH, Math.round(startWidth + (ev.clientX - startX)));
      moved = true;
      latest = { ...base, [columnId]: next };
      setLiveWidths(latest);
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
      if (moved) setColumnWidths(latest);
      setLiveWidths(null);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.body.style.cursor = RESIZE_CURSOR;
  };

  const autoFitColumn = (columnId: string, e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const table = e.currentTarget.closest('table');
    if (!table) return;
    const headCells = Array.from(table.querySelectorAll('thead th')) as HTMLElement[];
    const index = orderedIds.indexOf(columnId);
    if (index < 0 || !headCells[index]) return;
    const base: Record<string, number> = {};
    orderedIds.forEach((id, i) => {
      base[id] = Math.max(MIN_COLUMN_WIDTH, Math.round(effectiveWidths?.[id] ?? headCells[i]?.getBoundingClientRect().width ?? 120));
    });
    const saved = {
      layout: table.style.tableLayout,
      width: table.style.width,
      space: table.style.whiteSpace,
      heads: headCells.map((th) => th.style.width),
    };
    table.style.tableLayout = 'auto';
    table.style.width = 'auto';
    table.style.whiteSpace = 'nowrap';
    headCells.forEach((th) => {
      th.style.width = '';
    });
    const natural = headCells[index].getBoundingClientRect().width;
    table.style.tableLayout = saved.layout;
    table.style.width = saved.width;
    table.style.whiteSpace = saved.space;
    headCells.forEach((th, i) => {
      th.style.width = saved.heads[i];
    });
    if (!natural) return;
    setColumnWidths({ ...base, [columnId]: Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.ceil(natural) + 2)) });
  };

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

  const latestRef = React.useRef({ displayRows, getRowId, selectedIds, onSelectionChange });
  React.useEffect(() => {
    latestRef.current = { displayRows, getRowId, selectedIds, onSelectionChange };
  });
  const dragCleanupRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    return () => dragCleanupRef.current?.();
  }, []);

  const handleRowMouseDown = (index: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const current = latestRef.current;

    if (e.shiftKey && lastIndexRef.current !== null) {
      e.preventDefault();
      const from = Math.min(lastIndexRef.current, index);
      const to = Math.max(lastIndexRef.current, index);
      const next = new Set(current.selectedIds);
      current.displayRows.slice(from, to + 1).forEach((r) => next.add(current.getRowId(r)));
      current.onSelectionChange(next);
      return;
    }

    const additive = e.ctrlKey || e.metaKey;
    const base = new Set<string>(current.selectedIds);
    const startIndex = index;
    let lastDragIndex = index;
    let moved = false;
    let pointerX = e.clientX;
    let pointerY = e.clientY;
    let scrollSpeed = 0;
    let frameId: number | null = null;

    const applyDragSelection = () => {
      const { displayRows: list, getRowId: idOf, onSelectionChange: notify } = latestRef.current;
      const from = Math.min(startIndex, lastDragIndex);
      const to = Math.max(startIndex, lastDragIndex);
      const next = new Set<string>(additive ? base : []);
      list.slice(from, to + 1).forEach((r) => next.add(idOf(r)));
      notify(next);
    };

    const updateFromPointer = () => {
      const el = document.elementFromPoint(pointerX, pointerY);
      const rowEl = el?.closest('tr[data-row-index]');
      if (!rowEl) return;
      const idx = Number(rowEl.getAttribute('data-row-index'));
      if (Number.isNaN(idx) || idx === lastDragIndex) return;
      lastDragIndex = idx;
      moved = true;
      applyDragSelection();
    };

    const tick = () => {
      if (scrollSpeed === 0) {
        frameId = null;
        return;
      }
      window.scrollBy(0, scrollSpeed);
      updateFromPointer();
      frameId = window.requestAnimationFrame(tick);
    };

    const updateAutoScroll = () => {
      const edge = 60;
      const maxSpeed = 24;
      const height = window.innerHeight;
      if (pointerY < edge) {
        scrollSpeed = -Math.max(2, Math.round(((edge - Math.max(pointerY, 0)) / edge) * maxSpeed));
      } else if (pointerY > height - edge) {
        scrollSpeed = Math.max(2, Math.round(((Math.min(pointerY, height) - (height - edge)) / edge) * maxSpeed));
      } else {
        scrollSpeed = 0;
      }
      if (scrollSpeed !== 0 && frameId === null) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    const handleMove = (ev: MouseEvent) => {
      pointerX = ev.clientX;
      pointerY = ev.clientY;
      updateFromPointer();
      updateAutoScroll();
    };

    function cleanup() {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
      scrollSpeed = 0;
      dragCleanupRef.current = null;
    }

    function handleUp() {
      cleanup();
      const { displayRows: list, getRowId: idOf, onSelectionChange: notify } = latestRef.current;
      if (!moved) {
        const row = list[startIndex];
        if (row) {
          const id = idOf(row);
          if (additive) {
            const next = new Set<string>(base);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            notify(next);
          } else {
            notify(new Set<string>([id]));
          }
        }
      }
      lastIndexRef.current = startIndex;
    }

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    dragCleanupRef.current = cleanup;
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
        <Table className={effectiveWidths ? 'table-fixed' : undefined} style={tableWidth ? { width: tableWidth } : undefined}>
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
                      width={effectiveWidths?.[column.id]}
                      onResizeStart={(e) => startResize(column.id, e)}
                      onAutoFit={(e) => autoFitColumn(column.id, e)}
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
                  onMouseDown={(e) => handleRowMouseDown(index, e)}
                  data-row-index={index}
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
