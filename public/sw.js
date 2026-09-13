self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cls => {
      const focused = cls.find(c => c.focused);
      if (focused) return focused.focus();
      if (cls[0]) return cls[0].focus();
      return self.clients.openWindow('/');
    })
  );
});
