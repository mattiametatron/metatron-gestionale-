/**
 * Gestione sicura della sessione utente in memoria (React / JS runtime).
 * Il Bearer token NON viene mai salvato in localStorage o sessionStorage.
 */

let currentAuthToken: string | null = null;
let currentActiveUserId: string | null = null;

// Cache in memoria per ObjectURL autenticati (foto/file caricati con Bearer header)
const authenticatedBlobUrlCache = new Map<string, string>();
const inFlightBlobRequests = new Map<string, Promise<string | null>>();

export function getAuthToken(): string | null {
  return currentAuthToken;
}

export function setAuthToken(token: string | null): void {
  if (currentAuthToken !== token) {
    clearAuthBlobCache();
  }
  currentAuthToken = token;
}

export function getActiveUserId(): string | null {
  return currentActiveUserId;
}

export function setActiveUserId(userId: string | null): void {
  if (currentActiveUserId !== userId) {
    clearAuthBlobCache();
  }
  currentActiveUserId = userId;
}

export function clearAuthSession(): void {
  currentAuthToken = null;
  currentActiveUserId = null;
  clearAuthBlobCache();
}

export function clearAuthBlobCache(): void {
  for (const objUrl of authenticatedBlobUrlCache.values()) {
    try {
      URL.revokeObjectURL(objUrl);
    } catch {
      // ignore
    }
  }
  authenticatedBlobUrlCache.clear();
  inFlightBlobRequests.clear();
}

/**
 * Wrapper fetch che allega automaticamente l'header Authorization: Bearer <token>,
 * invia i cookie HttpOnly di sessione (credentials: 'include') e l'header CSRF
 * X-Requested-With verso le rotte API del server.
 */
export function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers || {});
  if (currentAuthToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${currentAuthToken}`);
  }
  if (!headers.has('X-Requested-With')) {
    headers.set('X-Requested-With', 'XMLHttpRequest');
  }
  return fetch(input, {
    credentials: 'include',
    ...init,
    headers,
  });
}

/**
 * Scarica una risorsa protetta (es. /api/photos/:id/file o /api/files/:id/content)
 * usando Authorization: Bearer e la converte in ObjectURL utilizzabile da <img> o <iframe>.
 */
export async function fetchAuthenticatedBlobUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  const cached = authenticatedBlobUrlCache.get(url);
  if (cached) return cached;

  const existing = inFlightBlobRequests.get(url);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const resp = await authFetch(url);
      if (!resp.ok) return null;
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      authenticatedBlobUrlCache.set(url, objectUrl);
      return objectUrl;
    } catch {
      return null;
    } finally {
      inFlightBlobRequests.delete(url);
    }
  })();

  inFlightBlobRequests.set(url, promise);
  return promise;
}
