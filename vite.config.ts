import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    VitePWA({
      registerType: "autoUpdate",
      // 개발 환경에서도 SW 활성화 (테스트용)
      devOptions: {
        enabled: true,
        type: "module",
      },
      // 정적 에셋 포함 목록
      includeAssets: ["favicon.png", "icons/*.svg"],
      // Web App Manifest 설정
      manifest: {
        name: "ReturnIt - 분실물 찾기",
        short_name: "ReturnIt",
        description: "AI가 분실물을 찾아주는 스마트 매칭 서비스",
        theme_color: "#2563eb",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/",
        start_url: "/",
        id: "/",
        lang: "ko",
        dir: "ltr",
        categories: ["utilities", "productivity"],
        icons: [
          {
            src: "/icons/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icons/icon-maskable.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
          {
            src: "/favicon.png",
            sizes: "48x48",
            type: "image/png",
          },
        ],
      },
      // Workbox 캐싱 전략
      workbox: {
        // 사전 캐시 대상 파일 패턴
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // SPA 라우팅 폴백 (API 경로 제외)
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/firebase-config\.js$/,
          /^\/firebase-messaging-sw\.js$/,
        ],
        // 런타임 캐싱 전략
        runtimeCaching: [
          {
            // API 응답: NetworkFirst (항상 최신 데이터 우선, 오프라인 시 캐시)
            urlPattern: /^\/api\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 64,
                maxAgeSeconds: 60 * 5, // 5분
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts CSS: StaleWhileRevalidate
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-stylesheets" },
          },
          {
            // Google Fonts 웹폰트: CacheFirst (1년)
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": { target: "http://localhost:8080", changeOrigin: true },
      "/firebase-config.js": { target: "http://localhost:8080", changeOrigin: true },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
