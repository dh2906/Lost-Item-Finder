import { type ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Bell,
  ChevronDown,
  Heart,
  LogOut,
  MapPinCheckInside,
  MessageCircleMore,
  Shield,
  User as UserIcon,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useChatRooms } from "@/hooks/use-chat";
import { useMatchNotifications } from "@/hooks/use-notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type NavigationItem = {
  href: string;
  label: string;
  children?: Array<{
    href: string;
    label: string;
    description?: string;
  }>;
};

const navigation: NavigationItem[] = [
  { href: "/", label: "홈" },
  { href: "/mypage", label: "내 물건" },
  { href: "/matches", label: "매칭 후보" },
  {
    href: "/items?type=found",
    label: "습득물 찾기",
    children: [
      {
        href: "/items?type=found",
        label: "전체 습득물",
        description: "경찰청과 사용자 등록 습득물",
      },
      {
        href: "/search",
        label: "AI로 찾기",
        description: "사진이나 설명으로 유사 후보 검색",
      },
    ],
  },
  {
    href: "/report",
    label: "등록",
    children: [
      { href: "/report/lost", label: "잃어버린 물건 등록" },
      { href: "/report/found", label: "주운 물건 등록" },
    ],
  },
  { href: "/claim-report", label: "신고하기" },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { data: chatRooms = [] } = useChatRooms(isAuthenticated);
  const { data: notifications = [] } = useMatchNotifications();
  const [openNavMenu, setOpenNavMenu] = useState<string | null>(null);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const hasUnreadChats = chatRooms.some((room) => room.hasUnread);
  const unreadNotificationCount = notifications.filter(
    (notification) => !notification.isRead
  ).length;

  const handleMenuNavigate = (href: string) => {
    setOpenNavMenu(null);
    setMobileMenuOpen(false);
    void setLocation(href);
  };

  const getNavigationTarget = (href: string) => {
    const reportStepMatch = location
      .split("?")[0]
      .match(/^\/report\/(?:found|lost)\/(photo|info|location|confirm)$/);

    if (reportStepMatch && /^\/report\/(?:found|lost)$/.test(href)) {
      return `${href}/${reportStepMatch[1]}`;
    }

    return href;
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-white/96 text-foreground backdrop-blur supports-[backdrop-filter]:bg-white/90">
        <div className="container flex h-16 items-center justify-between gap-4 xl:max-w-[1440px]">
          <div className="flex items-center gap-3 md:gap-5">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden shrink-0 -ml-2 text-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">메뉴 열기</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[min(88vw,360px)] overflow-y-auto px-5 pb-8 pt-7 sm:px-6"
              >
                <SheetTitle className="pr-10 text-left text-lg font-bold">
                  메뉴
                </SheetTitle>
                <SheetDescription className="sr-only">
                  주요 화면과 신고 화면으로 이동하는 모바일 메뉴입니다.
                </SheetDescription>
                <nav className="mt-6 flex flex-col gap-4">
                  {navigation.map((item) => (
                    <div key={item.href} className="flex min-w-0 flex-col gap-2">
                      {item.children ? (
                        <>
                          <h4 className="px-3 text-sm font-semibold text-foreground">
                            {item.label}
                          </h4>
                          <div className="flex flex-col gap-1 border-l border-border/80 pl-3">
                            {item.children.map((child) => (
                              <button
                                key={child.href}
                                onClick={() => handleMenuNavigate(child.href)}
                                className="min-h-11 rounded-xl px-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                              >
                                <span className="block font-semibold text-foreground">
                                  {child.label}
                                </span>
                                {child.description ? (
                                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                                    {child.description}
                                  </span>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <button
                          onClick={() => handleMenuNavigate(item.href)}
                          className="min-h-11 rounded-xl px-3 text-left text-base font-semibold text-foreground transition-colors hover:bg-secondary hover:text-primary"
                        >
                          {item.label}
                        </button>
                      )}
                    </div>
                  ))}
                  {user?.role === "admin" && (
                    <div className="flex flex-col gap-2 border-t border-border pt-4">
                      <button
                        onClick={() => handleMenuNavigate("/admin")}
                        className="min-h-11 rounded-xl px-3 text-left text-base font-semibold text-amber-700 transition-colors hover:bg-amber-50 hover:text-amber-800"
                      >
                        관리자 대시보드
                      </button>
                    </div>
                  )}
                </nav>
              </SheetContent>
            </Sheet>

            <Link
              href="/"
              className="flex items-center gap-3 text-sm font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <MapPinCheckInside className="h-5 w-5" />
              </span>
              <span className="flex flex-col leading-none">
                <span className="text-base">Findy</span>
                <span className="mt-1 text-[11px] font-medium text-muted-foreground">
                  분실물 매칭 서비스
                </span>
              </span>
            </Link>

            <nav className="hidden items-center gap-1 lg:flex">
              {navigation.map((item) => {
                const itemPath = item.href.split("?")[0];
                const childActive = item.children?.some((child) => {
                  const childPath = child.href.split("?")[0];
                  return childPath === "/"
                    ? location === childPath
                    : location === childPath ||
                        location.startsWith(`${childPath}?`) ||
                        location.startsWith(`${childPath}/`);
                });
                const active =
                  childActive ||
                  (itemPath === "/"
                    ? location === itemPath
                    : location === itemPath ||
                      location.startsWith(`${itemPath}?`) ||
                      location.startsWith(`${itemPath}/`));

                if (item.children?.length) {
                  return (
                    <details key={item.href} className="group relative">
                      <summary
                        className={cn(
                          "relative inline-flex cursor-pointer list-none items-center rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-200 [&::-webkit-details-marker]:hidden",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        )}
                      >
                        {item.label}
                        <ChevronDown className="ml-1.5 h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="absolute left-1/2 top-full z-50 mt-3 hidden w-64 -translate-x-1/2 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-[0_4px_12px_rgba(0,0,0,0.10)] group-open:block">
                        {item.children.map((child) => {
                          const childPath = child.href.split("?")[0];
                          const isChildActive =
                            location === childPath ||
                            location.startsWith(`${childPath}?`) ||
                            location.startsWith(`${childPath}/`);

                          return (
                            <button
                              key={child.href}
                              type="button"
                              onClick={() => handleMenuNavigate(getNavigationTarget(child.href))}
                              className={cn(
                                "block w-full cursor-pointer rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                                isChildActive
                                  ? "bg-accent text-accent-foreground"
                                  : "text-foreground"
                              )}
                            >
                              <span className="flex min-w-0 flex-col">
                                <span className="font-semibold">{child.label}</span>
                                {child.description ? (
                                  <span className="mt-0.5 text-xs leading-5 text-muted-foreground">
                                    {child.description}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </details>
                  );
                }

                return (
                  <Link key={item.href} href={item.href}>
                    <span
                      className={cn(
                        "relative inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-200",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}

              {user?.role === "admin" ? (
                <Link href="/admin">
                  <span
                    className={cn(
                      "relative inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-200",
                      location === "/admin"
                        ? "bg-amber-500 text-white shadow-[0_8px_16px_-14px_rgba(245,158,11,0.45)]"
                        : "text-amber-700 hover:bg-amber-50"
                    )}
                  >
                    관리자
                  </span>
                </Link>
              ) : null}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  className="relative h-10 w-10 rounded-lg border border-border bg-white text-foreground shadow-none hover:bg-secondary hover:text-primary"
                >
                  <Link href="/chats" aria-label="채팅 목록">
                    <MessageCircleMore className="h-4.5 w-4.5" />
                    {hasUnreadChats ? (
                      <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-primary shadow-sm" />
                    ) : null}
                  </Link>
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  className="relative h-10 w-10 rounded-lg border border-border bg-white text-foreground shadow-none hover:bg-secondary hover:text-primary"
                >
                  <Link href="/mypage#alerts" aria-label="매칭 알림">
                    <Bell className="h-5 w-5" />
                    {unreadNotificationCount > 0 ? (
                      <span className="absolute -right-1 -top-1 inline-flex min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                        {unreadNotificationCount > 9
                          ? "9+"
                          : unreadNotificationCount}
                      </span>
                    ) : null}
                  </Link>
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-10 w-10 rounded-full border border-border bg-white p-0 shadow-none hover:bg-secondary"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
                          {user?.name?.[0] ||
                            user?.username?.[0]?.toUpperCase() || (
                              <UserIcon className="h-4 w-4" />
                            )}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-semibold leading-none">
                          {user?.name || user?.username}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user?.username}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => void setLocation("/mypage")}
                    >
                      <Heart className="mr-2 h-4 w-4" />
                      마이페이지
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => void setLocation("/matches")}
                    >
                      매칭 후보
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => void setLocation("/chats")}
                    >
                      채팅 목록
                    </DropdownMenuItem>
                    {user?.role === "admin" ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => void setLocation("/admin")}
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          관리자 대시보드
                        </DropdownMenuItem>
                      </>
                    ) : null}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={logout}
                      className="text-destructive focus:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      로그아웃
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="hidden items-center gap-2 md:flex">
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-9 rounded-lg px-4 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Link href="/login">로그인</Link>
                </Button>
                <Button
                  size="sm"
                  asChild
                  className="h-9 rounded-lg px-4"
                >
                  <Link href="/register">회원가입</Link>
                </Button>
              </div>
            )}

            <div className="flex items-center gap-1 md:hidden">
              {!isAuthenticated && (
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  aria-label="로그인"
                  className="h-10 w-10 rounded-lg text-foreground hover:bg-secondary hover:text-primary"
                >
                  <Link href="/login">
                    <UserIcon className="h-5 w-5" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">{children}</main>

      <footer className="border-t border-border bg-white">
        <div className="container flex flex-col gap-1 py-1.5 text-sm text-muted-foreground/72 md:flex-row md:items-center md:justify-between xl:max-w-[1440px]">
          <div className="flex items-center gap-2 font-medium text-foreground/72">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground/92">
              <MapPinCheckInside className="h-4 w-4" />
            </span>
            <span>Findy</span>
          </div>
          <p className="text-center text-muted-foreground/42 md:text-right">
            © {new Date().getFullYear()} Findy
          </p>
        </div>
      </footer>
    </div>
  );
}
