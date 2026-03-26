import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

// Service Worker 등록 (Workbox precache + FCM 통합 SW)
// injectManifest 전략에서는 vite-plugin-pwa가 자동 등록하지 않으므로 직접 호출합니다.
registerSW({
  immediate: true,
  onNeedRefresh() {
    // 새 버전 감지 시 조용히 업데이트 (사용자 동의 없이 자동 갱신)
    console.log("[PWA] 새 버전 감지 — Service Worker 업데이트 중...");
  },
  onOfflineReady() {
    console.log("[PWA] 오프라인 사용 준비 완료");
  },
  onRegisteredSW(swUrl, registration) {
    console.log("[PWA] Service Worker 등록 완료:", swUrl, registration);
  },
  onRegisterError(error) {
    console.error("[PWA] Service Worker 등록 실패:", error);
  },
});

createRoot(document.getElementById("root")!).render(<App />);
