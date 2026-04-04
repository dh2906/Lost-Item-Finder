import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from "virtual:pwa-register";
import { toast } from "@/hooks/use-toast";

let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;

updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    toast({
      title: "✨ 업데이트 알림",
      description: "새로운 버전이 출시되었습니다. 클릭하여 업데이트하세요.",
      action: (
        <button
          onClick={() => updateSW?.(true)}
          className="bg-primary text-white px-3 py-1 rounded text-xs font-semibold"
        >
          새로고침
        </button>
      ),
      duration: 10000,
    });
    console.log("[PWA] 새 버전 감지 — 사용자에게 업데이트를 안내합니다.");
  },
  onOfflineReady() {
    console.log("[PWA] 오프라인 사용 준비 완료");
  },
  onRegisteredSW(swUrl: string, registration: ServiceWorkerRegistration | undefined) {
    console.log("[PWA] Service Worker 등록 완료:", swUrl);
  },
  onRegisterError(error: unknown) {
    console.error("[PWA] Service Worker 등록 실패:", error);
  },
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
