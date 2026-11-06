// Shared session helpers. Everything that touches the localStorage JWT sits here
// once, so there is exactly one place a frontend can clear or inspect a token.

export const AUTH_TOKEN_KEY = 'steeltrack_auth_token';
export const USER_KEY = 'steeltrack_user';
export const SESSION_KEY = 'steeltrack_user_session';

export type SessionEndReason =
  | 'server_restarted'
  | 'token_expired'
  | 'invalid_token'
  | 'missing_token'
  | 'forbidden';

/**
 * Decode the JWT payload (middle segment) without throwing on garbage data.
 * Used to read the `stt_instance` claim at boot to confirm the stored token
 * belongs to this process, without an extra round trip.
 */
export function decodeJwtPayload(token: string | null):
  { stt_instance?: string; exp?: number } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const decoded = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { stt_instance: decoded.stt_instance, exp: decoded.exp };
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Remove every key the session state lives under. Called from the login
 * screen, the logout path and — when the boot check learns the server was
 * restarted — the interceptor too.
 */
export function clearAuthState(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(SESSION_KEY);
}

/** A tiny pub-sink so non-React code (the interceptor in particular) can tell
 * the app that the session ended. */
type SessionEndListener = (reason?: string) => void;
const sessionEndListeners: Set<SessionEndListener> = new Set();

/** The reason the most recent session end happened, for the login screen. */
let lastEndReason: string | undefined;

export function onSessionEnd(cb: SessionEndListener): () => void {
  sessionEndListeners.add(cb);
  return () => sessionEndListeners.delete(cb);
}

export function notifySessionEnded(reason?: string): void {
  lastEndReason = reason;
  sessionEndListeners.forEach((cb) => cb(reason));
}

export function getLastEndReason(): string | undefined {
  return lastEndReason;
}

/** Translate a backend reason into a message for the login screen. */
export function messageForReason(reason?: string): string {
  switch (reason) {
    case 'server_restarted':
      return '';
    case 'token_expired':
      return 'Your session expired. Please sign in again.';
    case 'missing_token':
      return 'No session token was supplied. Please sign in again.';
    case 'invalid_token':
      return 'Your session is no longer valid. Please sign in again.';
    case 'forbidden':
      return 'Your account does not have access to this area.';
    default:
      return 'Your session has ended. Please sign in again.';
  }
}
