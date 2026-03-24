import { Link } from "wouter";
import { BellRing, CheckCircle2, Eye, Loader2, SearchX, XCircle } from "lucide-react";
import { Layout } from "@/components/layout";
import { ItemCard } from "@/components/item-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useMatches, useUpdateMatchStatus } from "@/hooks/use-matches";
import { useToast } from "@/hooks/use-toast";

const statusLabels = {
  new: "새 매칭",
  viewed: "확인함",
  dismissed: "관련 없음",
  confirmed: "가능성 높음",
} as const;

export default function MatchesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { data: matches = [], isLoading, isError } = useMatches(isAuthenticated);
  const updateMatchStatus = useUpdateMatchStatus();

  const handleStatusUpdate = async (
    matchId: number,
    status: "viewed" | "dismissed" | "confirmed"
  ) => {
    try {
      await updateMatchStatus.mutateAsync({ matchId, status });
      toast({
        title: "매칭 상태를 업데이트했어요",
        description: statusLabels[status],
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
                {matches.length}건
              </Badge>
            </div>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              새 습득물이 등록될 때 카테고리, 키워드, 날짜, 위치, 임베딩 유사도를 함께 반영한 매칭 점수로 후보를 저장합니다.
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
                <h2 className="text-xl font-semibold">아직 자동 매칭 결과가 없어요</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  분실물을 먼저 등록해 두면 이후 들어오는 습득물과 자동으로 비교해 보여드릴게요.
                </p>
                <Button asChild className="mt-6 rounded-full px-6">
                  <Link href="/report/lost">분실물 신고하기</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {matches.map((match) => (
                <Card key={match.id} className="border-border/70 bg-white/92">
                  <CardContent className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_230px] lg:items-start">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">
                          {statusLabels[match.status]}
                        </Badge>
                        <span>내 분실물: {match.lostItem.title}</span>
                      </div>
                      <ItemCard
                        item={match.foundItem}
                        score={match.score}
                        reasoning={match.matchReason}
                        variant="compact"
                      />
                    </div>

                    <div className="space-y-3 rounded-[22px] border border-border/70 bg-secondary/35 p-4">
                      <div>
                        <p className="text-sm font-semibold">빠른 처리</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          실제로 내 물건에 가까운지 판단한 결과를 남겨 두면 이후 푸시 기준을 조정하기 쉬워집니다.
                        </p>
                      </div>
                      <Button
                        className="w-full rounded-full"
                        disabled={updateMatchStatus.isPending}
                        onClick={() => handleStatusUpdate(match.id, "confirmed")}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        가능성 높음
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full rounded-full"
                        disabled={updateMatchStatus.isPending}
                        onClick={() => handleStatusUpdate(match.id, "viewed")}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        확인 완료
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full rounded-full text-muted-foreground"
                        disabled={updateMatchStatus.isPending}
                        onClick={() => handleStatusUpdate(match.id, "dismissed")}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        관련 없음
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
