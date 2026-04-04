// Combined Service Worker for Workbox caching and Firebase Cloud Messaging.

importScripts("https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js");

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

if (typeof workbox !== "undefined") {
  workbox.setConfig({ debug: false });

  const { precacheAndRoute, createHandlerBoundToURL } = workbox.precaching;
  const { NavigationRoute, registerRoute } = workbox.routing;
  const { NetworkFirst, StaleWhileRevalidate, CacheFirst } = workbox.strategies;
  const { ExpirationPlugin } = workbox.expiration;
  const { CacheableResponsePlugin } = workbox.cacheableResponse;

  precacheAndRoute(self.__WB_MANIFEST || []);

  try {
    const handler = createHandlerBoundToURL("/index.html");
    registerRoute(
      new NavigationRoute(handler, {
        denylist: [/^\/api\//, /^\/firebase-config\.js$/, /^\/firebase-messaging-sw\.js$/],
      })
    );
  } catch (error) {
    console.warn("[SW] Skipped app-shell routing because /index.html is not precached.", error);
  }

  const publicApiPaths = ["/api/items", "/api/categories"];

  registerRoute(
    ({ url, request }) => {
      const isApiPath = url.pathname.startsWith("/api/");
      const isGetMethod = request.method === "GET";
      const isPublicApi = publicApiPaths.some((path) => url.pathname.startsWith(path));
      return isApiPath && isGetMethod && isPublicApi;
    },
    new NetworkFirst({
      cacheName: "api-cache",
      networkTimeoutSeconds: 10,
      plugins: [
        new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 5 * 60 }),
        new CacheableResponsePlugin({ statuses: [0, 200] }),
      ],
    })
  );

  registerRoute(
    ({ url }) => url.origin === "https://fonts.googleapis.com",
    new StaleWhileRevalidate({ cacheName: "google-fonts-stylesheets" })
  );

  registerRoute(
    ({ url }) => url.origin === "https://fonts.gstatic.com",
    new CacheFirst({
      cacheName: "google-fonts-webfonts",
      plugins: [
        new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 }),
        new CacheableResponsePlugin({ statuses: [0, 200] }),
      ],
    })
  );
} else {
  console.warn("[SW] Workbox failed to load, cache features are disabled.");
}

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDQC6UGOzC5n-de2xQpKOraZve9c7mJerg",
  authDomain: "lost-item-finder-f59cd.firebaseapp.com",
  projectId: "lost-item-finder-f59cd",
  storageBucket: "lost-item-finder-f59cd.firebasestorage.app",
  messagingSenderId: "203102757353",
  appId: "1:203102757353:web:27d0b8badcdea7676beb78",
};

try {
  firebase.initializeApp(FIREBASE_CONFIG);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? "새 알림";
    const body = payload.notification?.body ?? "";
    const roomId = payload.data?.roomId;

    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { ...payload.data, roomId },
    });
  });

  console.log("[FCM SW] Firebase initialization complete");
} catch (error) {
  console.error("[FCM SW] Firebase initialization failed:", error);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const roomId = event.notification.data?.roomId;
  const url = roomId ? `/chat/${roomId}` : "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      const existing = windowClients.find((client) => client.url.includes(self.location.origin));

      if (existing) {
        existing.focus();
        existing.navigate(url);
        return;
      }

      return clients.openWindow(url);
    })
  );
});
