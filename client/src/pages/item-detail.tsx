import { useRoute } from "wouter";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import {
  useAddFavorite,
  useFavoriteItems,
  useRemoveFavorite,
} from "@/hooks/use-favorites";
import { useItem } from "@/hooks/use-items";
import { ChatButton } from "@/components/chat-button";
import { ItemCard } from "@/components/item-card";
import { useItemMatches, useUpdateMatchStatus } from "@/hooks/use-matches";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin,
  Calendar,
  Tag,
  AlertCircle,
  Heart,
  Loader2,
  Mail,
  ArrowLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function ItemDetail() {
  const [, params] = useRoute("/item/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;

  const { isAuthenticated, user } = useAuth();
  const { data: item, isLoading, isError } = useItem(id);
  const { toast } = useToast();
  const { data: favoriteItems = [], isLoading: isFavoriteItemsLoading } =
    useFavoriteItems();
  const addFavoriteMutation = useAddFavorite();
  const removeFavoriteMutation = useRemoveFavorite();
  const isOwnedLostItem = Boolean(
    isAuthenticated && item?.userId === user?.id && item?.reportType === "lost"
  );
  const { data: matches = [], isLoading: isMatchesLoading } = useItemMatches(
    id,
    isOwnedLostItem
  );
  const updateMatchStatus = useUpdateMatchStatus();

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-8 xl:max-w-[1440px]">
          <div className="mb-6 aspect-[4/3] rounded-[28px] bg-muted animate-pulse" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 rounded bg-muted animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !item) {
    return (
      <Layout>
        <div className="container max-w-lg py-16 text-center xl:max-w-[1440px]">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="mb-2 text-2xl font-semibold">물건을 찾을 수 없습니다</h1>
          <p className="mb-6 text-muted-foreground">
            삭제되었거나 잘못된 주소일 수 있습니다.
          </p>
          <Button asChild>
            <Link href="/">홈으로 돌아가기</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const favoriteEntry = favoriteItems.find(
    (favoriteItem) => favoriteItem.item.id === item.id
  );
  const isFavorite = Boolean(favoriteEntry);
  const isFavoriteMutating =
    addFavoriteMutation.isPending || removeFavoriteMutation.isPending;
  const isOwner = item.userId !== null && item.userId === user?.id;

  const handleFavoriteToggle = () => {
    if (isFavorite) {
      removeFavoriteMutation.mutate(item.id);
      return;
    }

    addFavoriteMutation.mutate({ itemId: item.id });
  };

  const handleMatchStatus = async (
    matchId: number,
    status: "viewed" | "dismissed" | "confirmed"
  ) => {
    try {
      await updateMatchStatus.mutateAsync({ matchId, status });
      toast({ title: "매칭 상태를 저장했어요" });
    } catch (error) {
      toast({
        title: "상태 저장 실패",
        description:
          error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <div className="container py-8 sm:py-10 xl:max-w-[1440px]">
        <Button variant="ghost" size="sm" asChild className="mb-5 rounded-full">
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-1" />
            목록으로
          </Link>
        </Button>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px] xl:gap-8">
          <div className="space-y-5">
            <div className="relative mb-5 overflow-hidden rounded-[28px] border border-border/70 bg-muted/70 shadow-card">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="max-h-[540px] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center">
                  <Tag className="h-12 w-12 text-muted-foreground/30" />
                </div>
              )}
              <Badge
                className={cn(
                  "absolute left-3 top-3",
                  item.reportType === "found"
                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border border-emerald-200"
                    : "bg-red-50 text-red-600 hover:bg-red-50 border border-red-200"
                )}
              >
                {item.reportType === "found" ? "습득" : "분실"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
               <div className="rounded-[24px] border border-border/70 bg-white/88 p-4 shadow-sm">
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">장소</p>
                <p className="truncate text-sm font-medium">{item.location || "-"}</p>
              </div>
               <div className="rounded-[24px] border border-border/70 bg-white/88 p-4 shadow-sm">
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">날짜</p>
                <p className="text-sm font-medium">
                  {item.date ? format(new Date(item.date), "MM/dd", { locale: ko }) : "-"}
                </p>
              </div>
               <div className="rounded-[24px] border border-border/70 bg-white/88 p-4 shadow-sm">
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">카테고리</p>
                <p className="text-sm font-medium">{item.itemCategory || "-"}</p>
              </div>
            </div>

            {item.description && (
               <Card className="border-border/70 bg-white/90">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">상세 설명</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-7 text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            )}

            {(item.itemCategory || item.color || (item.tags && item.tags.length > 0)) && (
               <Card className="border-border/70 bg-white/90">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">추가 정보</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {item.itemCategory && (
                       <div className="rounded-[22px] border border-border/70 bg-secondary/40 p-4">
                        <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">카테고리</p>
                        <p className="font-medium">{item.itemCategory}</p>
                      </div>
                    )}
                    {item.color && (
                       <div className="rounded-[22px] border border-border/70 bg-secondary/40 p-4">
                        <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">색상</p>
                        <p className="font-medium capitalize">{item.color}</p>
                      </div>
                    )}
                  </div>

                  {item.tags && item.tags.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-medium">태그</p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="rounded-full border border-border/70 bg-muted/70 px-2.5">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {isOwnedLostItem && (
              <Card className="border-border/70 bg-white/90">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-lg">자동 매칭된 습득물</CardTitle>
                    <Button asChild variant="outline" className="rounded-full">
                      <Link href="/matches">전체 보기</Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isMatchesLoading ? (
                    <div className="text-sm text-muted-foreground">
                      매칭 결과를 불러오는 중입니다.
                    </div>
                  ) : matches.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-border/70 bg-secondary/35 p-5 text-sm leading-6 text-muted-foreground">
                      아직 이 분실물에 저장된 자동 매칭 결과가 없어요.
                    </div>
                  ) : (
                    matches.map((match) => (
                      <div
                        key={match.id}
                        className="space-y-3 rounded-[24px] border border-border/70 bg-secondary/20 p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">
                            매칭 점수 {Math.round(match.score * 100)}점
                          </Badge>
                          <Badge variant="outline" className="rounded-full">
                            {match.status}
                          </Badge>
                        </div>
                        <ItemCard
                          item={match.foundItem}
                          score={match.score}
                          reasoning={match.matchReason}
                          variant="compact"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="rounded-full"
                            disabled={updateMatchStatus.isPending}
                            onClick={() => handleMatchStatus(match.id, "confirmed")}
                          >
                            가능성 높음
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            disabled={updateMatchStatus.isPending}
                            onClick={() => handleMatchStatus(match.id, "viewed")}
                          >
                            확인 완료
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-full"
                            disabled={updateMatchStatus.isPending}
                            onClick={() => handleMatchStatus(match.id, "dismissed")}
                          >
                            관련 없음
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-5 xl:sticky xl:top-24">
             <Card className="border-border/70 bg-white/90">
              <CardHeader className="space-y-3 pb-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    Item record
                  </p>
                  <CardTitle className="text-2xl leading-tight">{item.title}</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        item.status === "resolved"
                          ? "border-slate-300 text-slate-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      )}
                    >
                      {item.status === "resolved" ? "해결 완료" : "진행 중"}
                    </Badge>
                    {isOwner && (
                      <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                        내 게시글
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  {item.location && (
                     <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {item.location}
                    </div>
                  )}
                  {item.date && (
                     <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(item.date), "PPP", { locale: ko })}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isOwner && (
                  <Button asChild variant="outline" className="w-full rounded-2xl">
                    <Link href={`/item/${item.id}/edit`}>
                      게시글 수정하기
                    </Link>
                  </Button>
                )}
                {isAuthenticated ? (
                  <>
                    <Button
                      type="button"
                      onClick={handleFavoriteToggle}
                      disabled={isFavoriteItemsLoading || isFavoriteMutating}
                      variant={isFavorite ? "default" : "outline"}
                      className={cn(
                        "w-full rounded-2xl",
                        isFavorite
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "border-border/70 bg-white"
                      )}
                    >
                      {isFavoriteItemsLoading || isFavoriteMutating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Heart
                          className={cn(
                            "mr-2 h-4 w-4",
                            isFavorite && "fill-current"
                          )}
                        />
                      )}
                      {isFavorite
                        ? "관심 게시물에서 제거"
                        : "관심 게시물로 저장"}
                    </Button>
                    {favoriteEntry && (
                      <div className="rounded-[22px] border border-border/70 bg-secondary/40 p-4 text-sm text-muted-foreground">
                        {format(
                          new Date(favoriteEntry.createdAt),
                          "PPP p",
                          { locale: ko }
                        )}
                        에 저장된 게시물입니다. 마이페이지에서 모아볼 수 있어요.
                      </div>
                    )}
                  </>
                ) : (
                  <Button asChild variant="outline" className="w-full rounded-2xl">
                    <Link href={`/login?redirect=${encodeURIComponent(`/item/${item.id}`)}`}>
                      <Heart className="mr-2 h-4 w-4" />
                      로그인하고 관심 게시물 저장
                    </Link>
                  </Button>
                )}
                 <div className="rounded-[22px] bg-secondary/45 p-4 text-sm leading-6 text-muted-foreground">
                  핵심 정보와 연락 수단을 오른쪽에 고정해 두어, 큰 화면에서도 스크롤 이동 없이 바로 판단할 수 있게 했습니다.
                </div>
              </CardContent>
            </Card>

             <Card className="border-border/70 bg-white/90">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">이 물건이 당신의 것인가요?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm leading-6 text-muted-foreground">
                  상세 정보를 확인하고 연락해 주세요.
                </p>
                {item.contactInfo ? (
                   <div className="flex items-center gap-2 rounded-[22px] border border-border/70 bg-secondary/40 p-4">
                     <Mail className="h-4 w-4 text-primary" />
                     <span className="font-medium">{item.contactInfo}</span>
                   </div>
                ) : (
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">관리자에게 문의</Button>
                )}
                {isAuthenticated && item.userId === user?.id ? (
                  <Button className="mt-3 w-full rounded-full" disabled>
                    내 게시물입니다.
                  </Button>
                ) : null}
                {isAuthenticated && item.userId && item.userId !== user?.id ? (
                  <div className="mt-3">
                    <ChatButton
                      itemId={item.id}
                      receiverId={item.userId}
                      className="w-full rounded-full"
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
