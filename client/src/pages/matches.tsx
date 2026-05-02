import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  BellRing,
  BookmarkCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  SearchX,
  XCircle,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { getDisplayTitle, ItemCard } from "@/components/item-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useMatches, useUpdateMatchStatus } from "@/hooks/use-matches";
import { useToast } from "@/hooks/use-toast";

const statusLabels = {
  new: "새 매칭",
  viewed: "확인함",
  dismissed: "숨김",
  confirmed: "저장한 후보",
} as const;

const PAGE_SIZE = 8;
type MatchFilter = "active" | "saved" | "hidden";

function getMatchEvidenceLabels(reasoning: string): string[] {
  const labels: string[] = [];
  const checks: Array<[RegExp, string]> = [
    [/키워드|표현|특징|태그/, "특징 일치"],
    [/카테고리|분류/, "분류 유사"],
    [/색상|색깔/, "색상 유사"],
    [/크기|사이즈/, "크기 참고"],
    [/거리|위치|지역|장소/, "위치 반영"],
    [/날짜|기간|일 차이|일로/, "날짜 반영"],
    [/점수|강한 후보|중간 수준/, "신뢰도 반영"],
  ];

  for (const [pattern, label] of checks) {
    if (pattern.test(reasoning) && !labels.includes(label)) {
      labels.push(label);
    }
  }

  return labels.slice(0, 5);
}

