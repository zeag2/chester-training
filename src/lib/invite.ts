/* Friend invites. An invite link is <app>#/friends/<CODE>; opening it fills the code in, ready to tap Add (which sends a friend request). The code is
   kept until it's used, so it survives setting up the app first (a new friend has no account yet). */
const KEY = 'paldex-pending-friend';
const clean = (c: string) => c.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12);

export function pendingFriend(): string { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } }
export function setPendingFriend(code: string) { try { const c = clean(code); if (c) localStorage.setItem(KEY, c); else localStorage.removeItem(KEY); } catch { /* private mode */ } }

/** At startup: remember a code from an invite link (#/friends/CODE or ?friend=CODE). */
export function captureInvite() {
  const fromHash = /^#\/friends\/([A-Za-z0-9]{4,12})/.exec(location.hash)?.[1];
  const fromQuery = new URLSearchParams(location.search).get('friend');
  const code = fromHash ?? fromQuery; if (code) setPendingFriend(code);
}

export function inviteLink(code: string): string { return `${location.origin}${import.meta.env.BASE_URL}#/friends/${clean(code)}`; }
export function inviteText(code: string, petNames: string): string {
  return `Let's be friends on PalDex so ${petNames || 'our cats'} can meet! Tap to add me: ${inviteLink(code)} (or enter my friend code ${clean(code)}).`;
}
