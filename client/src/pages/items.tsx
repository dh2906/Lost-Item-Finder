import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { PackageOpen, PlusCircle, Search as SearchIcon, SlidersHorizontal, X } from "lucide-react";
import { Layout } from "@/components/layout";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ItemCard } from "@/components/item-card";
import { useItems } from "@/hooks/use-items";

const CATEGORY_OPTIONS = [
  "전체",
  "지갑",
  "휴대폰",
  "열쇠",
  "가방",
  "카드",
  "이어폰",
  "안경",
  "우산",
  "의류",
  "기타",
];

type SortOption = "latest" | "oldest";

function getTabFromSearch(search: string): "found" | "lost" {
  const params = new URLSearchParams(search);
  return params.get("type") === "lost" ? "lost" : "found";
}

export default function ItemsPage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"found" | "lost">(() =>
    getTabFromSearch(window.location.search)
  );
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [sortOption, setSortOption] = useState<SortOption>("latest");
  const [showFilters, setShowFilters] = useState(false);

  const { data: items, isLoading } = useItems({ type: tab });

  useEffect(() => {
    const syncTabFromUrl = () => {
      setTab(getTabFromSearch(window.location.search));
    };
    syncTabFromUrl();
    window.addEventListener("popstate", syncTabFromUrl);
    return () => window.removeEventListener("popstate", syncTabFromUrl);
  }, []);

  const handleTabChange = (value: string) => {
    const nextTab = value === "lost" ? "lost" : "found";
    setTab(nextTab);
    void setLocation(`/items?type=${nextTab}`);
  };

  const filteredItems = (items ?? []).filter((item) => {
    const matchesSearch =
      searchText === "" ||
      item.title.toLowerCase().includes(searchText.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchText.toLowerCase());

    const matchesCategory =
      selectedCategory === "전체" ||
      item.itemCategory?.includes(selectedCategory);

    return matchesSearch && matchesCategory;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    const da = new Date(a.date ?? 0).getTime();
    const db = new Date(b.date ?? 0).getTime();
    return sortOption === "latest" ? db - da : da - db;
  });

  const activeFilterCount =
    (selectedCategory !== "전체" ? 1 : 0) +
    (sortOption !== "latest" ? 1 : 0);

  const title = tab === "found" ? "등록된 습득물 전체보기" : "등록된 분실물 전체보기";
  const description =
    tab === "found"
      ? "지금까지 올라온 습득물 게시물을 한 번에 살펴보세요."
      : "지금까지 올라온 분실물 게시물을 한 번에 살펴보세요.";

  return (
    <Layout>
      {/* Hero */}
      <section className="border-b border-border/70 bg-[linear-gradient(180deg,hsl(var(--primary)/0.06)_0%,transparent_100%)] pb-8 pt-12">
        <div className="container mx-auto max-w-6xl px-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-white/80 px-3 py-1 text-sm font-semibold text-primary shadow-sm">
                실시간 등록 게시물
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
              <p className="max-w-2xl text-base text-muted-foreground">{description}</p>
            </div>

            <div className="flex items-center gap-3">
              <Tabs value={tab} onValueChange={handleTabChange}>
                <TabsList className="h-10 rounded-full border border-border/70 bg-white/90 p-1 shadow-sm">
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

              <Button
                asChild
                size="sm"
                className="h-10 rounded-full shadow-sm"
              >
                <Link href={`/report/${tab === "found" ? "found" : "lost"}`}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {tab === "found" ? "습득물 신고" : "분실물 신고"}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Search & Filter bar */}
      <section className="border-b border-border/50 bg-white/60 py-3">
        <div className="container mx-auto max-w-6xl px-5">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 rounded-full border-border/60 bg-white pl-9 text-sm shadow-sm focus-visible:ring-1"
                placeholder="제목, 설명으로 검색..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              {searchText && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchText("")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-full border-border/60 bg-white gap-2 shadow-sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              필터
              {activeFilterCount > 0 && (
                <Badge className="ml-1 h-5 w-5 rounded-full p-0 text-[11px] flex items-center justify-center">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">카테고리</span>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_OPTIONS.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        selectedCategory === cat
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/60 bg-white text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm text-muted-foreground">정렬</span>
                <Select
                  value={sortOption}
                  onValueChange={(v) => setSortOption(v as SortOption)}
                >
                  <SelectTrigger className="h-8 w-28 rounded-full border-border/60 bg-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latest">최신순</SelectItem>
                    <SelectItem value="oldest">오래된순</SelectItem>
                  </SelectContent>
                </Select>

                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground"
                    onClick={() => {
                      setSelectedCategory("전체");
                      setSortOption("latest");
                    }}
                  >
                    <X className="mr-1 h-3 w-3" />
                    초기화
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Content */}
      <section className="py-10">
        <div className="container mx-auto max-w-6xl px-5">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-[340px] rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : sortedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
              <div className="mb-4 rounded-full bg-muted p-5">
                <PackageOpen className="h-9 w-9 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">
                {searchText || selectedCategory !== "전체"
                  ? "검색 결과가 없어요"
                  : "아직 등록된 게시물이 없어요"}
              </h3>
              <p className="mb-6 max-w-md text-muted-foreground">
                {searchText || selectedCategory !== "전체"
                  ? "다른 검색어나 카테고리를 시도해보세요."
                  : "첫 게시물을 등록해서 주변 사람들과 연결해보세요."}
              </p>
              <Button asChild>
                <Link href={`/report?type=${tab}`}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  게시물 작성하기
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <p className="mb-5 text-sm text-muted-foreground">
                총 {sortedItems.length}개 게시물
                {selectedCategory !== "전체" && (
                  <span className="ml-1 font-medium text-primary">· {selectedCategory}</span>
                )}
              </p>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {sortedItems.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </Layout>
  );
}
