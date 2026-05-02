import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { Layout } from "@/components/layout";
import { UserPlus, Loader2, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AUTH_QUERY_KEY } from "@/lib/query-keys";
import { sanitizeRedirect } from "@/lib/redirect";

function PasswordStrengthIndicator({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    { label: "4자 이상", ok: password.length >= 4 },
    { label: "8자 이상", ok: password.length >= 8 },
    { label: "숫자 포함", ok: /\d/.test(password) },
    { label: "특수문자 포함", ok: /[!@#$%^&*]/.test(password) },
  ];
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {checks.map(({ label, ok }) => (
        <span
          key={label}
          className={`flex items-center gap-1 text-xs ${ok ? "text-green-600" : "text-muted-foreground"}`}
        >
          {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {label}
        </span>
      ))}
    </div>
  );
}

export function RegisterPage() {
  const [location] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const redirectTo = sanitizeRedirect(params.get("redirect"));
  const loginHref =
    redirectTo === "/" ? "/login" : `/login?redirect=${encodeURIComponent(redirectTo)}`;

  const passwordsMatch = confirmPassword === "" || password === confirmPassword;
  const confirmPasswordErrorId = "confirm-password-error";

  const registerMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; name?: string }) => {
      const res = await fetch(api.auth.register.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const responseData = await res.json();
        throw new Error(responseData.message || "회원가입에 실패했습니다");
      }
      return res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, user);
      toast({ title: "회원가입 성공", description: "바로 서비스를 이용할 수 있습니다." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "회원가입 실패", description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedUsername = username.trim();
    if (!trimmedUsername || trimmedUsername.length < 3) {
      toast({
        variant: "destructive",
        title: "사용자명 오류",
        description: "사용자명은 공백이 아닌 3자 이상이어야 합니다.",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "비밀번호 불일치",
        description: "비밀번호가 일치하지 않습니다.",
      });
      return;
    }
    if (password.length < 4) {
      toast({
        variant: "destructive",
        title: "비밀번호 오류",
        description: "비밀번호는 4자 이상이어야 합니다.",
      });
      return;
    }

    registerMutation.mutate({
      username: trimmedUsername,
      password,
      name: name.trim() || undefined,
    });
  };

  const toggleButtonClass =
    "absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

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
                새 계정을 만들어 서비스를 시작하세요.
              </CardDescription>
            </div>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5 p-8">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-semibold">
                  아이디 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="3자 이상 입력"
                  required
                  minLength={3}
                  autoComplete="username"
                  className="h-12"
                  disabled={registerMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold">
                  이름 <span className="font-normal text-muted-foreground">(선택)</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="실명 또는 닉네임"
                  className="h-12"
                  disabled={registerMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold">
                  비밀번호 <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="4자 이상"
                    required
                    minLength={4}
                    autoComplete="new-password"
                    className="h-12 pr-12"
                    disabled={registerMutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className={toggleButtonClass}
                    aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <EyeOff className="h-[18px] w-[18px]" />
                    ) : (
                      <Eye className="h-[18px] w-[18px]" />
                    )}
                  </button>
                </div>
                <PasswordStrengthIndicator password={password} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-semibold">
                  비밀번호 확인 <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="비밀번호 다시 입력"
                    required
                    autoComplete="new-password"
                    className={`h-12 pr-12 ${!passwordsMatch && confirmPassword ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    disabled={registerMutation.isPending}
                    aria-invalid={!passwordsMatch && !!confirmPassword}
                    aria-describedby={
                      !passwordsMatch && confirmPassword ? confirmPasswordErrorId : undefined
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className={toggleButtonClass}
                    aria-label={showConfirm ? "비밀번호 숨기기" : "비밀번호 보기"}
                    aria-pressed={showConfirm}
                  >
                    {showConfirm ? (
                      <EyeOff className="h-[18px] w-[18px]" />
                    ) : (
                      <Eye className="h-[18px] w-[18px]" />
                    )}
                  </button>
                </div>
                {!passwordsMatch && confirmPassword ? (
                  <p id={confirmPasswordErrorId} className="text-xs text-destructive">
                    비밀번호가 일치하지 않습니다.
                  </p>
                ) : null}
              </div>

              <Button
                type="submit"
                className="h-12 w-full rounded-full text-base font-semibold shadow-[0_12px_22px_-16px_hsl(var(--primary)/0.4)]"
                disabled={registerMutation.isPending || (!passwordsMatch && !!confirmPassword)}
              >
                {registerMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    가입 중...
                  </>
                ) : (
                  "회원가입"
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">또는</span>
                </div>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                이미 계정이 있으신가요?{" "}
                <Link
                  href={loginHref}
                  className="font-semibold text-primary transition-colors hover:text-primary/80 hover:underline underline-offset-4"
                >
                  로그인
                </Link>
              </p>
            </CardContent>
          </form>
        </Card>
      </div>
    </Layout>
  );
}
