import { type ReactNode } from "react";
import { useLocation, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
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
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // redirectTo에 이미 ?가 포함된 경우 &로 이어붙여 URL이 깨지지 않도록 처리
    const separator = redirectTo.includes("?") ? "&" : "?";
    const loginUrl = `${redirectTo}${separator}redirect=${encodeURIComponent(location)}`;
    return <Redirect to={loginUrl} />;
  }

  return <>{children}</>;
}
