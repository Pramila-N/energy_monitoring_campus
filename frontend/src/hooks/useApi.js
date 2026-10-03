import { useCallback, useEffect, useRef, useState } from 'react';

/** Fetch data on mount (or when deps change) with loading/error/refresh. */
export function useApi(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const hasDataRef = useRef(false);
  hasDataRef.current = Boolean(data);

  const load = useCallback(async () => {
    const background = hasDataRef.current;
    if (!background) setLoading(true);
    else setIsRefreshing(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      setData(result);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load, setData, isRefreshing };
}

/** Poll an API every intervalMs while active. Defaults to once per minute. */
export function usePolling(fetcher, intervalMs = 60000, active = true) {
  const { data, loading, error, refetch, setData, isRefreshing } = useApi(fetcher, [active]);
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(refetch, intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, refetch]);
  return { data, loading, error, refetch, setData, isRefreshing };
}