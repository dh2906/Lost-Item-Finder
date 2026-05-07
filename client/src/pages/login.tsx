import { Link, Redirect } from "wouter";
import { AlertCircle, MapPinCheckInside } from "lucide-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { OAuthLoginButtons } from "@/components/oauth-login-buttons";
import { useAuth } from "@/hooks/use-auth";
import { sanitizeRedirect } from "@/lib/redirect";

export function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const redirectTo = sanitizeRedirect(params.get("redirect"));
  const error = params.get("error");

  if (!isLoading && isAuthenticated) {
    return <Redirect to={redirectTo} />;
  }

  return (
    <Layout>
      <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 py-14">
        <Card className="w-full max-w-md overflow-hidden rounded-[30px] bg-white/92">
          <CardHeader className="space-y-4 border-b bg-[linear-gradient(180deg,hsl(var(--primary-light))_0%,white_100%)] px-8 pb-8 pt-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-[0_18px_30px_-20px_hsl(var(--primary)/0.45)]">
              <MapPinCheckInside className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">로그인</h1>
              <CardDescription className="text-base">
                Google, Kakao, Naver 계정으로 Findy를 이용하세요.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-8">
            {error ? (
              <div className="flex gap-2 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {error === "suspended"
                    ? "정지된 계정입니다. 관리자에게 문의해주세요."
                    : "OAuth 로그인에 실패했습니다. 잠시 후 다시 시도해주세요."}
                </span>
              </div>
            ) : null}

            <OAuthLoginButtons redirectTo={redirectTo} />

            <p className="text-center text-sm leading-6 text-muted-foreground">
              별도 회원가입 없이 소셜 계정 인증이 완료되면 계정이 자동으로 생성됩니다.
            </p>
            <p className="text-center text-xs text-muted-foreground">
              처음이신가요?{" "}
              <Link
                href={redirectTo === "/" ? "/register" : `/register?redirect=${encodeURIComponent(redirectTo)}`}
                className="font-semibold text-primary hover:underline"
              >
                회원가입 안내 보기
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
