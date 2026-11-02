import { getToken, saveToken, clearToken } from './session-store';

export const API_ORIGIN = (process.env.EXPO_PUBLIC_API_URL || 'https://enriveasignal.com').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export { getToken, saveToken, clearToken };

export async function api<T = any>(path: string, method = 'GET', payload?: unknown): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${API_ORIGIN}/api/mobile/${path.replace(/^\//, '')}`, {
    method,
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  }).catch(() => { throw new ApiError(`Cannot reach ${API_ORIGIN}. Check the mobile API URL and that the Next.js server is running.`, 0); });
  let data: any;
  try { data = await response.json(); } catch { throw new ApiError('Unexpected response from Enrivea. Try again.', response.status); }
  if (!response.ok) throw new ApiError(data?.error || 'Request could not be completed.', response.status);
  return data as T;
}

export const userApi = <T = any>(path: string, method = 'GET', payload?: unknown) => api<T>(`proxy/${path}`, method, payload);
