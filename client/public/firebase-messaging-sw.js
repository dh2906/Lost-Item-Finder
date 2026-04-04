// =============================================================================
// 통합 Service Worker: PWA(Workbox) + Firebase Cloud Messaging
//
// vite-plugin-pwa의 injectManifest 전략을 사용합니다.
// 빌드 시 아래 self.__WB_MANIFEST가 실제 precache 목록으로 교체됩니다.
// =============================================================================

// --- [1] Workbox CDN (precache + runtime caching) ---
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

if (typeof workbox !== 'undefined') {
  workbox.setConfig({ debug: false });

  const { precacheAndRoute, createHandlerBoundToURL } = workbox.precaching;
  const { NavigationRoute, registerRoute } = workbox.routing;
  const { NetworkFirst, StaleWhileRevalidate, CacheFirst } = workbox.strategies;
  const { ExpirationPlugin } = workbox.expiration;
  const { CacheableResponsePlugin } = workbox.cacheableResponse;

  // vite-plugin-pwa(injectManifest)가 빌드 시 아래 값을 실제 precache 목록으로 교체합니다.
  precacheAndRoute(self.__WB_MANIFEST || []);

  // 🚀 [수정됨] 개발 모드 라우팅 에러 방지를 위한 try-catch
  try {
    const handler = createHandlerBoundToURL('/index.html');
    registerRoute(
      new NavigationRoute(handler, {
        denylist: [/^\/api\//, /^\/firebase-config\.js$/, /^\/firebase-messaging-sw\.js$/],
      })
    );
  } catch (error) {
    console.warn('[SW] 개발 모드: /index.html이 캐시 목록에 없어 라우팅을 건너뜁니다.');
  }

  // Public API만 NetworkFirst로 캐싱합니다.
  const PUBLIC_API_PATHS = [
    '/api/items',
    '/api/categories',
  ];

  registerRoute(
    ({ url, request }) => {
      const isApiPath = url.pathname.startsWith('/api/');
      const isGetMethod = request.method === 'GET';
      const isPublicApi = PUBLIC_API_PATHS.some((p) => url.pathname.startsWith(p));
      return isApiPath && isGetMethod && isPublicApi;
    },
    new NetworkFirst({
      cacheName: 'api-cache',
      networkTimeoutSeconds: 10,
      plugins: [
        new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 5 * 60 }),
        new CacheableResponsePlugin({ statuses: [0, 200] }),
      ],
    })
  );

  // Google Fonts CSS: StaleWhileRevalidate
  registerRoute(
    ({ url }) => url.origin === 'https://fonts.googleapis.com',
    new StaleWhileRevalidate({ cacheName: 'google-fonts-stylesheets' })
  );

  // Google Fonts 웹폰트: CacheFirst (1년)
  registerRoute(
    ({ url }) => url.origin === 'https://fonts.gstatic.com',
    new CacheFirst({
      cacheName: 'google-fonts-webfonts',
      plugins: [
        new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 }),
        new CacheableResponsePlugin({ statuses: [0, 200] }),
      ],
    })
  );
} else {
  console.warn('[SW] Workbox 로드 실패 — 캐싱 기능이 비활성화됩니다.');
}

// --- [2] Firebase Cloud Messaging ---
// 🚨 기존에 있던 importScripts('/firebase-config.js'); 완전 삭제!

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// 🚀 [수정됨] 하드코딩된 Firebase 설정 (알려주신 키값 적용)
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDQC6UGOzC5n-de2xQpKOraZve9c7mJerg",
  authDomain: "lost-item-finder-f59cd.firebaseapp.com",
  projectId: "lost-item-finder-f59cd",
  storageBucket: "lost-item-finder-f59cd.firebasestorage.app",
  messagingSenderId: "203102757353",
  appId: "1:203102757353:web:27d0b8badcdea7676beb78"
};

try {
  // 빈 값이 아닌 진짜 값으로 초기화 실행!
  firebase.initializeApp(FIREBASE_CONFIG);
  const messaging = firebase.messaging();

  // 앱이 백그라운드/종료 상태일 때 수신되는 FCM 메시지 처리
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? '새 알림';
    const body = payload.notification?.body ?? '';

    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: payload.data,
    });
  });

  console.log('[FCM SW] Firebase 하드코딩 초기화 완료');
} catch (error) {
  console.error('[FCM SW] Firebase 초기화 실패:', error);
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