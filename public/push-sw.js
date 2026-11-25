/* PalDex push notifications, loaded into the generated service worker with workbox `importScripts`
   (vite.config.ts). The send-push Edge Function sends JSON {title, body, url, tag}; `url` is a hash route (#/friends).
   Every push shows a notification: iPhone drops a subscription that gets pushes without one (userVisibleOnly). */
/* eslint-env serviceworker */
(function () {
  var SAFE = /^#\/[\w\-\/]*$/; // only our own hash routes, never another site
  var scope = function () { return self.registration.scope; };

  self.addEventListener('push', function (event) {
    var d = {};
    try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : '' }; }
    var tag = typeof d.tag === 'string' ? d.tag : '';
    var opts = {
      body: typeof d.body === 'string' ? d.body : '',
      icon: scope() + 'icon-192.png',
      badge: scope() + 'badge-96.png',
      data: { url: typeof d.url === 'string' && SAFE.test(d.url) ? d.url : '#/' },
    };
    if (tag) { opts.tag = tag; opts.renotify = true; } // a newer one with the same tag replaces the older
    event.waitUntil(self.registration.showNotification(typeof d.title === 'string' && d.title ? d.title : 'PalDex', opts));
  });

  // Tap: bring PalDex to the front on that screen (an open window if there is one, else a new one).
  self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    var url = (event.notification.data && SAFE.test(event.notification.data.url)) ? event.notification.data.url : '#/';
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (wins) {
      for (var i = 0; i < wins.length; i++) {
        var w = wins[i];
        if (w.url.indexOf(scope()) !== 0) continue;
        w.postMessage({ type: 'paldex-open', url: url }); // the app sets location.hash (src/lib/pushopen.ts)
        return w.focus();
      }
      return self.clients.openWindow(scope() + url);
    }));
  });
})();
