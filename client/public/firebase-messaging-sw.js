importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js"
);

const CACHE_NAME = "firebase-config-v1";
const CACHE_KEY = "firebase-config";

let firebaseInitialized = false;

/**
 * Firebase 초기화 및 백그라운드 메시지 핸들러 등록.
 * 이미 초기화된 경우 중복 실행하지 않음.
 */
function initFirebase(config) {
  if (firebaseInitialized) return;

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }

    const messaging = firebase.messaging();

    // 앱이 백그라운드/종료 상태일 때 수신되는 메시지 처리
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

    firebaseInitialized = true;
    console.log("[FCM SW] Firebase 초기화 완료");
  } catch (err) {
    console.error("[FCM SW] Firebase 초기화 실패:", err);
  }
}

/**
 * SW activate 시 Cache Storage에 저장된 config로 자동 초기화.
 * 앱이 백그라운드/종료 상태에서 SW가 새로 깨어날 때도 동작함.
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        const response = await cache.match(CACHE_KEY);
        if (response) {
          const config = await response.json();
          initFirebase(config);
        }
      } catch (err) {
        console.warn("[FCM SW] 캐시된 config 로드 실패:", err);
      }
    })()
  );
});

/**
 * 앱(메인 스레드)에서 FIREBASE_CONFIG 메시지를 받아 초기화 + 캐시 저장.
 * 최초 실행 시 또는 config 갱신 시 호출됨.
 */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "FIREBASE_CONFIG") {
    const config = event.data.config;

    // Cache Storage에 config 저장 (다음 SW 재시작 시 자동 복원용)
    caches.open(CACHE_NAME).then((cache) => {
      cache.put(CACHE_KEY, new Response(JSON.stringify(config)));
    });

    initFirebase(config);
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
