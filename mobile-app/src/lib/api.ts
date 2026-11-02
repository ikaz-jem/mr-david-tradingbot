import { getToken, saveToken, clearToken } from './session-store';

export const API_ORIGIN = (process.env.EXPO_PUBLIC_API_URL || 'https://enriveasignal.com').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

function apiErrorMessage(data: unknown, status: number): string {
  const error = data && typeof data === 'object' && 'error' in data ? data.error : undefined;
  if (error && typeof error === 'object' && 'code' in error && error.code === 'challenge') {
    return 'Enrivea security is blocking mobile API requests. Please contact support so the mobile API can be allowed through the firewall.';
  }
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  if (status === 403) return 'Access to the Enrivea mobile API was denied. Please contact support.';
  return 'Request could not be completed. Please try again.';
}

export { getToken, saveToken, clearToken };

export async function api<T = any>(path: string, method = 'GET', payload?: unknown): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${API_ORIGIN}/api/mobile/${path.replace(/^\//, '')}`, {
    method,
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  }).catch(() => { throw new ApiError(`Could not connect to Enrivea. Check your internet connection. If the website works, its firewall may be blocking the mobile app.`, 0); });
  let data: any;
  try { data = await response.json(); } catch { throw new ApiError('Unexpected response from Enrivea. Try again.', response.status); }
  if (!response.ok) throw new ApiError(apiErrorMessage(data, response.status), response.status);
  return data as T;
}

export const userApi = <T = any>(path: string, method = 'GET', payload?: unknown) => api<T>(`proxy/${path}`, method, payload);
