import { CargoLoad } from '../types/warehouse';
import { authFetch, getAuthToken } from './authSession';

export const LIVE_PUBLIC_URL =
  'https://ais-dev-junosxdkix6up54egjy3o6-613128675389.europe-west2.run.app';

/**
 * Utility per sincronizzare i carichi e le distinte con il server dell'account autenticato.
 * Invia il Bearer token esclusivamente verso la stessa origine.
 */
function getSameOriginEndpoint(path: string): string | null {
  if (typeof window === 'undefined') return null;
  if (
    window.location.protocol !== 'file:' &&
    window.location.origin &&
    !window.location.origin.includes('about:blank')
  ) {
    return `${window.location.origin}${path}`;
  }
  return null;
}

export async function syncSingleLoadToServer(
  load: CargoLoad,
  senderId = 'web_client'
): Promise<boolean> {
  if (!load || (!load.code && !load.id)) return false;
  if (!getAuthToken()) return false;

  const url = getSameOriginEndpoint('/api/sync-load');
  if (!url) return false;

  try {
    const response = await authFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ load, senderId }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function syncAllLoadsToServer(
  loads: CargoLoad[],
  senderId = 'web_client_batch'
): Promise<boolean> {
  if (!Array.isArray(loads) || loads.length === 0) return false;
  if (!getAuthToken()) return false;

  const url = getSameOriginEndpoint('/api/loads');
  if (!url) return false;

  try {
    const response = await authFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ loads, senderId }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
