import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { Layout } from "@/components/layout";
import { UserPlus, Loader2 } from "lucide-react";

export function RegisterPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");

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
    onSuccess: () => {
      toast({ title: "회원가입 성공", description: "바로 서비스를 이용할 수 있습니다." });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "회원가입 실패", description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ variant: "destructive", title: "비밀번호 불일치", description: "비밀번호가 일치하지 않습니다." });
      return;
    }
    registerMutation.mutate({ username, password, name: name || undefined });
  };

  return (
    <Layout>
      <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 py-14">
        <Card className="w-full max-w-md overflow-hidden rounded-[30px] bg-white/92">
          <CardHeader className="space-y-4 border-b bg-[linear-gradient(180deg,hsl(var(--primary-light))_0%,white_100%)] px-8 pb-8 pt-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-primary to-primary/80 text-white shadow-[0_18px_30px_-20px_hsl(var(--primary)/0.45)]">
              <UserPlus className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold">회원가입</CardTitle>
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
                />
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold">
                    비밀번호 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="4자 이상"
                    required
                    minLength={4}
                    autoComplete="new-password"
                     className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-semibold">
                    비밀번호 확인 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="비밀번호 다시 입력"
                    required
                    autoComplete="new-password"
                     className="h-12"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold">
                  이름
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름을 입력하세요 (선택)"
                   className="h-12"
                />
              </div>

              <Button
                type="submit"
                className="h-12 w-full rounded-full text-base font-semibold shadow-[0_12px_22px_-16px_hsl(var(--primary)/0.4)]"
                disabled={registerMutation.isPending}
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
                  href="/login"
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
