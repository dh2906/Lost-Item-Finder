import { Link, Redirect, useLocation } from "wouter";
import { ShieldCheck, UserPlus } from "lucide-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { OAuthLoginButtons } from "@/components/oauth-login-buttons";
import { useAuth } from "@/hooks/use-auth";
import { sanitizeRedirect } from "@/lib/redirect";

export function RegisterPage() {
  const [location] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const redirectTo = sanitizeRedirect(params.get("redirect"));

  if (!isLoading && isAuthenticated) {
    return <Redirect to={redirectTo} />;
  }

  return (
    <Layout>
      <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 py-14">
        <Card className="w-full max-w-md overflow-hidden rounded-[30px] bg-white/92">
          <CardHeader className="space-y-4 border-b bg-[linear-gradient(180deg,hsl(var(--primary-light))_0%,white_100%)] px-8 pb-8 pt-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-primary to-primary/80 text-white shadow-[0_18px_30px_-20px_hsl(var(--primary)/0.45)]">
              <UserPlus className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">회원가입</h1>
              <CardDescription className="text-base">
                소셜 인증으로 안전하게 계정을 만들 수 있습니다.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-8">
            <OAuthLoginButtons redirectTo={redirectTo} />

            <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-sm leading-6 text-muted-foreground">
                  비밀번호를 저장하지 않고 Google, Kakao, Naver 인증 정보로만 로그인합니다.
                  인증이 완료되면 Findy 계정이 자동으로 생성됩니다.
                </p>
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              이미 이용 중이신가요?{" "}
              <Link
                href={redirectTo === "/" ? "/login" : `/login?redirect=${encodeURIComponent(redirectTo)}`}
                className="font-semibold text-primary hover:underline"
              >
                로그인
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
