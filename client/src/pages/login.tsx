import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { Layout } from "@/components/layout";
import { MapPinCheckInside, Loader2 } from "lucide-react";

export function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const res = await fetch(api.auth.login.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "로그인에 실패했습니다");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      toast({ title: "로그인 성공", description: "환영합니다." });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "로그인 실패", description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ username, password });
  };

  return (
    <Layout>
      <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 py-14">
        <Card className="w-full max-w-md overflow-hidden rounded-[30px] bg-white/92">
          <CardHeader className="space-y-4 border-b bg-[linear-gradient(180deg,hsl(var(--primary-light))_0%,white_100%)] px-8 pb-8 pt-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-[0_18px_30px_-20px_hsl(var(--primary)/0.45)]">
              <MapPinCheckInside className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold">로그인</CardTitle>
              <CardDescription className="text-base">
                계정에 로그인하여 서비스를 이용하세요.
              </CardDescription>
            </div>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5 p-8">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-semibold">
                  아이디
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="아이디를 입력하세요"
                  required
                  autoComplete="username"
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold">
                  비밀번호
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  required
                  autoComplete="current-password"
                  className="h-12"
                />
              </div>

              <Button
                type="submit"
                className="h-12 w-full rounded-full text-base font-semibold shadow-[0_12px_22px_-16px_hsl(var(--primary)/0.4)]"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    로그인 중...
                  </>
                ) : (
                  "로그인"
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
                계정이 없으신가요?{" "}
                <Link
                  href="/register"
                  className="font-semibold text-primary transition-colors hover:text-primary/80 hover:underline underline-offset-4"
                >
                  회원가입
                </Link>
              </p>
            </CardContent>
          </form>
        </Card>
      </div>
    </Layout>
  );
}
