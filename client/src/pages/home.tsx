import { Link } from "wouter";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  Database,
  MessageCircleMore,
  PackageOpen,
  PackageSearch,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ItemCard } from "@/components/item-card";
import { useAuth } from "@/hooks/use-auth";
import { useItems, useMyItems } from "@/hooks/use-items";
import { useMatches } from "@/hooks/use-matches";

const steps = [
  {
    title: "잃어버린 물건 등록",
    description: "사진, 특징, 잃어버린 위치를 남기면 Findy가 비교 기준으로 사용합니다.",
    icon: PackageSearch,
  },
  {
    title: "후보 자동 정리",
    description: "경찰청 습득물과 사용자 등록 습득물에서 가능성 높은 후보를 모읍니다.",
    icon: Sparkles,
  },
  {
    title: "원문 확인 또는 채팅",
    description: "경찰청 데이터는 원문으로, 사용자 등록글은 채팅으로 다음 행동을 이어갑니다.",
    icon: MessageCircleMore,
  },
];

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { data: myItems = [] } = useMyItems(undefined, isAuthenticated);
  const { data: matches = [] } = useMatches(isAuthenticated);
  const { data: foundItemsResult, isLoading } = useItems({
    type: "found",
    source: "lost112",
    limit: 6,
  });

  const lostItemCount = myItems.filter((item) => item.reportType === "lost").length;
  const activeMatchCount = matches.filter((match) => match.status !== "dismissed").length;
  const foundItems = foundItemsResult?.items ?? [];

  return (
    <Layout>
      <section className="border-b border-border/70 bg-[linear-gradient(180deg,hsl(var(--primary-light))_0%,hsl(var(--background))_58%,hsl(var(--background))_100%)]">
        <div className="container py-10 sm:py-12 lg:py-14 xl:max-w-[1440px]">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start">
            <div className="space-y-8">
              <div className="max-w-3xl">
                <Badge className="rounded-full border border-primary/15 bg-white/90 px-4 py-1.5 text-sm font-semibold text-primary shadow-sm hover:bg-white/90">
                  분실물 찾기 작업대
                </Badge>
                <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-[3.35rem] lg:leading-[1.06]">
                  잃어버린 물건을 등록하고
                  <br />
                  찾을 후보를 바로 확인하세요
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-[1.0625rem] sm:leading-8">
                  Findy는 내 분실물 정보를 기준으로 경찰청 습득물과 사용자 등록 습득물을 함께 비교합니다.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {steps.map((step, index) => (
                  <div
                    key={step.title}
                    className="rounded-[24px] border border-border/70 bg-white/86 p-5 shadow-[0_18px_30px_-26px_rgba(27,31,59,0.16)]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <step.icon className="h-5 w-5" />
                      </span>
                      <span className="text-xs font-bold text-primary">
                        STEP {index + 1}
                      </span>
                    </div>
                    <h2 className="mt-4 text-base font-semibold text-foreground">
                      {step.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Link
                  href="/report/lost"
                  className="group rounded-[26px] border border-primary/20 bg-primary p-6 text-primary-foreground shadow-[0_24px_46px_-30px_hsl(var(--primary)/0.62)] transition-all hover:-translate-y-1"
                >
                  <PackageSearch className="h-7 w-7" />
                  <h2 className="mt-5 text-xl font-bold">잃어버린 물건 등록</h2>
                  <p className="mt-2 text-sm leading-6 text-primary-foreground/82">
                    찾고 싶은 물건 정보를 먼저 만들면 이후 매칭 기준이 됩니다.
                  </p>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">
                    등록 시작
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>

                <Link
                  href="/matches"
                  className="group rounded-[26px] border border-border/70 bg-white/90 p-6 shadow-[0_18px_34px_-28px_rgba(27,31,59,0.2)] transition-all hover:-translate-y-1 hover:border-primary/25"
                >
                  <BellRing className="h-7 w-7 text-primary" />
                  <h2 className="mt-5 text-xl font-bold text-foreground">내 매칭 후보</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    등록한 분실물과 가까운 습득물 후보를 한곳에서 확인합니다.
                  </p>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                    {activeMatchCount > 0 ? `${activeMatchCount}건 확인` : "후보 보기"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>

                <Link
                  href="/items?type=found"
                  className="group rounded-[26px] border border-border/70 bg-white/90 p-6 shadow-[0_18px_34px_-28px_rgba(27,31,59,0.2)] transition-all hover:-translate-y-1 hover:border-primary/25"
                >
                  <Search className="h-7 w-7 text-primary" />
                  <h2 className="mt-5 text-xl font-bold text-foreground">습득물 직접 찾기</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    경찰청과 사용자 등록 습득물을 지역, 출처, 기간으로 좁혀봅니다.
                  </p>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                    탐색하기
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </div>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24">
              <Card className="border-border/70 bg-white/92 shadow-[0_22px_44px_-34px_rgba(27,31,59,0.18)]">
                <CardContent className="space-y-5 p-6">
                  <div>
                    <p className="text-sm font-semibold text-primary">내 진행 상태</p>
                    <h2 className="mt-2 text-2xl font-bold text-foreground">
                      {isAuthenticated ? "등록 후 후보를 확인하세요" : "로그인하면 내 물건 기준으로 보여줘요"}
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-border/70 bg-secondary/40 p-4">
                      <p className="text-xs font-medium text-muted-foreground">
                        내 분실물
                      </p>
                      <p className="mt-2 text-2xl font-bold text-foreground">
                        {isAuthenticated ? lostItemCount : "-"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-secondary/40 p-4">
                      <p className="text-xs font-medium text-muted-foreground">
                        매칭 후보
                      </p>
                      <p className="mt-2 text-2xl font-bold text-foreground">
                        {isAuthenticated ? activeMatchCount : "-"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Button asChild className="w-full rounded-full">
                      <Link href={isAuthenticated ? "/mypage" : "/login"}>
                        {isAuthenticated ? "내 물건 관리" : "로그인하기"}
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full rounded-full">
                      <Link href="/report/found">
                        <Plus className="mr-2 h-4 w-4" />
                        주운 물건 등록
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-sky-100 bg-sky-50/80 shadow-sm">
                <CardContent className="flex gap-3 p-5">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
                  <div>
                    <h2 className="font-semibold text-sky-900">경찰청 데이터도 함께 확인</h2>
                    <p className="mt-1 text-sm leading-6 text-sky-800/80">
                      경찰청 습득물은 원문 확인이 우선이고, 사용자 등록 습득물은 채팅으로 이어집니다.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
      </section>

      <section className="bg-background/80 py-10 md:py-12">
        <div className="container xl:max-w-[1440px]">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Database className="h-4 w-4" />
                최근 경찰청 습득물
              </div>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                전체 탐색 전에 최신 후보를 훑어보세요
              </h2>
            </div>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/items?type=found&source=lost112">
                경찰청 습득물 전체 보기
              </Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              {[1, 2, 3, 4, 5, 6].map((index) => (
                <div key={index} className="h-[290px] animate-pulse rounded-[24px] bg-muted" />
              ))}
            </div>
          ) : foundItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-border/80 bg-secondary/35 px-6 py-16 text-center">
              <PackageOpen className="mb-4 h-10 w-10 text-muted-foreground/55" />
              <h2 className="text-xl font-semibold">표시할 습득물이 없어요</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                수집이 완료되면 최근 경찰청 습득물이 여기에 표시됩니다.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              {foundItems.map((item, index) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  variant="compact"
                  showDateTime
                  imageLoading={index < 6 ? "eager" : "lazy"}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-border/60 bg-white/60 py-10">
        <div className="container grid gap-4 md:grid-cols-3 xl:max-w-[1440px]">
          <div className="flex items-start gap-3 rounded-[24px] border border-border/70 bg-white/88 p-5">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">분실물은 매칭 기준</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                내 물건을 등록해야 새 습득물과 자동 비교할 수 있습니다.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-[24px] border border-border/70 bg-white/88 p-5">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-sky-600" />
            <div>
              <h2 className="font-semibold">경찰청 물건은 원문 기준</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                보관 상태와 수령 정보는 경찰청 상세 페이지에서 확인합니다.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-[24px] border border-border/70 bg-white/88 p-5">
            <MessageCircleMore className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">사용자 글은 채팅 연결</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                개인이 등록한 습득물은 상세 확인 후 채팅으로 이어집니다.
              </p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
