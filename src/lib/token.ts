/**
 * Single source of truth for the auth token.
 *
 * The canonical key is `token`. We also read the legacy `authToken` key that
 * the old app and the recovered library page used, so sessions carry over.
 */
const TOKEN_KEY = 'token';
const LEGACY_TOKEN_KEYS = ['authToken'];

export function getToken(): string | null {
  const primary = localStorage.getItem(TOKEN_KEY);
  if (primary) return primary;
  for (const key of LEGACY_TOKEN_KEYS) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }
  return null;
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  for (const key of LEGACY_TOKEN_KEYS) localStorage.removeItem(key);
  localStorage.removeItem('userData');
}