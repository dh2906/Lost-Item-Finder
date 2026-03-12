import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { Layout } from "@/components/layout";

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
      <div className="section-container">
        <div className="container max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-3">
              로그인
            </h1>
            <p className="text-muted-foreground">
              계정에 로그인하여 서비스를 이용하세요.
            </p>
          </div>

          <Card>
            <form onSubmit={handleSubmit}>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Label htmlFor="username">아이디</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="아이디 입력"
                    required
                    autoComplete="username"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="password">비밀번호</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호 입력"
                    required
                    autoComplete="current-password"
                    className="mt-1.5"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? "로그인 중..." : "로그인"}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  계정이 없으신가요?{" "}
                  <Link href="/register" className="font-medium text-primary hover:underline">
                    회원가입
                  </Link>
                </p>
              </CardContent>
            </form>
          </Card>
        </div>
      </div>
    </Layout>
  );
}