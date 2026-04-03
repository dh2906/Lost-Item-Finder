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
      // injectManifest 전략:
      //   firebase-messaging-sw.js 하나로 Workbox precache + FCM을 통합합니다.
      //   (generateSW를 쓰면 두 SW가 같은 루트 스코프에 등록되어 충돌이 발생합니다.)
      strategies: "injectManifest",
      srcDir: "public",
      filename: "firebase-messaging-sw.js",
      // 사전 캐시 대상 파일 패턴 (런타임 캐싱은 SW 파일 내부에서 직접 정의)
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
      // 개발 환경에서 SW는 기본 비활성화.
      // VITE_PWA_DEV=true 일 때만 테스트용으로 활성화합니다.
      // (항상 켜두면 HMR 캐시 오염으로 오래된 번들이 남는 문제 발생)
      // importScripts 기반 클래식 SW이므로 type은 'classic'
      devOptions: {
        enabled: process.env.VITE_PWA_DEV === "true",
        type: "classic",
      },
      // 정적 에셋 포함 목록
      includeAssets: ["favicon.png", "icons/*.svg", "icons/*.png"],
      // Web App Manifest 설정
      manifest: {
        name: "Findy - 분실물 찾기",
        short_name: "Findy",
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
          // PNG 아이콘: npm run pwa:icons 실행 후 생성됩니다.
          // 파일이 없으면 설치/알림 아이콘이 404로 깨지므로 반드시 생성 후 커밋하세요.
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/favicon.png",
            sizes: "48x48",
            type: "image/png",
          },
        ],
      },
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer()
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner()
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
      "/firebase-config.js": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
