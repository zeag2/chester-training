/* Password reset. Supabase's reset email links back to the app with the session in the hash
   (#access_token=…&refresh_token=…&type=recovery), or with #error=…&error_code=otp_expired when the link is stale.
   The app uses the hash for its own pages, so at startup we take those out of the address bar (never left there or in
   history) and open #/reset-password, which finishes the job. */
export interface Recovery { accessToken?: string; refreshToken?: string; error?: string }
let pending: Recovery | null = null;

/** The app's address, which the reset email links back to (Josh adds it to Supabase's Redirect URLs). */
export const resetRedirect = () => location.origin + import.meta.env.BASE_URL;

/** At startup: keep a reset link's tokens (or its error) and switch to the set-new-password page. */
export function takeRecoveryFromUrl(): boolean {
  const h = new URLSearchParams(location.hash.replace(/^#\/?/, ''));
  const q = new URLSearchParams(location.search);
  const recovery = h.get('type') === 'recovery' && h.get('access_token') && h.get('refresh_token');
  const err = h.get('error_code') || h.get('error') ? h : q.get('error_code') ? q : null;
  if (!recovery && !err) return false;
  pending = recovery
    ? { accessToken: h.get('access_token')!, refreshToken: h.get('refresh_token')! }
    : { error: err!.get('error_code') || err!.get('error') || 'error' };
  history.replaceState(history.state, '', location.pathname + '#/reset-password');
  return true;
}

/** The reset link's tokens or error, once (null when the page was opened some other way). */
export function takePendingRecovery(): Recovery | null { const p = pending; pending = null; return p; }
/** For tests. */
export function setPendingRecovery(p: Recovery | null) { pending = p; }
