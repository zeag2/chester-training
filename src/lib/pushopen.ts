/* A tapped notification on an already open PalDex: the service worker (public/push-sw.js) posts the screen to open,
   and this moves there. Only our own hash routes. */
export const OPEN_ROUTE = /^#\/[\w\-/]*$/;

export function listenForPushOpen(sw: Pick<ServiceWorkerContainer, 'addEventListener'> | undefined = navigator.serviceWorker) {
  sw?.addEventListener('message', (e: Event) => {
    const d = (e as MessageEvent).data as { type?: string; url?: unknown } | null;
    if (d?.type === 'paldex-open' && typeof d.url === 'string' && OPEN_ROUTE.test(d.url) && location.hash !== d.url) location.hash = d.url;
  });
}
