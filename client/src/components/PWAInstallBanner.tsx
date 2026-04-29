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
            "fixed z-50 flex items-center gap-2 rounded-full border border-blue-200 bg-white/95 px-3 py-2 text-slate-800 shadow-xl backdrop-blur " +
            "bottom-4 left-4 right-4 " +
            "md:bottom-6 md:left-auto md:right-6 md:w-auto md:max-w-80"
          }
          role="region"
          aria-label="앱 설치 안내"
        >
          {/* 아이콘 */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Smartphone className="h-4 w-4" aria-hidden />
          </div>

          {/* 텍스트 */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold leading-tight text-slate-900">앱 설치</p>
            <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">
              홈 화면에 추가해 더 빠르게 사용하세요
            </p>
          </div>

          {/* 설치 버튼 */}
          <Button
            size="sm"
            onClick={handleInstall}
            className="h-8 shrink-0 rounded-full bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
            aria-label="앱 설치"
          >
            <Download className="mr-1 h-3 w-3" aria-hidden />
            설치
          </Button>

          {/* 닫기 버튼 */}
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label="배너 닫기"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
