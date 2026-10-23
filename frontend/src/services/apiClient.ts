import { clearAuthState, notifySessionEnded } from './session';

/**
 * Installs a single global wrapper around window.fetch that reacts to any
 * 401 coming back from the .NET API.
 *
 * Why a wrapper and not a per-call-site check: api.ts alone has around thirty
 * fetch call sites, and two components fetch outside it. A wrapper covers all
 * of them with one edit, and it also catches the 401 that a token-mismatch
 * check produces — which is the whole point of the backend-restart work.
 *
 * The login endpoint is excluded: a wrong password is a 401 too, and it must
 * not be mistaken for an ended session.
 */
export function installAuthInterceptor(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await originalFetch(input, init);

    if (response.status !== 401) return response;

    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.includes('/api/')) return response;
    if (url.includes('/api/auth/login')) return response;

    // Read the reason from a clone — consuming the original body here would
    // leave the caller with an unreadable response.
    let reason: string | undefined;
    try {
      const body = await response.clone().json();
      reason = body?.reason;
    } catch {
      // A 401 with no JSON body is fine; the reason is simply unknown.
    }

    clearAuthState();
    notifySessionEnded(reason);

    return response;
  };
}
