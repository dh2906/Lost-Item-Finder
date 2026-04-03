import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * PWA 설치 프롬프트를 관리하는 훅
 *
 * - `isInstallable`: 설치 가능 상태 (beforeinstallprompt 이벤트 수신 시 true)
 * - `isInstalled`  : 이미 홈 화면에 설치된 상태 (standalone 모드 감지, iOS 포함)
 * - `install`      : 설치 프롬프트를 띄우는 비동기 함수 (수락 시 true 반환)
 *
 * 지원 브라우저: Chrome, Edge, Samsung Internet (Android)
 * iOS Safari는 beforeinstallprompt를 지원하지 않아 별도 안내 필요
 */
export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    // iOS Safari는 navigator.standalone === true 로 홈 화면 추가 여부를 감지
    // Android/Chrome은 (display-mode: standalone) media query로 감지
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault(); // 브라우저 기본 설치 프롬프트 억제
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  /**
   * 설치 프롬프트를 표시합니다.
   * @returns 사용자가 수락하면 true, 거절/오류 시 false
   */
  const install = async (): Promise<boolean> => {
    if (!installPrompt) return false;

    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      return outcome === "accepted";
    } catch {
      // prompt() 또는 userChoice 처리 중 예외 발생 시 설치 실패로 간주
      return false;
    } finally {
      // outcome과 무관하게 상태를 초기화 (beforeinstallprompt는 1회성이므로)
      setInstallPrompt(null);
      setIsInstallable(false);
    }
  };

  return { isInstallable, isInstalled, install };
}
