import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const DISMISSED_KEY = "pwa-install-dismissed";

/**
 * PWA 앱 설치를 유도하는 하단 배너 컴포넌트
 *
 * - Android Chrome / Edge 등 beforeinstallprompt 지원 브라우저에서만 표시
 * - 이미 설치됐거나 사용자가 닫으면 숨김 (sessionStorage로 세션 내 재노출 방지)
 * - 모바일: 화면 하단 고정 (하단 네비게이션 위)
 * - 데스크톱: 우측 하단 플로팅
 */
export function PWAInstallBanner() {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  // sessionStorage로 초기화: 탭을 닫기 전까지 dismissed 상태 유지
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISSED_KEY) === "true"
  );

  const handleInstall = async () => {
    const accepted = await install();
    if (!accepted) dismiss();
  };

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };

  // 실제로 설치가 완료된 경우에만 DISMISSED_KEY 초기화
  // (isInstallable이 false가 되는 시점은 거절/오류 후에도 발생하므로 그때는 초기화하지 않음)
  useEffect(() => {
    if (isInstalled) {
      sessionStorage.removeItem(DISMISSED_KEY);
    }
  }, [isInstalled]);

  return (
    <AnimatePresence>
      {isInstallable && !dismissed && (
        <motion.div
          initial={{ opacity: 0, y: 48 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 48 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className={
            "fixed z-50 flex items-center gap-3 rounded-2xl bg-blue-600 px-4 py-3 text-white shadow-2xl " +
            "bottom-20 left-4 right-4 " +       // 모바일: 하단 네비게이션 위
            "md:bottom-6 md:left-auto md:right-6 md:w-80" // 데스크톱: 우측 하단
          }
          role="region"
          aria-label="앱 설치 안내"
        >
          {/* 아이콘 */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <Smartphone className="h-5 w-5" aria-hidden />
          </div>

          {/* 텍스트 */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">앱으로 설치하기</p>
            <p className="mt-0.5 text-xs leading-tight text-blue-100">
              홈 화면에 추가해 더 빠르게 사용하세요
            </p>
          </div>

          {/* 설치 버튼 */}
          <Button
            size="sm"
            onClick={handleInstall}
            className="shrink-0 bg-white text-blue-600 hover:bg-blue-50 h-8 px-3 text-xs font-semibold"
            aria-label="앱 설치"
          >
            <Download className="mr-1 h-3 w-3" aria-hidden />
            설치
          </Button>

          {/* 닫기 버튼 */}
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded-full p-1 transition-colors hover:bg-blue-500"
            aria-label="배너 닫기"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
