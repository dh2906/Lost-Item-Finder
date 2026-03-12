import { useState } from "react";
import { Link } from "wouter";
import { Search, Plus, PackageOpen } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ItemCard } from "@/components/item-card";
import { useItems } from "@/hooks/use-items";

export default function Home() {
  const [tab, setTab] = useState<"found" | "lost">("found");
  const { data: items, isLoading } = useItems({ type: tab });

  return (
    <Layout>
      <section className="section-container">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center space-y-6 mb-12">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              잃어버린 물건을 빠르게 찾으세요
            </h1>
            <p className="text-muted-foreground">
              분실물과 습득물을 한 곳에서 관리합니다. AI 이미지 분석으로 유사한 물건을 추천해 드려요.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" asChild>
                <Link href="/report?type=found">
                  <Plus className="mr-2 h-5 w-5" />
                  습득물 신고하기
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/search">
                  <Search className="mr-2 h-5 w-5" />
                  분실물 검색하기
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-16">
        <div className="container">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">최근 신고 게시물</h2>
              <p className="text-sm text-muted-foreground mt-1">
                카드에서 위치, 날짜, 유형을 바로 확인하세요
              </p>
            </div>

            <Tabs value={tab} onValueChange={(value) => setTab(value as "found" | "lost")}>
              <TabsList>
                <TabsTrigger value="found" className="font-medium">습득물</TabsTrigger>
                <TabsTrigger value="lost" className="font-medium">분실물</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-[340px] rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : !items || items.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-lg border border-dashed">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-muted p-4">
                  <PackageOpen className="h-8 w-8 text-muted-foreground" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">아직 등록된 게시물이 없어요</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                현재 {tab === "found" ? "습득물" : "분실물"} 신고가 없습니다. 
                첫 게시물을 올려서 주변 사람들과 연결해 보세요.
              </p>
              <Button asChild>
                <Link href={`/report?type=${tab}`}>
                  게시물 작성하기
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {items.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}