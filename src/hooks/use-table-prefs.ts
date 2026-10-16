'use client';

import * as React from 'react';

export type SortState = { columnId: string; direction: 'asc' | 'desc' };

const STORAGE_PREFIX = 'stockpilot.table.';

export function useTablePrefs(tableKey: string, validColumnIds: string[]) {
  const storageKey = STORAGE_PREFIX + tableKey;
  const idsKey = validColumnIds.join('|');
  const [userSort, setUserSortState] = React.useState<SortState | null>(null);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { sort?: SortState | null };
      const sort = parsed.sort;
      if (
        sort &&
        idsKey.split('|').includes(sort.columnId) &&
        (sort.direction === 'asc' || sort.direction === 'desc')
      ) {
        setUserSortState(sort);
      }
    } catch {
      /* stored preferences unreadable: ignore */
    }
  }, [storageKey, idsKey]);

  const setUserSort = React.useCallback(
    (next: SortState | null) => {
      setUserSortState(next);
      try {
        if (next) window.localStorage.setItem(storageKey, JSON.stringify({ sort: next }));
        else window.localStorage.removeItem(storageKey);
      } catch {
        /* storage unavailable: ignore */
      }
    },
    [storageKey]
  );

  const resetPrefs = React.useCallback(() => setUserSort(null), [setUserSort]);

  return { userSort, setUserSort, resetPrefs };
}
