importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js"
);

// 서비스 워커에서는 Vite 환경변수를 직접 읽을 수 없으므로
// 앱에서 postMessage로 config를 전달받아 초기화합니다
let messaging = null;

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "FIREBASE_CONFIG") {
    const firebaseConfig = event.data.config;
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    messaging = firebase.messaging();

    // 앱이 백그라운드 상태일 때 수신되는 메시지 처리
    messaging.onBackgroundMessage((payload) => {
      const title = payload.notification?.title ?? "새 알림";
      const body = payload.notification?.body ?? "";

      self.registration.showNotification(title, {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: payload.data,
      });
    });
  }
});

// 알림 클릭 시 해당 채팅방으로 이동
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const roomId = event.notification.data?.roomId;
  const url = roomId ? `/chat/${roomId}` : "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
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
