import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Link } from "wouter";
import {
  BellRing,
  BookmarkCheck,
  CheckCircle2,
  MapPin,
  PackageSearch,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
  Download,
  Smartphone,
  X,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import {
  useMarkMatchNotificationAsRead,
  useMatchNotifications,
} from "@/hooks/use-notifications";
import { useDeleteItem, useMyItems, useUpdateItem } from "@/hooks/use-items";
import { useMatches } from "@/hooks/use-matches";
import { useToast } from "@/hooks/use-toast";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getPrimaryItemImageUrl } from "@shared/item-images";
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
  const { data: notifications = [], isLoading: isNotificationsLoading } =
    useMatchNotifications();
  const { data: matches = [], isLoading: isMatchesLoading } = useMatches();
  const markNotificationAsReadMutation = useMarkMatchNotificationAsRead();
  const updateItemMutation = useUpdateItem();
  const deleteItemMutation = useDeleteItem();

  const { isInstalled } = usePWAInstall();

  const [filter, setFilter] = useState<FilterType>("all");
  const [showInstallPanel, setShowInstallPanel] = useState(true);

  const filteredMyItems = useMemo(
    () =>
      myItems.filter((item) =>
        filter === "all" ? true : item.status === filter
      ),
    [filter, myItems]
  );

  const activeCount = myItems.filter((item) => item.status === "active").length;
  const resolvedCount = myItems.filter(
    (item) => item.status === "resolved"
  ).length;
  const foundCount = myItems.filter(
    (item) => item.reportType === "found"
  ).length;
  const lostCount = myItems.filter((item) => item.reportType === "lost").length;
  const unreadNotificationCount = notifications.filter(
    (notification) => !notification.isRead
  ).length;
  const savedMatches = useMemo(
    () =>
      matches
        .filter((match) => match.status === "confirmed")
        .sort((left, right) => {
          if (right.score !== left.score) {
            return right.score - left.score;
          }
          return (
            new Date(right.updatedAt).getTime() -
            new Date(left.updatedAt).getTime()
          );
        }),
    [matches]
  );

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
          error instanceof Error
            ? error.message
            : "잠시 후 다시 시도해 주세요.",
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
          error instanceof Error
            ? error.message
            : "잠시 후 다시 시도해 주세요.",
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
          error instanceof Error
            ? error.message
            : "잠시 후 다시 시도해 주세요.",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <section className="border-b border-border/70 bg-[linear-gradient(180deg,hsl(var(--primary-light))_0%,transparent_100%)] pb-8 pt-8">
        <div className="container mx-auto max-w-6xl px-5">
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,360px)]">
            <div className="space-y-4">
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
                  내 물건 상태 변경과 자동 매칭 알림 확인을 한 번에 살펴볼 수
                  있어요.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Card className="border-border/70 bg-white/92 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <UserRound className="h-5 w-5 text-primary" />
                    계정 정보
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xl font-semibold text-foreground">
                      {user?.name || user?.username}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {user?.username}
                    </p>
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
            </div>
          </div>
        </div>
      </section>

      <section className="pb-6 pt-10">
        <div className="container mx-auto max-w-6xl px-5">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
                <BookmarkCheck className="h-6 w-6 text-primary" />
                저장한 후보
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                매칭 후보에서 맞아 보인다고 저장한 습득물을 점수 높은 순으로 모아봅니다.
              </p>
            </div>
            <Button asChild variant="outline" className="rounded-lg">
              <Link href="/matches">후보 전체 보기</Link>
            </Button>
          </div>

          {isMatchesLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="h-[180px] animate-pulse rounded-xl bg-muted"
                />
              ))}
            </div>
          ) : savedMatches.length === 0 ? (
            <Card className="border-dashed border-border/80 bg-secondary/35">
              <CardContent className="flex flex-col items-center py-12 text-center">
                <BookmarkCheck className="mb-4 h-9 w-9 text-muted-foreground/55" />
                <h3 className="text-lg font-semibold text-foreground">
                  저장한 후보가 아직 없어요
                </h3>
                <p className="mt-2 max-w-md break-keep text-sm leading-6 text-muted-foreground [word-break:keep-all]">
                  매칭 후보에서 맞아 보이는 항목을 저장하면 여기에서 다시 확인할 수 있어요.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {savedMatches.slice(0, 6).map((match) => (
                <Card
                  key={match.id}
                  className="border-border/70 bg-white/92 shadow-sm"
                >
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <Badge className="bg-primary text-primary-foreground hover:bg-primary">
                        {Math.round(match.score * 100)}%
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        내 분실물 기준
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {match.lostItem.title}
                      </p>
                      <Link href={`/item/${match.foundItem.id}`}>
                        <h3 className="line-clamp-2 text-base font-semibold leading-6 text-foreground transition-colors hover:text-primary">
                          {match.foundItem.title}
                        </h3>
                      </Link>
                      <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {match.matchReason}
                      </p>
                    </div>
                    <Button asChild variant="outline" className="w-full rounded-lg">
                      <Link href={`/item/${match.foundItem.id}`}>후보 상세 보기</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
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
                    <Link href="/report/lost">잃어버린 물건 등록하기</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-full px-5"
                  >
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
                        <h3 className="text-lg font-semibold text-foreground flex-1 min-w-0 truncate">
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
                        <Button
                          asChild
                          variant="outline"
                          className="rounded-full"
                        >
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
                <PackageSearch className="h-6 w-6 text-primary" />내 물건 관리
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
                  아직 등록한 물건이 없어요
                </h3>
                <p className="mt-3 max-w-md break-keep text-sm leading-6 text-muted-foreground [word-break:keep-all]">
                  등록한 물건은 여기에서 수정, 삭제, 해결 처리까지 한 번에
                  관리할 수 있어요.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Button asChild className="rounded-full px-5">
                    <Link href="/report/found">주운 물건 등록하기</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-full px-5"
                  >
                    <Link href="/report/lost">잃어버린 물건 등록하기</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : filteredMyItems.length === 0 ? (
            <Card className="border-border/70 bg-white/92">
              <CardContent className="py-14 text-center">
                <h3 className="text-lg font-semibold text-foreground">
                  선택한 상태의 물건이 아직 없어요
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
                          {getPrimaryItemImageUrl(item) ? (
                            <img
                              src={getPrimaryItemImageUrl(item)}
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
                                {format(new Date(item.date), "PPP", {
                                  locale: ko,
                                })}
                              </span>
                            ) : null}
                          </div>
                          <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                            {item.description ||
                              "설명이 아직 등록되지 않았어요."}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            asChild
                            variant="outline"
                            className="rounded-full"
                          >
                            <Link href={`/item/${item.id}`}>
                              <Search className="mr-2 h-4 w-4" />
                              상세보기
                            </Link>
                          </Button>
                          <Button
                            asChild
                            variant="outline"
                            className="rounded-full"
                          >
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
                <p className="text-sm text-muted-foreground">읽지 않은 알림</p>
                <p className="mt-2 text-2xl font-bold text-foreground">
                  {unreadNotificationCount}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {!isInstalled && showInstallPanel ? (
        <aside className="fixed bottom-5 right-5 z-40 w-[min(360px,calc(100vw-2rem))] rounded-xl border border-border bg-white p-4 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary-light))] text-primary">
                <Smartphone className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-foreground">
                  Findy 앱 설치
                </h2>
                <p className="mt-1 break-keep text-xs leading-5 text-muted-foreground [word-break:keep-all]">
                  자주 쓰는 기기 바탕화면에 바로가기를 추가할 수 있어요.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowInstallPanel(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="앱 설치 안내 닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Button asChild variant="outline" size="sm" className="mt-4 w-full">
            <Link href="/install">
              <Download className="mr-2 h-4 w-4" />
              설치 안내 보기
            </Link>
          </Button>
        </aside>
      ) : null}
    </Layout>
  );
}
