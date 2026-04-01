import { type ReactNode } from "react";
import { useLocation, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  /** 인증되지 않은 경우 리다이렉트할 경로 (기본값: /login) */
  redirectTo?: string;
}

/**
 * 로그인이 필요한 페이지를 감싸는 라우트 가드 컴포넌트.
 * - 인증 확인 중: 로딩 스피너 표시
 * - 비인증 상태: /login?redirect=현재경로 로 리다이렉트
 * - 인증 상태: children 렌더링
 */
export function ProtectedRoute({ children, redirectTo = "/login" }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, isError, error, refetch } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  if (isError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-6 text-center shadow-sm">
          <p className="text-base font-semibold">로그인 상태를 확인하지 못했습니다.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "네트워크 상태를 확인한 뒤 다시 시도해주세요."}
          </p>
          <div className="mt-4 flex justify-center">
            <Button type="button" onClick={() => void refetch()}>
              다시 시도
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // redirectTo에 이미 ?가 포함된 경우 &로 이어붙여 URL이 깨지지 않도록 처리
    const separator = redirectTo.includes("?") ? "&" : "?";
    const loginUrl = `${redirectTo}${separator}redirect=${encodeURIComponent(location)}`;
    return <Redirect to={loginUrl} />;
  }
}
