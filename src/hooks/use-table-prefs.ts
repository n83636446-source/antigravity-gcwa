'use client';

import * as React from 'react';

export type SortState = { columnId: string; direction: 'asc' | 'desc' };
export type ColumnWidths = Record<string, number>;

const STORAGE_PREFIX = 'stockpilot.table.';
const MIN_STORED_WIDTH = 40;
const MAX_STORED_WIDTH = 1200;

export function useTablePrefs(tableKey: string, validColumnIds: string[]) {
  const storageKey = STORAGE_PREFIX + tableKey;
  const idsKey = validColumnIds.join('|');
  const [userSort, setUserSortState] = React.useState<SortState | null>(null);
  const [columnOrder, setColumnOrderState] = React.useState<string[] | null>(null);
  const [columnWidths, setColumnWidthsState] = React.useState<ColumnWidths | null>(null);
  const latestRef = React.useRef<{ sort: SortState | null; order: string[] | null; widths: ColumnWidths | null }>({
    sort: null,
    order: null,
    widths: null,
  });

  const save = React.useCallback(
    (sort: SortState | null, order: string[] | null, widths: ColumnWidths | null) => {
      latestRef.current = { sort, order, widths };
      try {
        if (sort || order || widths) window.localStorage.setItem(storageKey, JSON.stringify({ sort, order, widths }));
        else window.localStorage.removeItem(storageKey);
      } catch {
        /* storage unavailable: ignore */
      }
    },
    [storageKey]
  );

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        sort?: SortState | null;
        order?: string[] | null;
        widths?: Record<string, unknown> | null;
      };
      const ids = idsKey.split('|');
      let sort: SortState | null = null;
      let order: string[] | null = null;
      let widths: ColumnWidths | null = null;
      const s = parsed.sort;
      if (s && ids.includes(s.columnId) && (s.direction === 'asc' || s.direction === 'desc')) {
        sort = s;
      }
      const o = parsed.order;
      if (Array.isArray(o) && o.length === ids.length && ids.every((id) => o.includes(id))) {
        order = o;
      }
      const w = parsed.widths;
      if (
        w &&
        typeof w === 'object' &&
        ids.every((id) => {
          const value = w[id];
          return typeof value === 'number' && value >= MIN_STORED_WIDTH && value <= MAX_STORED_WIDTH;
        })
      ) {
        widths = Object.fromEntries(ids.map((id) => [id, Math.round(w[id] as number)]));
      }
      latestRef.current = { sort, order, widths };
      setUserSortState(sort);
      setColumnOrderState(order);
      setColumnWidthsState(widths);
    } catch {
      /* stored preferences unreadable: ignore */
    }
  }, [storageKey, idsKey]);

  const setUserSort = React.useCallback(
    (next: SortState | null) => {
      setUserSortState(next);
      save(next, latestRef.current.order, latestRef.current.widths);
    },
    [save]
  );

  const setColumnOrder = React.useCallback(
    (next: string[] | null) => {
      setColumnOrderState(next);
      save(latestRef.current.sort, next, latestRef.current.widths);
    },
    [save]
  );

  const setColumnWidths = React.useCallback(
    (next: ColumnWidths | null) => {
      setColumnWidthsState(next);
      save(latestRef.current.sort, latestRef.current.order, next);
    },
    [save]
  );

  const resetPrefs = React.useCallback(() => {
    setUserSortState(null);
    setColumnOrderState(null);
    setColumnWidthsState(null);
    save(null, null, null);
  }, [save]);

  return {
    userSort,
    setUserSort,
    columnOrder,
    setColumnOrder,
    columnWidths,
    setColumnWidths,
    resetPrefs,
    isCustomized: userSort !== null || columnOrder !== null || columnWidths !== null,
  };
}
