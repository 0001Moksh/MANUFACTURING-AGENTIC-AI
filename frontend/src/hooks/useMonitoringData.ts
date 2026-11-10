import { useCallback, useEffect, useRef, useState } from 'react';

// Both host dashboards use the same cancellation and refresh lifecycle.
export function useMonitoringData<T>(fetcher: (minutes: number, limit: number, signal: AbortSignal) => Promise<T>, label: string) {
  const [data, setData] = useState<T | null>(null);
  const [rangeMinutes, setRangeMinutes] = useState(30);
  const [refreshSeconds, setRefreshSeconds] = useState(10);
  const [refreshInput, setRefreshInput] = useState('10');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const activeRequest = useRef<AbortController | null>(null);
  const load = useCallback(async (silent = false) => {
    if (activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    if (!silent) setLoading(true);
    try {
      const payload = await fetcher(rangeMinutes, 5000, controller.signal);
      if (!controller.signal.aborted) { setData(payload); setError(''); }
    } catch (reason: any) {
      if (!controller.signal.aborted) setError(reason?.response?.data?.detail || `${label} monitoring is unavailable. Displayed readings may be out of date.`);
    } finally {
      if (activeRequest.current === controller) { activeRequest.current = null; setLoading(false); }
    }
  }, [fetcher, rangeMinutes, label]);
  useEffect(() => {
    setData(null);
    void load();
    return () => { activeRequest.current?.abort(); activeRequest.current = null; };
  }, [load]);
  useEffect(() => {
    if (refreshSeconds <= 0) return;
    const timer = window.setInterval(() => void load(true), refreshSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [load, refreshSeconds]);
  const applyRefresh = () => {
    const value = Number(refreshInput);
    if (!Number.isFinite(value)) return;
    const normalized = Math.max(0, Math.min(3600, Math.round(value)));
    setRefreshInput(String(normalized)); setRefreshSeconds(normalized);
  };
  return { data, rangeMinutes, setRangeMinutes, refreshSeconds, refreshInput, setRefreshInput, loading, error, load, applyRefresh };
}
