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

  // SPA 라우팅 폴백: index.html (API·Firebase 경로 제외)
  registerRoute(
    new NavigationRoute(createHandlerBoundToURL('/index.html'), {
      denylist: [/^\/api\//, /^\/firebase-config\.js$/, /^\/firebase-messaging-sw\.js$/],
    })
  );

  // Public API만 NetworkFirst로 캐싱합니다.
  // 인증 필요 API(예: /api/chat/rooms, /api/user)는 캐시 대상에서 제외합니다.
  // 이유: 로그인 기반 응답이 브라우저 캐시에 남으면 로그아웃 후 다른 사용자에게
  //       노출될 수 있는 보안 문제가 발생합니다.
  const PUBLIC_API_PATHS = [
    '/api/items',
    '/api/categories',
  ];

  registerRoute(
    ({ url, request }) => {
      const isApiPath = url.pathname.startsWith('/api/');
      const isGetMethod = request.method === 'GET';
      // public GET API만 캐시 허용 (인증 쿠키가 필요한 경로는 제외)
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
// firebase-config.js는 서버가 동적으로 제공하는 파일입니다.
// NOTE: SW는 importScripts로 compat CDN 빌드를 직접 불러와야 합니다.
//   CDN 버전(10.12.2)은 앱 의존성(package.json firebase: ^12.x)과 다를 수 있습니다.
//   업그레이드 시 https://www.gstatic.com/firebasejs/{version}/firebase-app-compat.js 확인
importScripts('/firebase-config.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

if (typeof self.FIREBASE_CONFIG !== 'undefined') {
  firebase.initializeApp(self.FIREBASE_CONFIG);
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
