// Firebase config는 /firebase-config.js 에서 동기적으로 로드됩니다.
// importScripts는 동기 실행이므로 SW가 push로 깨어날 때도
// Firebase가 즉시 초기화되어 onBackgroundMessage 핸들러가 항상 등록됩니다.
importScripts('/firebase-config.js');

importScripts(
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js'
);
importScripts(
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js'
);

if (typeof self.FIREBASE_CONFIG !== 'undefined') {
  firebase.initializeApp(self.FIREBASE_CONFIG);
  const messaging = firebase.messaging();

  // 앱이 백그라운드/종료 상태일 때 수신되는 메시지 처리
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? '새 알림';
    const body = payload.notification?.body ?? '';

    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: payload.data,
    });
  });

  console.log('[FCM SW] Firebase 초기화 완료');
} else {
  console.error('[FCM SW] FIREBASE_CONFIG가 없습니다. /firebase-config.js 응답을 확인하세요.');
}

// 알림 클릭 시 해당 채팅방으로 이동
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const roomId = event.notification.data?.roomId;
  const url = roomId ? `/chat/${roomId}` : '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        const existing = windowClients.find((c) =>
          c.url.includes(self.location.origin)
        );
        if (existing) {
          existing.focus();
          existing.navigate(url);
        } else {
          clients.openWindow(url);
        }
      })
  );
});
