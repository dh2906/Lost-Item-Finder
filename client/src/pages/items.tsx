import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { PackageOpen, PlusCircle, Search as SearchIcon } from "lucide-react";
import { Layout } from "@/components/layout";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ItemCard } from "@/components/item-card";
import { useItems } from "@/hooks/use-items";

function getTabFromSearch(search: string): "found" | "lost" {
  const params = new URLSearchParams(search);
  return params.get("type") === "lost" ? "lost" : "found";
}

export default function ItemsPage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"found" | "lost">(() => getTabFromSearch(window.location.search));
  const { data: items, isLoading } = useItems({ type: tab });

  useEffect(() => {
    const syncTabFromUrl = () => {
      setTab(getTabFromSearch(window.location.search));
    };

    syncTabFromUrl();
    window.addEventListener("popstate", syncTabFromUrl);

    return () => {
      window.removeEventListener("popstate", syncTabFromUrl);
    };
  }, []);

  const title = tab === "found" ? "등록된 습득물 전체보기" : "등록된 분실물 전체보기";
  const description =
    tab === "found"
      ? "지금까지 올라온 습득물 게시물을 한 번에 살펴보고 비슷한 물건이 있는지 확인해보세요."
      : "지금까지 올라온 분실물 게시물을 한 번에 살펴보고 관련 제보가 필요한 물건을 확인해보세요.";

  const emptyLabel = tab === "found" ? "습득물" : "분실물";

  const handleTabChange = (value: string) => {
    const nextTab = value === "lost" ? "lost" : "found";
    setTab(nextTab);
    void setLocation(`/items?type=${nextTab}`);
  };

  return (
    <Layout>
      <section className="border-b border-border/70 bg-[linear-gradient(180deg,hsl(var(--primary-light))_0%,transparent_100%)] pb-10 pt-14">
        <div className="container mx-auto max-w-6xl px-5">
          <div className="space-y-5">
            <div className="inline-flex items-center rounded-full border border-primary/12 bg-white/88 px-3 py-1 text-sm font-semibold text-primary shadow-sm">
              실시간 등록 게시물
            </div>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">{description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Tabs value={tab} onValueChange={handleTabChange}>
                  <TabsList className="h-11 rounded-full border border-border/70 bg-white/90 p-1 shadow-sm">
                    <TabsTrigger value="found" className="rounded-full px-4 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      습득물
                    </TabsTrigger>
                    <TabsTrigger value="lost" className="rounded-full px-4 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      분실물
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button asChild variant="outline" className="rounded-full border-border/70 bg-white/92 px-4 shadow-sm">
                  <Link href={tab === "found" ? "/report/found" : "/report/lost"}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {tab === "found" ? "습득물 등록" : "분실물 신고"}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-16 pt-10">
        <div className="container mx-auto max-w-6xl px-5">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {[1, 2, 3, 4, 5].map((index) => (
                <div key={index} className="h-[290px] animate-pulse rounded-[26px] bg-muted" />
              ))}
            </div>
          ) : !items || items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-border/80 bg-secondary/35 py-20 text-center">
              <div className="mb-4 rounded-full border border-border/70 bg-white p-4 shadow-sm">
                <PackageOpen className="h-8 w-8 text-muted-foreground/55" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-foreground">등록된 {emptyLabel}이 없어요</h3>
              <p className="mb-8 max-w-sm text-center leading-relaxed text-muted-foreground">
                첫 게시물을 등록해서 더 빠르게 연결을 시작해보세요.
              </p>
              <Button asChild className="h-11 rounded-full px-6 font-medium">
                <Link href={tab === "found" ? "/report/found" : "/report/lost"}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {tab === "found" ? "습득물 등록하기" : "분실물 신고하기"}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <h2 className="flex items-center gap-3 text-2xl font-bold text-foreground">
                  전체 게시물
                  <span className="inline-flex items-center justify-center rounded-full bg-accent px-3 py-0.5 text-sm font-bold text-primary">
                    {items.length}건
                  </span>
                </h2>
                {tab === "found" && (
                  <Button asChild variant="outline" className="rounded-full px-4">
                    <Link href="/search">
                      <SearchIcon className="mr-2 h-4 w-4" />
                      AI로 찾기
                    </Link>
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
