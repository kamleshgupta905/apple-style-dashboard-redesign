import { useCallback, useEffect, useRef, useState } from "react";

/** Minimal data hook: loads on mount, supports reload + optional polling. */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = [], opts: { poll?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const alive = useRef(true);

  const run = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const r = await fnRef.current();
      if (!alive.current) return;
      setData(r);
      setError(null);
    } catch (e: any) {
      if (!alive.current) return;
      setError(e?.message || "Something went wrong");
    } finally {
      if (alive.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    run();
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!opts.poll) return;
    const t = setInterval(() => run(true), opts.poll);
    return () => clearInterval(t);
  }, [opts.poll, run]);

  return { data, loading, refreshing, error, reload: () => run(true), reset: () => run(false), setData };
}
