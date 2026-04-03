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

type NavigationItem = {
  href: string;
  label: string;
  children?: Array<{
    href: string;
    label: string;
  }>;
};

const navigation: NavigationItem[] = [
  { href: "/", label: "홈" },
  {
    href: "/report",
    label: "물건 신고",
    children: [
      { href: "/report/found", label: "습득물 신고" },
      { href: "/report/lost", label: "분실물 신고" },
    ],
  },
  { href: "/search", label: "분실물 찾기" },
  { href: "/items?type=found", label: "물건 목록" },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { data: chatRooms = [] } = useChatRooms(isAuthenticated);
  const { data: notifications = [] } = useMatchNotifications();
  const [reportMenuOpen, setReportMenuOpen] = useState(false);

  const hasUnreadChats = chatRooms.some((room) => room.hasUnread);
  const unreadNotificationCount = notifications.filter(
    (notification) => !notification.isRead
  ).length;

  const handleReportMenuNavigate = (href: string) => {
    setReportMenuOpen(false);
    void setLocation(href);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/94 backdrop-blur supports-[backdrop-filter]:bg-background/78">
        <div className="container flex h-[68px] items-center justify-between gap-4 xl:max-w-[1440px]">
          <div className="flex items-center gap-3 md:gap-5">
            <Link
              href="/"
              className="flex items-center gap-3 text-sm font-semibold tracking-tight text-foreground transition-colors hover:text-foreground/80"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground shadow-[0_12px_24px_-16px_hsl(var(--primary)/0.45)]">
                <MapPinCheckInside className="h-5 w-5" />
              </span>
              <span className="flex flex-col leading-none">
                <span className="text-base">Findy</span>
                <span className="mt-1 text-[11px] font-medium text-muted-foreground">
                  분실물 연결 게시판
                </span>
              </span>
            </Link>

            <nav className="hidden items-center rounded-full border border-border/55 bg-white/80 p-0.5 shadow-[0_10px_22px_-20px_rgba(27,31,59,0.14)] lg:flex">
              {navigation.map((item) => {
                const itemPath = item.href.split("?")[0];
                const active =
                  itemPath === "/"
                    ? location === itemPath
                    : location === itemPath ||
                      location.startsWith(`${itemPath}?`) ||
                      location.startsWith(`${itemPath}/`);

                if (item.children?.length) {
                  return (
                    <div
                      key={item.href}
                      className="relative"
                      onMouseEnter={() => setReportMenuOpen(true)}
                      onMouseLeave={() => setReportMenuOpen(false)}
                    >
                      <button
                        type="button"
                        className={cn(
                          "relative inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200",
                          active || reportMenuOpen
                            ? "bg-primary text-primary-foreground font-semibold shadow-[0_8px_16px_-14px_hsl(var(--primary)/0.34)]"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {item.label}
                        <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                      </button>

                      {reportMenuOpen ? (
                        <>
                          <div
                            className="absolute inset-x-0 top-full h-4"
                            aria-hidden="true"
                          />
                          <div className="absolute left-1/2 top-full z-50 mt-3 w-44 -translate-x-1/2 rounded-2xl border border-border/70 bg-popover p-1.5 text-popover-foreground shadow-md">
                            {item.children.map((child) => {
                              const childActive = location === child.href;

                              return (
                                <button
                                  key={child.href}
                                  type="button"
                                  onClick={() =>
                                    handleReportMenuNavigate(child.href)
                                  }
                                  className={cn(
                                    "block w-full rounded-xl px-3 py-2 text-left text-sm transition-colors",
                                    childActive
                                      ? "bg-accent text-accent-foreground"
                                      : "text-foreground hover:bg-accent hover:text-accent-foreground"
                                  )}
                                >
                                  {child.label}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <Link key={item.href} href={item.href}>
                    <span
                      className={cn(
                        "relative inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200",
                        active
                          ? "bg-primary text-primary-foreground font-semibold shadow-[0_8px_16px_-14px_hsl(var(--primary)/0.34)]"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
                      "relative inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all duration-200",
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
                  className="relative h-10 w-10 rounded-xl border border-border/70 bg-white/90 shadow-sm transition-shadow hover:shadow-md"
                >
                  <Link href="/chats" aria-label="채팅 목록">
                    <MessageCircleMore className="h-4.5 w-4.5 text-foreground" />
                    {hasUnreadChats ? (
                      <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-primary shadow-sm" />
                    ) : null}
                  </Link>
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  className="relative h-10 w-10 rounded-xl border border-border/70 bg-white/90 shadow-sm transition-shadow hover:shadow-md"
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
                      className="relative h-10 w-10 rounded-full border border-border/70 bg-white/90 p-0 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-sm font-semibold text-primary">
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
                    <DropdownMenuItem onClick={() => void setLocation("/matches")}>
                      내 매칭
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void setLocation("/chats")}>
                      채팅 목록
                    </DropdownMenuItem>
                    {user?.role === "admin" ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => void setLocation("/admin")}>
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
                  className="h-9 rounded-full px-4 text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                >
                  <Link href="/login">로그인</Link>
                </Button>
                <Button
                  size="sm"
                  asChild
                  className="h-9 rounded-full px-4 shadow-[0_12px_22px_-16px_hsl(var(--primary)/0.42)]"
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
                  className="h-10 w-10 rounded-xl"
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

      <footer className="border-t border-border/35 bg-white/70">
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
