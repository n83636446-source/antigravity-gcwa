'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Fetches a list from an API function and returns { data, isLoading, error, refetch }.
 * Drop-in replacement for Firebase's useCollection hook.
 */
export function useApiCollection<T>(fetchFn: () => Promise<T[]>): {
  data: T[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  setData: React.Dispatch<React.SetStateAction<T[] | null>>;
} {
  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  
  // Store the latest fetchFn without triggering effect loops
  const fetchFnRef = useRef(fetchFn);
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchFnRef.current()
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]); // Exclude fetchFn to prevent infinite render loops when defined inline

  return { data, isLoading, error, refetch, setData };
}