export default function MatchesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { data: matches = [], isLoading, isError } = useMatches(isAuthenticated);
  const updateMatchStatus = useUpdateMatchStatus();
  const [filter, setFilter] = useState<MatchFilter>("active");
  const [page, setPage] = useState(1);
  const sortedMatches = useMemo(
    () =>
      [...matches].sort((left, right) => {
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
  const activeMatches = sortedMatches.filter(
    (match) => match.status !== "dismissed" && match.status !== "confirmed"
  );
  const savedMatches = sortedMatches.filter((match) => match.status === "confirmed");
  const hiddenMatches = sortedMatches.filter((match) => match.status === "dismissed");
  const filteredMatches =
    filter === "saved"
      ? savedMatches
      : filter === "hidden"
        ? hiddenMatches
        : activeMatches;
  const totalPages = Math.max(1, Math.ceil(filteredMatches.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedMatches = filteredMatches.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleFilterChange = (nextFilter: string) => {
    setFilter(nextFilter as MatchFilter);
    setPage(1);
  };

  const handleStatusUpdate = async (matchId: number, status: "dismissed" | "confirmed") => {
    try {
      await updateMatchStatus.mutateAsync({ matchId, status });
      toast({
        title: status === "confirmed" ? "후보를 저장했어요" : "후보를 목록에서 숨겼어요",
        description:
          status === "confirmed"
            ? "마이페이지의 저장한 후보에서도 확인할 수 있어요."
            : "아니오로 표시한 후보는 이 목록에서 제외됩니다.",
      });
    } catch (error) {
      toast({
        title: "상태 업데이트 실패",
        description: error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.",
        variant: "destructive",
      });
    }
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="container flex min-h-[50vh] items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container max-w-3xl py-16">
          <Card className="border-border/70 bg-white/90 text-center">
            <CardHeader>
              <CardTitle className="text-2xl">내 자동 매칭 보기</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                분실물에 연결된 습득물 후보를 보려면 로그인해 주세요.
              </p>
              <Button asChild className="rounded-full px-6">
                <Link href="/login">로그인하기</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="border-b border-border/70 bg-[linear-gradient(180deg,hsl(var(--primary-light))_0%,transparent_100%)] pb-10 pt-14">
        <div className="container max-w-6xl px-5">
          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full border border-primary/12 bg-white/88 px-3 py-1 text-sm font-semibold text-primary shadow-sm">
              <BellRing className="mr-2 h-4 w-4" />
              자동 매칭 결과
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                내 분실물과 연결된 습득물
              </h1>
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-sm font-semibold">
                {activeMatches.length + savedMatches.length}건
              </Badge>
            </div>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              점수가 높은 후보부터 정렬하고, 맞아 보이는 후보는 저장해서 따로 관리할 수 있어요.
            </p>
          </div>
        </div>
      </section>

      <section className="pb-16 pt-10">
        <div className="container max-w-6xl px-5">
          {isLoading ? (
            <div className="flex min-h-[240px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : isError ? (
            <Card className="border-border/70 bg-white/90">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                매칭 결과를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
              </CardContent>
            </Card>
          ) : matches.length === 0 ? (
            <Card className="border-dashed border-border/80 bg-secondary/35">
              <CardContent className="flex flex-col items-center py-16 text-center">
                <SearchX className="mb-4 h-10 w-10 text-muted-foreground/55" />
                <h2 className="text-xl font-semibold">지금 확인할 후보가 없어요</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  새 매칭이 생기면 여기에서 다시 보여드릴게요. 필요하면 분실물 정보를 더 자세히 보완해 보세요.
                </p>
                <Button asChild className="mt-6 rounded-full px-6">
                  <Link href="/report/lost">잃어버린 물건 등록하기</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Tabs value={filter} onValueChange={handleFilterChange}>
                  <TabsList className="h-11 rounded-lg border border-border bg-white p-1">
                    <TabsTrigger value="active" className="rounded-md px-4">
                      확인할 후보 {activeMatches.length}
                    </TabsTrigger>
                    <TabsTrigger value="saved" className="rounded-md px-4">
                      저장한 후보 {savedMatches.length}
                    </TabsTrigger>
                    <TabsTrigger value="hidden" className="rounded-md px-4">
                      숨긴 후보 {hiddenMatches.length}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <p className="text-sm text-muted-foreground">
                  매칭 점수 높은 순으로 표시합니다.
                </p>
              </div>

              {filteredMatches.length === 0 ? (
                <Card className="border-dashed border-border/80 bg-secondary/35">
                  <CardContent className="flex flex-col items-center py-12 text-center">
                    <BookmarkCheck className="mb-4 h-9 w-9 text-muted-foreground/55" />
                    <h2 className="text-lg font-semibold">
                      {filter === "saved"
                        ? "저장한 후보가 아직 없어요"
                        : filter === "hidden"
                          ? "숨긴 후보가 없어요"
                          : "확인할 후보가 없어요"}
                    </h2>
                  </CardContent>
                </Card>
              ) : null}

              {pagedMatches.map((match) => (
                <Card key={match.id} className="border-border/70 bg-white/92">
                    <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">
                            {statusLabels[match.status]}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="rounded-full border-border bg-white text-muted-foreground"
                          >
                            매칭 점수 {Math.round(match.score * 100)}%
                          </Badge>
                          <span>내 분실물: {getDisplayTitle(match.lostItem)}</span>
                        </div>
                        <div className="rounded-xl border border-primary/10 bg-accent/70 px-3 py-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                            {getMatchEvidenceLabels(match.matchReason).map((label) => (
                              <span
                                key={label}
                                className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-primary"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                          <p className="mt-2 break-keep text-xs leading-5 text-muted-foreground [word-break:keep-all]">
                            {match.matchReason}
                          </p>
                        </div>
                        <ItemCard
                          item={match.foundItem}
                          score={match.score}
                          reasoning={match.matchReason}
                          variant="list"
                        />
                      </div>

                      <div className="space-y-3 rounded-[22px] border border-border/70 bg-secondary/35 p-4 lg:sticky lg:top-24">
                       <div>
                        <p className="text-sm font-semibold">이 물건이 맞나요?</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          맞아 보이면 저장하고, 아니면 이 목록에서 바로 숨길 수 있어요.
                        </p>
                      </div>
                      <Button
                        className="w-full rounded-full"
                        disabled={updateMatchStatus.isPending}
                        onClick={() => handleStatusUpdate(match.id, "confirmed")}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        네
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full rounded-full"
                        disabled={updateMatchStatus.isPending}
                        onClick={() => handleStatusUpdate(match.id, "dismissed")}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        아니요
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {filteredMatches.length > PAGE_SIZE ? (
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {currentPage}/{totalPages}페이지 · 전체 {filteredMatches.length}건
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      이전
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() =>
                        setPage((value) => Math.min(totalPages, value + 1))
                      }
                    >
                      다음
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
