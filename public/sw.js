self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  if (!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch { data = { title: 'REDE NEX', body: e.data.text() }; }
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // App focused → in-app popup handles it; no duplicate OS notification
      if (clients.some(c => c.focused)) return;
      return self.registration.showNotification(data.title || 'REDE NEX', {
        body: data.body || '',
        icon: '/assets/images/logo_nex.png',
        badge: '/assets/images/logo_nex.png',
        tag: data.tag || 'rede-nex',
        data: { link: data.link || '/' },
        renotify: true,
      });
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const link = e.notification.data?.link || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'navigate', link });
          return;
        }
      }
      return self.clients.openWindow(self.location.origin + link);
    })
  );
});
