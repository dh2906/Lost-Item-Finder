import { Link } from "wouter";
import {
  ArrowRight,
  BellRing,
  Database,
  PackageOpen,
  PackageSearch,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ItemCard } from "@/components/item-card";
import { useAuth } from "@/hooks/use-auth";
import { useItems, useMyItems } from "@/hooks/use-items";
import { useMatches } from "@/hooks/use-matches";

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
        <div className="container py-8 sm:py-10 lg:py-12 xl:max-w-[1440px]">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Link
              href="/report/lost"
              className="group flex min-h-[224px] flex-col rounded-xl border border-primary/20 bg-primary p-5 text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all hover:-translate-y-0.5"
            >
              <PackageSearch className="h-6 w-6" />
              <h2 className="mt-4 text-lg font-bold">잃어버린 물건 등록</h2>
              <p className="mt-2 text-sm leading-6 text-primary-foreground/82">
                찾고 싶은 물건 정보를 만들고 새 습득물과 비교합니다.
              </p>
              <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold">
                등록 시작
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>

            <Link
              href="/matches"
              className="group flex min-h-[224px] flex-col rounded-xl border border-border bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-0.5 hover:border-primary/25"
            >
              <BellRing className="h-6 w-6 text-primary" />
              <h2 className="mt-4 text-lg font-bold text-foreground">매칭 후보</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                내 분실물 기준으로 가까운 습득물 후보를 확인합니다.
              </p>
              <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-primary">
                {activeMatchCount > 0 ? `${activeMatchCount}건 확인` : "후보 보기"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>

            <Link
              href="/items?type=found"
              className="group flex min-h-[224px] flex-col rounded-xl border border-border bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-0.5 hover:border-primary/25"
            >
              <Search className="h-6 w-6 text-primary" />
              <h2 className="mt-4 text-lg font-bold text-foreground">습득물 찾기</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                물건명, 지역, 출처, 기간으로 경찰청과 사용자 습득물을 검색합니다.
              </p>
              <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-primary">
                탐색하기
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>

            <Card className="min-h-[224px] border-border bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
              <CardContent className="flex h-full flex-col space-y-5 p-5">
                  <div>
                    <p className="text-sm font-semibold text-primary">내 진행 상태</p>
                    <h2 className="mt-2 text-xl font-bold leading-snug text-foreground">
                      {isAuthenticated ? "등록 후 후보를 확인하세요" : "로그인하면 내 기준으로 보여줘요"}
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border bg-secondary/40 p-4">
                      <p className="text-xs font-medium text-muted-foreground">
                        내 분실물
                      </p>
                      <p className="mt-2 text-2xl font-bold text-foreground">
                        {isAuthenticated ? lostItemCount : "-"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-secondary/40 p-4">
                      <p className="text-xs font-medium text-muted-foreground">
                        매칭 후보
                      </p>
                      <p className="mt-2 text-2xl font-bold text-foreground">
                        {isAuthenticated ? activeMatchCount : "-"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto space-y-2">
                    <Button asChild className="w-full">
                      <Link href={isAuthenticated ? "/mypage" : "/login"}>
                        {isAuthenticated ? "내 물건 관리" : "로그인하기"}
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/report/found">
                        <Plus className="mr-2 h-4 w-4" />
                        주운 물건 등록
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
          </div>

          <div className="mt-4 rounded-xl border border-primary/15 bg-white/75 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm leading-6 text-muted-foreground">
                경찰청 습득물은 원문 확인으로, 사용자 등록 습득물은 채팅으로 다음 행동을 이어갑니다.
              </p>
            </div>
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
            <Button asChild variant="outline">
              <Link href="/items?type=found&source=lost112">
                경찰청 습득물 전체 보기
              </Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              {[1, 2, 3, 4, 5, 6].map((index) => (
                <div key={index} className="h-[290px] animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : foundItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-secondary/35 px-6 py-16 text-center">
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

      <section className="border-t border-border bg-white py-8">
        <div className="container flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between xl:max-w-[1440px]">
          <p>
            분실물은 매칭 기준으로 저장되고, 경찰청 습득물은 원문 확인을 우선합니다.
          </p>
          <Link
            href="/report/lost"
            className="inline-flex items-center gap-2 font-semibold text-primary"
          >
            내 물건 등록하기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </Layout>
  );
}
