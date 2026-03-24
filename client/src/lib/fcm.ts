import { getMessaging, getToken, onMessage, type MessagePayload } from "firebase/messaging";
import { getFirebaseApp, firebaseConfig } from "./firebase";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

function getFirebaseMessaging() {
  try {
    const app = getFirebaseApp();
    return getMessaging(app);
  } catch {
    return null;
  }
}

/** 서비스 워커에 Firebase config 전달하고 초기화 완료를 기다림 */
async function sendConfigToServiceWorker(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.ready;

  // 이미 초기화된 경우 postMessage를 다시 보내도 중복 초기화 방지 처리가 SW 안에 있으므로 안전
  registration.active?.postMessage({
    type: "FIREBASE_CONFIG",
    config: firebaseConfig,
  });

  // SW가 메시지를 처리할 시간을 확보 (비동기 처리 타이밍 보정)
  await new Promise<void>((resolve) => setTimeout(resolve, 300));

  return registration;
}

/** FCM 토큰 요청 및 서버 등록 */
export async function initFcm(): Promise<void> {
  if (!("Notification" in window)) {
    console.warn("[FCM] 이 브라우저는 알림을 지원하지 않습니다.");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.warn("[FCM] 알림 권한이 거부되었습니다.");
    return;
  }

  // 서비스 워커 등록 및 초기화 대기
  if (!("serviceWorker" in navigator)) {
    console.error("[FCM] 서비스 워커를 지원하지 않는 브라우저입니다.");
    return;
  }

  await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const registration = await sendConfigToServiceWorker();

  const messaging = getFirebaseMessaging();
  if (!messaging) {
    console.error("[FCM] Firebase Messaging 초기화 실패");
    return;
  }

  try {
    // serviceWorkerRegistration을 명시적으로 전달해야 올바른 SW와 토큰이 연결됨
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.warn("[FCM] 토큰을 가져오지 못했습니다.");
      return;
    }

    // 서버에 토큰 등록
    await fetch("/api/fcm/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token }),
    });

    console.log("[FCM] 토큰 등록 완료:", token.slice(0, 20) + "...");
  } catch (err) {
    console.error("[FCM] 토큰 발급 실패:", err);
  }
}

/** 앱 포그라운드 상태일 때 메시지 수신 리스너 등록 */
export function onForegroundMessage(
  callback: (payload: { title: string; body: string; data?: Record<string, string> }) => void
): () => void {
  const messaging = getFirebaseMessaging();
  if (!messaging) return () => {};

  return onMessage(messaging, (payload: MessagePayload) => {
    const title = payload.notification?.title ?? "새 알림";
    const body = payload.notification?.body ?? "";
    const data = payload.data as Record<string, string> | undefined;
    callback({ title, body, data });
  });
}
