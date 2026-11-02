const TOKEN_KEY = 'enrivea.mobile.session.v1';

export async function getToken() {
  return typeof window === 'undefined' ? null : window.sessionStorage.getItem(TOKEN_KEY);
}

export async function saveToken(value: string) {
  if (typeof window !== 'undefined') window.sessionStorage.setItem(TOKEN_KEY, value);
}

export async function clearToken() {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(TOKEN_KEY);
}
