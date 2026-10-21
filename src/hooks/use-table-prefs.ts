'use client';

import * as React from 'react';

export type SortState = { columnId: string; direction: 'asc' | 'desc' };

const STORAGE_PREFIX = 'stockpilot.table.';

export function useTablePrefs(tableKey: string, validColumnIds: string[]) {
  const storageKey = STORAGE_PREFIX + tableKey;
  const idsKey = validColumnIds.join('|');
  const [userSort, setUserSortState] = React.useState<SortState | null>(null);
  const [columnOrder, setColumnOrderState] = React.useState<string[] | null>(null);
  const latestRef = React.useRef<{ sort: SortState | null; order: string[] | null }>({ sort: null, order: null });

  const save = React.useCallback(
    (sort: SortState | null, order: string[] | null) => {
      latestRef.current = { sort, order };
      try {
        if (sort || order) window.localStorage.setItem(storageKey, JSON.stringify({ sort, order }));
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
      const parsed = JSON.parse(raw) as { sort?: SortState | null; order?: string[] | null };
      const ids = idsKey.split('|');
      let sort: SortState | null = null;
      let order: string[] | null = null;
      const s = parsed.sort;
      if (s && ids.includes(s.columnId) && (s.direction === 'asc' || s.direction === 'desc')) {
        sort = s;
      }
      const o = parsed.order;
      if (Array.isArray(o) && o.length === ids.length && ids.every((id) => o.includes(id))) {
        order = o;
      }
      latestRef.current = { sort, order };
      setUserSortState(sort);
      setColumnOrderState(order);
    } catch {
      /* stored preferences unreadable: ignore */
    }
  }, [storageKey, idsKey]);

  const setUserSort = React.useCallback(
    (next: SortState | null) => {
      setUserSortState(next);
      save(next, latestRef.current.order);
    },
    [save]
  );

  const setColumnOrder = React.useCallback(
    (next: string[] | null) => {
      setColumnOrderState(next);
      save(latestRef.current.sort, next);
    },
    [save]
  );

  const resetPrefs = React.useCallback(() => {
    setUserSortState(null);
    setColumnOrderState(null);
    save(null, null);
  }, [save]);

  return {
    userSort,
    setUserSort,
    columnOrder,
    setColumnOrder,
    resetPrefs,
    isCustomized: userSort !== null || columnOrder !== null,
  };
}
