import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Link } from "wouter";
import {
  BellRing,
  BookmarkCheck,
  CheckCircle2,
  Heart,
  MapPin,
  PackageSearch,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
  Download,
  Smartphone
} from "lucide-react";
import { Layout } from "@/components/layout";
import { ItemCard } from "@/components/item-card";
import { useAuth } from "@/hooks/use-auth";
import { useFavoriteItems } from "@/hooks/use-favorites";
import {
  useMarkMatchNotificationAsRead,
  useMatchNotifications,
} from "@/hooks/use-notifications";
import { useDeleteItem, useMyItems, useUpdateItem } from "@/hooks/use-items";
import { useToast } from "@/hooks/use-toast";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Item } from "@shared/schema";

type FilterType = "all" | "active" | "resolved";

function getStatusText(status: Item["status"]) {
  return status === "resolved" ? "해결 완료" : "진행 중";
}

function getReportTypeText(reportType: Item["reportType"]) {
  return reportType === "found" ? "습득" : "분실";
}

export default function MyPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: myItems = [], isLoading: isMyItemsLoading } = useMyItems();
  const { data: favorites = [], isLoading: isFavoritesLoading } = useFavoriteItems();
  const { data: notifications = [], isLoading: isNotificationsLoading } =
    useMatchNotifications();
  const markNotificationAsReadMutation = useMarkMatchNotificationAsRead();
  const updateItemMutation = useUpdateItem();
  const deleteItemMutation = useDeleteItem();
  
  // 🚀 PWA 설치 상태 가져오기
  const { isInstallable, isInstalled, install } = usePWAInstall();
  
  // 🚀 현재 기기가 iOS(아이폰/아이패드)인지 판별
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredMyItems = useMemo(
    () =>
      myItems.filter((item) => (filter === "all" ? true : item.status === filter)),
    [filter, myItems]
  );

  const activeCount = myItems.filter((item) => item.status === "active").length;
  const resolvedCount = myItems.filter((item) => item.status === "resolved").length;
  const foundCount = myItems.filter((item) => item.reportType === "found").length;
  const lostCount = myItems.filter((item) => item.reportType === "lost").length;
  const unreadNotificationCount = notifications.filter(
    (notification) => !notification.isRead
  ).length;

  const handleStatusToggle = async (item: Item) => {
    const nextStatus = item.status === "active" ? "resolved" : "active";
    const confirmed = window.confirm(
      nextStatus === "resolved"
        ? `'${item.title}' 글을 해결 완료로 처리할까요?`
        : `'${item.title}' 글을 다시 공개할까요?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await updateItemMutation.mutateAsync({
        itemId: item.id,
        data: { status: nextStatus },
      });

      toast({
        title:
          nextStatus === "resolved"
            ? "게시글을 해결 완료로 변경했어요."
            : "게시글을 다시 공개했어요.",
      });
    } catch (error) {
      toast({
        title: "상태 변경에 실패했어요.",
        description:
          error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (item: Item) => {
    const confirmed = window.confirm(
      `'${item.title}' 글을 삭제할까요? 이 작업은 되돌릴 수 없어요.`
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteItemMutation.mutateAsync(item.id);
      toast({ title: "게시글을 삭제했어요." });
    } catch (error) {
      toast({
        title: "삭제에 실패했어요.",
        description:
          error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.",
        variant: "destructive",
      });
    }
  };

  const handleMarkNotificationAsRead = async (notificationId: number) => {
    try {
      await markNotificationAsReadMutation.mutateAsync(notificationId);
    } catch (error) {
      toast({
        title: "알림 상태를 바꾸지 못했어요.",
        description:
          error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <section className="border-b border-border/70 bg-[linear-gradient(180deg,hsl(var(--primary-light))_0%,transparent_100%)] pb-10 pt-14">
        <div className="container mx-auto max-w-6xl px-5">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,360px)]">
            <div className="space-y-5">
              <Badge className="rounded-full border border-primary/15 bg-white/90 px-4 py-1.5 text-sm font-semibold text-primary shadow-sm hover:bg-white/90">
                마이페이지
              </Badge>
              <div className="space-y-3">
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  내가 올린 분실물과 습득물을
                  <br />
                  한곳에서 관리해요
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                  게시글 상태 변경, 즐겨찾기 확인, 자동 매칭 알림까지 한 번에
                  살펴볼 수 있어요.
                </p>
              </div>
            </div>

            {/* 우측 사이드바 패널 */}
            <div className="space-y-4">
              <Card className="border-border/70 bg-white/92 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <UserRound className="h-5 w-5 text-primary" />
                    계정 요약
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xl font-semibold text-foreground">
                      {user?.name || user?.username}
                    </p>
                    <p className="text-sm text-muted-foreground">{user?.username}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-border/70 bg-secondary/40 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        전체 글
                      </p>
                      <p className="mt-2 text-2xl font-bold text-foreground">
                        {myItems.length}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-secondary/40 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        해결 완료
                      </p>
                      <p className="mt-2 text-2xl font-bold text-foreground">
                        {resolvedCount}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-secondary/40 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        습득
                      </p>
                      <p className="mt-2 text-2xl font-bold text-foreground">
                        {foundCount}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-secondary/40 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        분실
                      </p>
                      <p className="mt-2 text-2xl font-bold text-foreground">
                        {lostCount}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 🚀 앱 설정 (PWA 설치) 카드 */}
              <Card className="border-border/70 bg-white/92 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Smartphone className="h-5 w-5 text-primary" />
                    앱 설정
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between rounded-[20px] border border-border/70 bg-secondary/40 p-4">
                    <div>
                      <p className="font-semibold text-sm text-foreground">Findy 앱 설치</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        바탕화면에 바로가기 추가
                      </p>
                    </div>
                    
                    {/* 🚀 설치 상태에 따른 버튼 분기 처리 (iOS 대응 완벽) */}
                    {isInstalled ? (
                      <Button variant="secondary" size="sm" disabled className="gap-1.5 rounded-full px-4">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        설치됨
                      </Button>
                    ) : isInstallable ? (
                      <Button onClick={install} size="sm" className="gap-1.5 rounded-full px-4">
                        <Download className="w-4 h-4" />
                        설치하기
                      </Button>
                    ) : isIOS ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-1.5 rounded-full px-4 border-primary/50 text-primary hover:bg-primary/5"
                        onClick={() => {
                          toast({
                            title: "🍎 아이폰(iOS) 앱 설치 방법",
                            description: "사파리 화면 하단의 [공유(↑)] 아이콘을 누른 후, [홈 화면에 추가]를 선택해 주세요!",
                            duration: 5000,
                          });
                        }}
                      >
                        <Download className="w-4 h-4" />
                        iOS 설치 방법
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled className="rounded-full px-4">
                        지원 안함
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section id="alerts" className="pb-6 pt-10">
        <div className="container mx-auto max-w-6xl px-5">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
                <BellRing className="h-6 w-6 text-primary" />
                자동 매칭 알림
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                새 습득물이 등록되면 내 분실물과 자동 비교해서 가능성이 높은
                후보를 알려드려요.
              </p>
            </div>
            <Badge
              variant="outline"
              className="w-fit border-rose-200 bg-rose-50 text-rose-700"
            >
              읽지 않음 {unreadNotificationCount}건
            </Badge>
          </div>

          {isNotificationsLoading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {[1, 2].map((index) => (
                <div
                  key={index}
                  className="h-[220px] animate-pulse rounded-[26px] bg-muted"
                />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <Card className="border-dashed border-border/80 bg-secondary/35">
              <CardContent className="flex flex-col items-center py-14 text-center">
                <div className="mb-5 rounded-full border border-border/70 bg-white p-4 shadow-sm">
                  <BellRing className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  아직 자동 매칭 알림이 없어요
                </h3>
                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  분실물을 등록해 두면 이후에 올라오는 습득물과 자동으로 비교해
                  알려드릴게요.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Button asChild className="rounded-full px-5">
                    <Link href="/report/lost">분실물 등록하기</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full px-5">
                    <Link href="/search">AI 검색해보기</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {notifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={cn(
                    "border-border/70 bg-white/92 shadow-sm",
                    !notification.isRead &&
                      "border-primary/30 shadow-[0_18px_30px_-24px_hsl(var(--primary)/0.32)]"
                  )}
                >
                  <CardContent className="space-y-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <Badge className="bg-primary text-primary-foreground hover:bg-primary">
                            자동 매칭
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              notification.isRead
                                ? "border-slate-200 text-slate-600"
                                : "border-rose-200 bg-rose-50 text-rose-700"
                            }
                          >
                            {notification.isRead ? "확인 완료" : "새 알림"}
                          </Badge>
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">
                          {notification.foundItem.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          내 분실물 "
                          <span className="font-medium text-foreground">
                            {notification.lostItem.title}
                          </span>
                          " 과 유사한 습득물이 등록됐어요.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-emerald-700">
                          매칭 점수
                        </p>
                        <p className="mt-1 text-2xl font-bold text-emerald-700">
                          {Math.round(notification.score * 100)}%
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-border/70 bg-secondary/35 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          내 분실물
                        </p>
                        <p className="mt-2 font-medium text-foreground">
                          {notification.lostItem.title}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {getReportTypeText(notification.lostItem.reportType)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-secondary/35 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          새 습득물
                        </p>
                        <p className="mt-2 font-medium text-foreground">
                          {notification.foundItem.title}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {notification.foundItem.location || "위치 정보 없음"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-primary/10 bg-[hsl(var(--primary-light))/0.7] p-4 text-sm leading-6 text-slate-700">
                      {notification.reasoning}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                      <span>
                        {format(new Date(notification.updatedAt), "PPP p", {
                          locale: ko,
                        })}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" className="rounded-full">
                          <Link href={`/item/${notification.foundItem.id}`}>
                            습득물 보기
                          </Link>
                        </Button>
                        {!notification.isRead ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="rounded-full"
                            disabled={markNotificationAsReadMutation.isPending}
                            onClick={() =>
                              void handleMarkNotificationAsRead(notification.id)
                            }
                          >
                            읽음 처리
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="pb-10 pt-4">
        <div className="container mx-auto max-w-6xl px-5">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
                <PackageSearch className="h-6 w-6 text-primary" />
                내 게시글 관리
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                해결된 글은 숨기고, 필요할 때 다시 공개할 수 있어요.
              </p>
            </div>

            <Tabs
              value={filter}
              onValueChange={(value) => setFilter(value as FilterType)}
            >
              <TabsList className="h-11 rounded-full border border-border/70 bg-white/90 p-1 shadow-sm">
                <TabsTrigger
                  value="all"
                  className="rounded-full px-4 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  전체
                </TabsTrigger>
                <TabsTrigger
                  value="active"
                  className="rounded-full px-4 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  진행 중
                </TabsTrigger>
                <TabsTrigger
                  value="resolved"
                  className="rounded-full px-4 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  해결 완료
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {isMyItemsLoading ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {[1, 2].map((index) => (
                <div
                  key={index}
                  className="h-[260px] animate-pulse rounded-[26px] bg-muted"
                />
              ))}
            </div>
          ) : myItems.length === 0 ? (
            <Card className="border-dashed border-border/80 bg-secondary/35">
              <CardContent className="flex flex-col items-center py-16 text-center">
                <div className="mb-5 rounded-full border border-border/70 bg-white p-4 shadow-sm">
                  <PackageSearch className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  아직 등록한 게시글이 없어요
                </h3>
                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  분실물이나 습득물을 등록하면 여기에서 수정, 삭제, 해결 처리까지
                  한 번에 관리할 수 있어요.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Button asChild className="rounded-full px-5">
                    <Link href="/report/found">습득물 등록하기</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full px-5">
                    <Link href="/report/lost">분실물 등록하기</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : filteredMyItems.length === 0 ? (
            <Card className="border-border/70 bg-white/92">
              <CardContent className="py-14 text-center">
                <h3 className="text-lg font-semibold text-foreground">
                  선택한 상태의 게시글이 아직 없어요
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  다른 필터를 선택하면 숨겨진 글을 다시 볼 수 있어요.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {filteredMyItems.map((item) => (
                <Card
                  key={item.id}
                  className="overflow-hidden border-border/70 bg-white/92 shadow-sm"
                >
                  <CardContent className="p-0">
                    <div className="grid gap-0 sm:grid-cols-[180px_minmax(0,1fr)]">
                      <Link href={`/item/${item.id}`} className="block h-full">
                        <div className="relative h-full min-h-[180px] overflow-hidden bg-muted">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                              이미지 없음
                            </div>
                          )}
                        </div>
                      </Link>

                      <div className="space-y-4 p-5">
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            className={
                              item.reportType === "found"
                                ? "bg-emerald-500 text-white hover:bg-emerald-500"
                                : "bg-rose-500 text-white hover:bg-rose-500"
                            }
                          >
                            {getReportTypeText(item.reportType)}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              item.status === "resolved"
                                ? "border-slate-300 text-slate-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            }
                          >
                            {getStatusText(item.status)}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <Link href={`/item/${item.id}`}>
                            <h3 className="text-xl font-semibold text-foreground transition-colors hover:text-primary">
                              {item.title}
                            </h3>
                          </Link>
                          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                            {item.location ? (
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin className="h-4 w-4" />
                                {item.location}
                              </span>
                            ) : null}
                            {item.date ? (
                              <span className="inline-flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4" />
                                {format(new Date(item.date), "PPP", { locale: ko })}
                              </span>
                            ) : null}
                          </div>
                          <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                            {item.description || "설명이 아직 등록되지 않았어요."}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button asChild variant="outline" className="rounded-full">
                            <Link href={`/item/${item.id}`}>
                              <Search className="mr-2 h-4 w-4" />
                              상세보기
                            </Link>
                          </Button>
                          <Button asChild variant="outline" className="rounded-full">
                            <Link href={`/item/${item.id}/edit`}>
                              <Pencil className="mr-2 h-4 w-4" />
                              수정
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-full"
                            disabled={
                              updateItemMutation.isPending ||
                              deleteItemMutation.isPending
                            }
                            onClick={() => void handleStatusToggle(item)}
                          >
                            {item.status === "active" ? (
                              <>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                해결됐어요
                              </>
                            ) : (
                              <>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                다시 공개
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-full text-destructive hover:text-destructive"
                            disabled={
                              updateItemMutation.isPending ||
                              deleteItemMutation.isPending
                            }
                            onClick={() => void handleDelete(item)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            삭제
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <Card className="border-border/70 bg-white/92">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">진행 중인 글</p>
                <p className="mt-2 text-2xl font-bold text-foreground">
                  {activeCount}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-white/92">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">해결 완료 글</p>
                <p className="mt-2 text-2xl font-bold text-foreground">
                  {resolvedCount}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-white/92">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">관심 게시글</p>
                <p className="mt-2 text-2xl font-bold text-foreground">
                  {favorites.length}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="pb-16">
        <div className="container mx-auto max-w-6xl px-5">
          <div className="mb-6 space-y-2">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <BookmarkCheck className="h-6 w-6 text-primary" />
              관심 게시글
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              나중에 다시 보고 싶은 글은 여기에서 모아볼 수 있어요.
            </p>
          </div>

          {isFavoritesLoading ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="h-[330px] animate-pulse rounded-[26px] bg-muted"
                />
              ))}
            </div>
          ) : favorites.length === 0 ? (
            <Card className="border-dashed border-border/80 bg-secondary/35">
              <CardContent className="flex flex-col items-center py-14 text-center">
                <div className="mb-5 rounded-full border border-border/70 bg-white p-4 shadow-sm">
                  <Heart className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  저장해 둔 관심 게시글이 아직 없어요
                </h3>
                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  상세 페이지에서 관심 게시글로 추가하면 마이페이지에서 다시 쉽게
                  확인할 수 있어요.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Button asChild className="rounded-full px-5">
                    <Link href="/items">
                      <PackageSearch className="mr-2 h-4 w-4" />
                      전체 게시글 보기
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full px-5">
                    <Link href="/search">
                      <Search className="mr-2 h-4 w-4" />
                      AI로 찾기
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {favorites.map((favorite) => (
                <div key={favorite.item.id} className="space-y-3">
                  <div className="flex items-center justify-between px-1 text-xs font-medium text-muted-foreground">
                    <span>저장한 시각</span>
                    <span>
                      {format(new Date(favorite.createdAt), "PPP p", {
                        locale: ko,
                      })}
                    </span>
                  </div>
                  <ItemCard item={favorite.item} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}