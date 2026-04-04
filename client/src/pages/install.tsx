import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Button } from "@/components/ui/button";
import { Smartphone, Download, CheckCircle, Share } from "lucide-react";

/**
 * PWA 설치 전용 페이지 (/install)
 * - Android Chrome: 설치 버튼으로 바로 설치
 * - iOS Safari: 수동 안내 (공유 → 홈 화면에 추가)
 * - 이미 설치된 경우: 설치 완료 메시지
 */
export default function InstallPage() {
  const { isInstallable, isInstalled, install } = usePWAInstall();

  const isIOS =
    typeof window !== "undefined" &&
    /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  const handleInstall = async () => {
    await install();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center px-6 py-12">
      {/* 앱 아이콘 */}
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-blue-600 shadow-xl">
        <Smartphone className="h-12 w-12 text-white" />
      </div>

      {/* 타이틀 */}
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Findy 앱 설치</h1>
      <p className="mb-8 text-center text-sm text-gray-500">
        분실물 찾기 서비스 Findy를 홈 화면에 추가하세요.
      </p>

      {/* 이미 설치된 경우 */}
      {isInstalled && (
        <div className="flex flex-col items-center gap-3">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <p className="text-base font-semibold text-green-600">이미 설치되어 있어요!</p>
          <p className="text-sm text-gray-400">홈 화면에서 Findy를 실행하세요.</p>
        </div>
      )}

      {/* Android: 설치 버튼 */}
      {!isInstalled && isInstallable && (
        <Button
          size="lg"
          onClick={handleInstall}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-base font-semibold rounded-2xl shadow-lg"
        >
          <Download className="h-5 w-5" />
          앱 설치하기
        </Button>
      )}

      {/* iOS: 수동 안내 */}
      {!isInstalled && isIOS && !isInstallable && (
        <div className="w-full max-w-sm rounded-2xl border border-blue-100 bg-white p-6 shadow-md">
          <p className="mb-4 text-sm font-semibold text-gray-700">iOS에서 설치하는 방법</p>
          <ol className="space-y-3 text-sm text-gray-600">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs text-white font-bold">1</span>
              <span>하단의 <Share className="inline h-4 w-4 text-blue-500" /> <strong>공유</strong> 버튼을 누르세요.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs text-white font-bold">2</span>
              <span><strong>"홈 화면에 추가"</strong>를 선택하세요.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs text-white font-bold">3</span>
              <span>우측 상단 <strong>"추가"</strong>를 누르면 완료!</span>
            </li>
          </ol>
        </div>
      )}

      {/* 설치 불가 (이미 설치되지도 않고, iOS도 아니고, 프롬프트도 없는 경우) */}
      {!isInstalled && !isIOS && !isInstallable && (
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-4">
            브라우저가 자동 설치를 지원하지 않거나,<br />이미 설치된 상태일 수 있어요.
          </p>
          <p className="text-xs text-gray-400">
            Chrome 브라우저에서 접속하면 설치 버튼이 나타납니다.
          </p>
        </div>
      )}

      {/* 하단 안내 */}
      <p className="mt-10 text-xs text-gray-400 text-center">
        설치 후에도 브라우저에서 동일하게 이용할 수 있어요.
      </p>
    </div>
  );
}
