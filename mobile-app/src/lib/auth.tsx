import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { ApiError, api, clearToken, getToken, saveToken } from './api';

export type MobileUser = { id: string; name: string; email: string; isDemo: boolean; mustChangePassword: boolean };
type AuthValue = { user: MobileUser | null; loading: boolean; login: (email: string, password: string, demo?: boolean) => Promise<void>; logout: () => Promise<void>; refresh: () => Promise<void> };
const Context = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const token = await getToken();
    if (!token) { setUser(null); setLoading(false); return; }
    try { const state = await api<{ user: MobileUser }>('auth/session'); setUser(state.user); }
    catch (error) { if (error instanceof ApiError && error.status === 401) await clearToken(); setUser(null); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => subscription.remove();
  }, [refresh]);
  const login = async (email: string, password: string, demo = false) => {
    const state = await api<{ token: string; user: MobileUser }>('auth/login', 'POST', demo
      ? { demo: true, deviceLabel: 'Enrivea mobile app' }
      : { email: email.trim(), password, deviceLabel: 'Enrivea mobile app' });
    await saveToken(state.token);
    setUser(state.user);
  };
  const logout = async () => {
    try { await api('push', 'DELETE'); await api('auth/logout', 'POST'); } catch { /* Local sign-out always succeeds. */ }
    await clearToken(); setUser(null);
  };
  return <Context.Provider value={{ user, loading, login, logout, refresh }}>{children}</Context.Provider>;
}

export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
