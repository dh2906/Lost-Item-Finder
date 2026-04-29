import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useItem } from "@/hooks/use-items";
import { ChatButton } from "@/components/chat-button";
import { getDisplayTitle, ItemCard } from "@/components/item-card";
import { useItemMatches, useUpdateMatchStatus } from "@/hooks/use-matches";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin,
  Calendar,
  Tag,
  AlertCircle,
  Mail,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { normalizeItemImageUrls } from "@shared/item-images";

const INTERNAL_TAGS = new Set(["lost112", "police", "경찰청"]);

function isPlaceholderImageUrl(imageUrl: string): boolean {
  const normalized = imageUrl.toLowerCase();
  return (
    normalized.includes("noimage") ||
    normalized.includes("no_img") ||
    normalized.includes("no-image") ||
    normalized.includes("ready") ||
    normalized.includes("placeholder")
  );
}

export default function ItemDetail() {
  const [, params] = useRoute("/item/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;

  const { isAuthenticated, user } = useAuth();
  const { data: item, isLoading, isError } = useItem(id);
  const { toast } = useToast();
  const isOwnedLostItem = Boolean(
    isAuthenticated && item?.userId === user?.id && item?.reportType === "lost"
  );
  const { data: matches = [], isLoading: isMatchesLoading } = useItemMatches(
    id,
    isOwnedLostItem
  );
  const updateMatchStatus = useUpdateMatchStatus();
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const isLost112Item = item?.externalSource === "lost112";
  const itemImageUrls = item
    ? normalizeItemImageUrls(item).filter(
        (imageUrl) => !(isLost112Item && isPlaceholderImageUrl(imageUrl))
      )
    : [];

  useEffect(() => {
    if (!carouselApi) {
      return;
    }

    const syncSelectedIndex = () => {
      setSelectedImageIndex(carouselApi.selectedScrollSnap());
    };

    syncSelectedIndex();
    carouselApi.on("select", syncSelectedIndex);
    carouselApi.on("reInit", syncSelectedIndex);

    return () => {
      carouselApi.off("select", syncSelectedIndex);
      carouselApi.off("reInit", syncSelectedIndex);
    };
  }, [carouselApi]);

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

  const isOwner = item.userId !== null && item.userId === user?.id;
  const displayTitle = getDisplayTitle(item);
  const visibleTags = (item.tags ?? []).filter((tag) => !INTERNAL_TAGS.has(tag));
  const listHref = `/items?type=${item.reportType}`;

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
          <Link href={listHref}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            목록으로
          </Link>
        </Button>
        <h1 className="sr-only">{displayTitle}</h1>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px] xl:gap-8">
          <div className="order-2 space-y-5 xl:order-1">
            <div className="relative mb-5 overflow-hidden rounded-[28px] border border-border/70 bg-muted/70 shadow-card">
              {itemImageUrls.length > 0 ? (
                <>
                  <Carousel
                    setApi={setCarouselApi}
                    opts={{ loop: itemImageUrls.length > 1 }}
                    className="w-full"
                  >
                    <CarouselContent className="-ml-0">
                      {itemImageUrls.map((imageUrl, index) => (
                        <CarouselItem key={`${imageUrl}-${index}`} className="pl-0">
                          <div className="aspect-[4/3] bg-muted">
                            <img
                              src={imageUrl}
                              alt={`${item.title} 이미지 ${index + 1}`}
                              loading={index === 0 ? "eager" : "lazy"}
                              decoding="async"
                              className="h-full w-full object-cover"
                            />
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    {itemImageUrls.length > 1 ? (
                      <>
                        <CarouselPrevious className="left-4 h-11 w-11 border-white/70 bg-white/90 text-foreground shadow-lg hover:bg-white" />
                        <CarouselNext className="right-4 h-11 w-11 border-white/70 bg-white/90 text-foreground shadow-lg hover:bg-white" />
                      </>
                    ) : null}
                  </Carousel>

                  {itemImageUrls.length > 1 ? (
                    <>
                      <div className="absolute bottom-4 right-4 rounded-full bg-black/65 px-3 py-1 text-sm font-medium text-white">
                        {selectedImageIndex + 1} / {itemImageUrls.length}
                      </div>
                      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-black/35 px-3 py-2 backdrop-blur-sm">
                        {itemImageUrls.map((imageUrl, index) => (
                          <button
                            key={`${imageUrl}-dot-${index}`}
                            type="button"
                            onClick={() => carouselApi?.scrollTo(index)}
                            className={cn(
                              "h-2.5 w-2.5 rounded-full transition-all",
                              index === selectedImageIndex
                                ? "bg-white"
                                : "bg-white/45 hover:bg-white/70"
                            )}
                            aria-label={`${index + 1}번째 이미지 보기`}
                          />
                        ))}
                      </div>
                    </>
                  ) : null}
                </>
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
              {isLost112Item ? (
                <Badge
                  variant="outline"
                  className="absolute left-3 top-12 border-sky-200 bg-sky-50/95 text-sky-700 hover:bg-sky-50"
                >
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                  경찰청 등록
                </Badge>
              ) : null}
            </div>

            {itemImageUrls.length > 1 ? (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {itemImageUrls.map((imageUrl, index) => (
                  <button
                    key={`${imageUrl}-thumbnail-${index}`}
                    type="button"
                    onClick={() => carouselApi?.scrollTo(index)}
                    className={cn(
                      "relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 bg-muted transition-all",
                      index === selectedImageIndex
                        ? "border-primary shadow-[0_14px_24px_-18px_hsl(var(--primary)/0.42)]"
                        : "border-transparent hover:border-primary/30"
                    )}
                    aria-label={`${index + 1}번째 이미지 썸네일`}
                  >
                    <img
                      src={imageUrl}
                      alt={`${item.title} 썸네일 ${index + 1}`}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
               <div className="rounded-[24px] border border-border/70 bg-white/88 p-4 shadow-sm">
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">장소</p>
                <p className="text-sm font-medium leading-6 break-words">
                  {item.location || "-"}
                </p>
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
                  <CardTitle className="text-lg">
                    {isLost112Item ? "경찰청 등록 설명" : "상세 설명"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-7 text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            )}

            {isLost112Item && item.externalUrl ? (
              <Card className="border-sky-100 bg-sky-50/80">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-sky-800">
                      수령과 보관 정보는 경찰청 원문에서 확인하세요
                    </p>
                    <p className="mt-1 text-xs text-sky-700/80">
                      Findy가 수집한 외부 데이터입니다. 실제 보관 상태와 연락처는 원문이 기준입니다.
                    </p>
                  </div>
                  <Button asChild variant="outline" className="rounded-full border-sky-200 bg-white text-sky-700 hover:bg-sky-50">
                    <a href={item.externalUrl} target="_blank" rel="noreferrer">
                      경찰청 원문으로 이동
                      <ExternalLink className="ml-1.5 h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {(item.itemCategory || item.color || visibleTags.length > 0) && (
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

                  {visibleTags.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-medium">태그</p>
                      <div className="flex flex-wrap gap-1.5">
                        {visibleTags.map((tag) => (
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

          <div className="order-1 space-y-5 xl:sticky xl:top-24 xl:order-2">
             <Card className="border-border/70 bg-white/90">
              <CardHeader className="space-y-3 pb-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    요약 정보
                  </p>
                  <CardTitle className="text-2xl leading-tight">{displayTitle}</CardTitle>
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
                    {isLost112Item ? (
                      <Badge
                        variant="outline"
                        className="border-sky-200 bg-sky-50 text-sky-700"
                      >
                        <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                        경찰청 등록
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  {item.location && (
                     <div className="inline-flex max-w-full items-start gap-1.5 rounded-2xl bg-secondary px-3 py-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="min-w-0 break-words">{item.location}</span>
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
                <div className="rounded-[22px] bg-secondary/45 p-4 text-sm leading-6 text-muted-foreground">
                  {isLost112Item
                    ? "경찰청 원문에서 보관 기관과 실제 수령 가능 여부를 확인하세요."
                    : "장소, 날짜, 상태를 확인한 뒤 연락하거나 제보를 남겨 주세요."}
                </div>
              </CardContent>
            </Card>

             <Card className="border-border/70 bg-white/90">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">
                  {isOwner
                    ? "내 게시글 관리"
                    : isLost112Item
                      ? "경찰청에 등록된 물건입니다"
                      : "이 물건이 당신의 것인가요?"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm leading-6 text-muted-foreground">
                  {isOwner
                    ? "필요하면 내용을 수정하거나, 마이페이지에서 해결 상태를 관리할 수 있어요."
                    : isLost112Item
                    ? "수령 가능 여부와 보관 기관 연락처는 경찰청 원문에서 먼저 확인하세요."
                    : "상세 정보를 확인하고 연락해 주세요."}
                </p>
                {isOwner ? (
                  <Button asChild className="w-full rounded-full">
                    <Link href="/mypage">마이페이지에서 관리</Link>
                  </Button>
                ) : isLost112Item && item.externalUrl ? (
                  <Button asChild className="w-full rounded-full">
                    <a href={item.externalUrl} target="_blank" rel="noreferrer">
                      경찰청 원문 확인
                      <ExternalLink className="ml-1.5 h-4 w-4" />
                    </a>
                  </Button>
                ) : item.contactInfo ? (
                   <div className="flex items-center gap-2 rounded-[22px] border border-border/70 bg-secondary/40 p-4">
                     <Mail className="h-4 w-4 text-primary" />
                     <span className="font-medium">{item.contactInfo}</span>
                   </div>
                ) : (
                  <div className="rounded-[22px] border border-border/70 bg-secondary/40 p-4 text-sm text-muted-foreground">
                    공개된 연락 수단이 없어요.
                  </div>
                )}
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
