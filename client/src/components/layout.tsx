import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Search, PlusCircle, Package, LogOut, User as UserIcon, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navigation = [
  { href: "/", label: "홈" },
  { href: "/report", label: "습득물 신고" },
  { href: "/search", label: "분실물 찾기" },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Package className="h-6 w-6 text-primary" />
              <span className="text-lg">ReturnIt</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item) => {
                const active = location === item.href;
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={active ? "default" : "ghost"}
                      size="sm"
                      className={cn(active && "font-medium")}
                    >
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                        {user?.name?.[0] || user?.username?.[0]?.toUpperCase() || <UserIcon className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.name || user?.username}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.username}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    로그아웃
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">로그인</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/register">
                    회원가입
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}

            <div className="flex md:hidden items-center gap-1">
              {!isAuthenticated && (
                <Button variant="ghost" size="icon" asChild aria-label="로그인">
                  <Link href="/login">
                    <UserIcon className="h-5 w-5" />
                  </Link>
                </Button>
              )}
              <Button variant="ghost" size="icon" asChild aria-label="신고">
                <Link href="/report">
                  <PlusCircle className="h-5 w-5" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" asChild aria-label="검색">
                <Link href="/search">
                  <Search className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t bg-muted/30">
        <div className="container py-8 md:py-12">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold">
                <Package className="h-5 w-5 text-primary" />
                <span>ReturnIt</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-md">
                분실물과 습득물을 빠르게 연결하는 지역 기반 게시판입니다. 
                AI 이미지 분석과 위치 기반 검색으로 잃어버린 물건을 찾아보세요.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">서비스</p>
                <p className="text-sm text-muted-foreground">
                  AI 이미지 분석, 지역 위치 선택, 빠른 검색
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">특징</p>
                <p className="text-sm text-muted-foreground">
                  신뢰, 명확성, 빠른 발견
                </p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}