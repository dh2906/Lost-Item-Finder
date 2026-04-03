import { type ReactNode } from "react";
import { Redirect, useLocation } from "wouter";
import { ShieldAlert, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
  requireAdmin?: boolean;
}

export function ProtectedRoute({
  children,
  redirectTo = "/login",
  requireAdmin = false,
}: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading, isError, error, refetch } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-6 text-center shadow-sm">
          <p className="text-base font-semibold">로그인 상태를 확인하지 못했습니다.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error
              ? error.message
              : "네트워크 상태를 확인한 뒤 다시 시도해주세요."}
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
    const separator = redirectTo.includes("?") ? "&" : "?";
    const loginUrl = `${redirectTo}${separator}redirect=${encodeURIComponent(location)}`;
    return <Redirect to={loginUrl} />;
  }

  if (requireAdmin && user?.role !== "admin") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-border/70 bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-foreground">
            관리자만 접근할 수 있는 페이지입니다
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            현재 계정에는 운영 대시보드 권한이 없습니다. 필요한 경우 관리자 계정으로 다시 로그인해주세요.
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild>
              <a href="/">홈으로 이동</a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
