import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ApiError } from './api';

export function useResource<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const hasLoaded = useRef(false);
  const refresh = useCallback(async (pull = false) => {
    if (pull || hasLoaded.current) setRefreshing(true); else setLoading(true);
    try { setData(await load()); hasLoaded.current = true; setError(''); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Could not load this section.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [load]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return { data, loading, refreshing, error, refresh, setData };
}
