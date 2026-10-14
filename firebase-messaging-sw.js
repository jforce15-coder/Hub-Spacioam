/* Service worker de notificaciones · debe vivir en la raíz del sitio (hub.spacioam.com/firebase-messaging-sw.js).
   Copia aquí la MISMA config de Firebase que pusiste en js/push.js. */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
firebase.initializeApp({ apiKey: '', authDomain: '', projectId: '', messagingSenderId: '', appId: '' });
const messaging = firebase.messaging();
messaging.onBackgroundMessage(function (p) {
  const d = p.data || {}, n = p.notification || {};
  self.registration.showNotification(n.title || d.title || 'ALMA · Spacio AM', {
    body: n.body || d.body || '', icon: 'assets/icons/icon-192.png', badge: 'assets/icons/favicon-64.png',
    tag: d.tag || undefined, data: { url: d.url || '/' }
  });
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (ws) {
    for (const w of ws) { if ('focus' in w) { w.navigate(url); return w.focus(); } }
    return clients.openWindow(url);
  }));
});
