/* Keep PalDex up to date without closing and reopening it.
   A home-screen app on iPhone only looks for a new version on a cold start, so we also check whenever the app
   comes back to the front (and every half hour while open). A new version is applied straight away, except
   during a training session or its recap, where it waits until you're done. */
import { registerSW } from 'virtual:pwa-register';

let ready = false;
let apply: (reload?: boolean) => Promise<void> = async () => {};
const busy = () => /^#\/(session|recap)\b/.test(location.hash);
const maybeApply = () => { if (ready && !busy()) { ready = false; void apply(true); } };

export function startUpdates() {
  if (!('serviceWorker' in navigator)) return;
  apply = registerSW({
    immediate: true,
    onNeedRefresh() { ready = true; maybeApply(); },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => { if (navigator.onLine) reg.update().catch(() => {}); };
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { check(); maybeApply(); } });
      setInterval(check, 30 * 60 * 1000);
    },
  });
  window.addEventListener('hashchange', maybeApply);
}
