import { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Link } from "wouter";
import {
  BookmarkCheck,
  Heart,
  PackageSearch,
  Search,
  UserRound,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { ItemCard } from "@/components/item-card";
import { useAuth } from "@/hooks/use-auth";
import { useFavoriteItems } from "@/hooks/use-favorites";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type FilterType = "all" | "found" | "lost";

export default function MyPage() {
  const { user } = useAuth();
  const { data: favorites = [], isLoading } = useFavoriteItems();
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredFavorites = favorites.filter((favorite) =>
    filter === "all" ? true : favorite.item.reportType === filter
  );
  const foundCount = favorites.filter(
    (favorite) => favorite.item.reportType === "found"
  ).length;
  const lostCount = favorites.filter(
    (favorite) => favorite.item.reportType === "lost"
  ).length;

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
                  저장해 둔 관심 게시물을
                  <br />
                  한곳에서 다시 확인하세요
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                  상세 페이지에서 저장한 게시물을 모아 보고, 습득물과 분실물
                  흐름을 나눠 빠르게 다시 확인할 수 있게 구성했습니다.
                </p>
              </div>
            </div>

            <Card className="border-border/70 bg-white/92 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <UserRound className="h-5 w-5 text-primary" />
                  내 계정 요약
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
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-border/70 bg-secondary/40 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      전체 저장
                    </p>
                    <p className="mt-2 text-2xl font-bold text-foreground">
                      {favorites.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-secondary/40 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      습득물
                    </p>
                    <p className="mt-2 text-2xl font-bold text-foreground">
                      {foundCount}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-secondary/40 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      분실물
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
      </section>

      <section className="pb-16 pt-10">
        <div className="container mx-auto max-w-6xl px-5">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
                <BookmarkCheck className="h-6 w-6 text-primary" />
                관심 게시물 목록
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                저장한 순서대로 정리되어 있어, 최근에 체크한 게시물부터 다시 볼 수
                있습니다.
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
                  value="found"
                  className="rounded-full px-4 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  습득물
                </TabsTrigger>
                <TabsTrigger
                  value="lost"
                  className="rounded-full px-4 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  분실물
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((index) => (
                <div key={index} className="space-y-3">
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-[330px] animate-pulse rounded-[26px] bg-muted" />
                </div>
              ))}
            </div>
          ) : favorites.length === 0 ? (
            <Card className="border-dashed border-border/80 bg-secondary/35">
              <CardContent className="flex flex-col items-center py-16 text-center">
                <div className="mb-5 rounded-full border border-border/70 bg-white p-4 shadow-sm">
                  <Heart className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  아직 저장한 관심 게시물이 없어요
                </h3>
                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  게시물 상세 페이지에서 관심 등록을 누르면, 마이페이지에 모아
                  두고 다시 확인할 수 있습니다.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Button asChild className="rounded-full px-5">
                    <Link href="/items">
                      <PackageSearch className="mr-2 h-4 w-4" />
                      전체 게시물 보기
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
          ) : filteredFavorites.length === 0 ? (
            <Card className="border-border/70 bg-white/92">
              <CardContent className="py-14 text-center">
                <h3 className="text-lg font-semibold text-foreground">
                  이 조건에 맞는 관심 게시물이 아직 없어요
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  다른 필터를 선택하거나 새로운 게시물을 저장해 보세요.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredFavorites.map((favorite) => (
                <div key={favorite.item.id} className="space-y-3">
                  <div className="flex items-center justify-between px-1 text-xs font-medium text-muted-foreground">
                    <span>저장 시각</span>
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
