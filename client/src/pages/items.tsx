import { type FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ChevronDown,
  Filter,
  LocateFixed,
  MapPin,
  PackageOpen,
  PlusCircle,
  RotateCcw,
  Search as SearchIcon,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemCard } from "@/components/item-card";
import { useItems } from "@/hooks/use-items";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ItemTab = "found" | "lost";
type ItemDateRange = "all" | "7d" | "30d" | "90d";
type ItemSortOrder = "latest" | "oldest";

type ItemsPageFilters = {
  type: ItemTab;
  category: string;
  color: string;
  location: string;
  latitude?: number;
  longitude?: number;
  radiusKm: number;
  dateRange: ItemDateRange;
  sort: ItemSortOrder;
};

const DEFAULT_FILTERS = {
  category: "",
  color: "",
  location: "",
  latitude: undefined,
  longitude: undefined,
  radiusKm: 5,
  dateRange: "all" as const,
  sort: "latest" as const,
};

const dateRangeOptions: Array<{ value: ItemDateRange; label: string }> = [
  { value: "all", label: "전체 기간" },
  { value: "7d", label: "최근 7일" },
  { value: "30d", label: "최근 30일" },
  { value: "90d", label: "최근 90일" },
];

const sortOptions: Array<{ value: ItemSortOrder; label: string }> = [
  { value: "latest", label: "최신순" },
  { value: "oldest", label: "오래된순" },
];

const radiusOptions = [0.1, 0.3, 0.5, 1, 3, 5, 10, 20, 50] as const;
const regionPresetOptions = [
  "서울특별시",
  "서울특별시 강남구",
  "서울특별시 동대문구",
  "경기도",
  "충청남도",
  "충청남도 아산시",
  "충청남도 천안시 동남구",
  "경상북도",
] as const;

function formatRadiusLabel(radiusKm: number): string {
  return radiusKm < 1 ? `${Math.round(radiusKm * 1000)}m` : `${radiusKm}km`;
}

function getValidDateRange(value: string | null): ItemDateRange {
  return dateRangeOptions.some((option) => option.value === value)
    ? (value as ItemDateRange)
    : "all";
}

function getValidSortOrder(value: string | null): ItemSortOrder {
  return sortOptions.some((option) => option.value === value)
    ? (value as ItemSortOrder)
    : "latest";
}

function getValidCoordinate(value: string | null, min: number, max: number): number | undefined {
  if (!value) {
    return undefined;
  }

  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max
    ? coordinate
    : undefined;
}

function getValidRadiusKm(value: string | null): number {
  if (!value) {
    return DEFAULT_FILTERS.radiusKm;
  }

  const radiusKm = Number(value);
  return radiusOptions.some((option) => option === radiusKm)
    ? radiusKm
    : DEFAULT_FILTERS.radiusKm;
}

function getFiltersFromSearch(search: string): ItemsPageFilters {
  const params = new URLSearchParams(search);
  const latitude = getValidCoordinate(params.get("latitude"), -90, 90);
  const longitude = getValidCoordinate(params.get("longitude"), -180, 180);
  const hasCoordinates = latitude !== undefined && longitude !== undefined;

  return {
    type: params.get("type") === "lost" ? "lost" : "found",
    category: params.get("category")?.trim() ?? "",
    color: params.get("color")?.trim() ?? "",
    location: params.get("location")?.trim() ?? "",
    latitude: hasCoordinates ? latitude : undefined,
    longitude: hasCoordinates ? longitude : undefined,
    radiusKm: getValidRadiusKm(params.get("radiusKm")),
    dateRange: getValidDateRange(params.get("dateRange")),
    sort: getValidSortOrder(params.get("sort")),
  };
}

function buildItemsUrl(filters: ItemsPageFilters): string {
  const params = new URLSearchParams();
  params.set("type", filters.type);

  if (filters.category) {
    params.set("category", filters.category);
  }

  if (filters.color) {
    params.set("color", filters.color);
  }

  if (filters.location) {
    params.set("location", filters.location);
  }

  if (filters.latitude !== undefined && filters.longitude !== undefined) {
    params.set("latitude", String(filters.latitude));
    params.set("longitude", String(filters.longitude));

    if (filters.radiusKm !== DEFAULT_FILTERS.radiusKm) {
      params.set("radiusKm", String(filters.radiusKm));
    }
  }

  if (filters.dateRange !== "all") {
    params.set("dateRange", filters.dateRange);
  }

  if (filters.sort !== "latest") {
    params.set("sort", filters.sort);
  }

  return `/items?${params.toString()}`;
}

function getActiveFilterCount(filters: ItemsPageFilters): number {
  return [
    Boolean(filters.category),
    Boolean(filters.color),
    Boolean(filters.location) ||
      (filters.latitude !== undefined && filters.longitude !== undefined),
    filters.dateRange !== "all",
    filters.sort !== "latest",
  ].filter(Boolean).length;
}

export default function ItemsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [filters, setFilters] = useState<ItemsPageFilters>(() =>
    getFiltersFromSearch(window.location.search)
  );
  const [draftFilters, setDraftFilters] = useState<ItemsPageFilters>(() =>
    getFiltersFromSearch(window.location.search)
  );
  const [isLocating, setIsLocating] = useState(false);
  const hasDraftCoordinates =
    draftFilters.latitude !== undefined && draftFilters.longitude !== undefined;

  const { data: items, isLoading } = useItems({
    type: filters.type,
    category: filters.category || undefined,
    color: filters.color || undefined,
    location: filters.location || undefined,
    latitude: filters.latitude,
    longitude: filters.longitude,
    radiusKm:
      filters.latitude !== undefined && filters.longitude !== undefined
        ? filters.radiusKm
        : undefined,
    dateRange: filters.dateRange === "all" ? undefined : filters.dateRange,
    sort: filters.sort === "latest" ? undefined : filters.sort,
  });

  useEffect(() => {
    const syncFiltersFromUrl = () => {
      const nextFilters = getFiltersFromSearch(window.location.search);
      setFilters(nextFilters);
      setDraftFilters(nextFilters);
    };

    syncFiltersFromUrl();
    window.addEventListener("popstate", syncFiltersFromUrl);

    return () => {
      window.removeEventListener("popstate", syncFiltersFromUrl);
    };
  }, []);

  const title =
    filters.type === "found" ? "등록된 습득물 전체보기" : "등록된 분실물 전체보기";
  const description =
    filters.type === "found"
      ? "카테고리, 색상, 날짜 조건으로 습득물 게시물을 빠르게 좁혀서 비슷한 물건을 찾아보세요."
      : "카테고리, 색상, 날짜 조건으로 분실물 게시물을 좁혀서 필요한 제보를 더 빨리 확인해보세요.";
  const emptyLabel = filters.type === "found" ? "습득물" : "분실물";
  const activeFilterCount = getActiveFilterCount(filters);
  const hasActiveFilters = activeFilterCount > 0;

  const applyFilters = (nextFilters: ItemsPageFilters) => {
    const normalizedFilters = {
      ...nextFilters,
      category: nextFilters.category.trim(),
      color: nextFilters.color.trim(),
      location: nextFilters.location.trim(),
    };

    setFilters(normalizedFilters);
    setDraftFilters(normalizedFilters);
    void setLocation(buildItemsUrl(normalizedFilters));
  };

  const handleTabChange = (value: string) => {
    const nextType = value === "lost" ? "lost" : "found";
    applyFilters({
      ...filters,
      type: nextType,
    });
  };

  const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applyFilters({
      ...draftFilters,
      type: filters.type,
    });
  };

  const handleResetFilters = () => {
    applyFilters({
      type: filters.type,
      ...DEFAULT_FILTERS,
    });
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        variant: "destructive",
        title: "현재 위치를 사용할 수 없습니다",
        description: "브라우저에서 위치 기능을 지원하지 않습니다.",
      });
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDraftFilters((current) => ({
          ...current,
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          radiusKm: current.radiusKm || DEFAULT_FILTERS.radiusKm,
        }));
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
        toast({
          variant: "destructive",
          title: "위치 확인 실패",
          description: "브라우저 위치 권한을 확인한 뒤 다시 시도해 주세요.",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleClearCoordinates = () => {
    setDraftFilters((current) => ({
      ...current,
      latitude: undefined,
      longitude: undefined,
      radiusKm: DEFAULT_FILTERS.radiusKm,
    }));
  };

  return (
    <Layout>
      <section className="border-b border-border/70 bg-[linear-gradient(180deg,hsl(var(--primary-light))_0%,transparent_100%)] pb-7 pt-9 md:pb-8 md:pt-11">
        <div className="container mx-auto max-w-6xl px-5">
          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full border border-primary/12 bg-white/88 px-3 py-1 text-sm font-semibold text-primary shadow-sm">
              실시간 등록 게시물
            </div>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                  {title}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                  {description}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Tabs value={filters.type} onValueChange={handleTabChange}>
                  <TabsList className="h-11 rounded-full border border-border/70 bg-white/90 p-1 shadow-sm">
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
                  variant="outline"
                  className="rounded-full border-border/70 bg-white/92 px-4 shadow-sm"
                >
                  <Link href={filters.type === "found" ? "/report/found" : "/report/lost"}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {filters.type === "found" ? "습득물 등록" : "분실물 신고"}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-16 pt-6 md:pt-8">
        <div className="container mx-auto max-w-6xl px-5">
          <div className="space-y-6">
            <form
              onSubmit={handleFilterSubmit}
              className="rounded-[22px] border border-border/70 bg-white/92 p-4 shadow-[0_16px_34px_-30px_rgba(27,31,59,0.18)] md:p-5"
            >
              <div className="flex flex-col gap-4">
                <input id="items-filter-toggle" type="checkbox" className="peer sr-only" />
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Filter className="h-4 w-4 text-primary" />
                      게시글 필터
                    </div>
                    <p className="text-sm text-muted-foreground">
                      필요한 조건만 빠르게 적용하세요.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start lg:self-auto">
                    {hasActiveFilters ? (
                      <div className="inline-flex items-center rounded-full bg-[hsl(var(--primary-light))] px-3 py-1 text-xs font-semibold text-primary">
                        적용된 필터 {activeFilterCount}개
                      </div>
                    ) : null}
                    <label
                      htmlFor="items-filter-toggle"
                      className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-full border border-input bg-white/92 px-3.5 text-sm font-medium text-foreground shadow-sm transition-all hover:border-primary/20 hover:bg-accent md:hidden"
                    >
                      필터
                      <ChevronDown className="h-4 w-4" />
                    </label>
                  </div>
                </div>

                <div
                  className={cn(
                    "filter-fields hidden gap-3 peer-checked:grid md:grid md:grid-cols-2 xl:grid-cols-4"
                  )}
                >
                  <div className="space-y-2">
                    <label htmlFor="category-filter" className="text-xs font-semibold text-foreground">
                      카테고리
                    </label>
                    <Input
                      id="category-filter"
                      value={draftFilters.category}
                      onChange={(event) =>
                        setDraftFilters((current) => ({
                          ...current,
                          category: event.target.value,
                        }))
                      }
                      placeholder="예: 지갑"
                      className="h-10 rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="color-filter" className="text-xs font-semibold text-foreground">
                      색상
                    </label>
                    <Input
                      id="color-filter"
                      value={draftFilters.color}
                      onChange={(event) =>
                        setDraftFilters((current) => ({
                          ...current,
                          color: event.target.value,
                        }))
                      }
                      placeholder="예: 검정"
                      className="h-10 rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="location-filter" className="text-xs font-semibold text-foreground">
                      지역
                    </label>
                    <Input
                      id="location-filter"
                      value={draftFilters.location}
                      onChange={(event) =>
                        setDraftFilters((current) => ({
                          ...current,
                          location: event.target.value,
                        }))
                      }
                      placeholder="예: 강남역, 서대문구"
                      className="h-10 rounded-xl"
                    />
                    <Select
                      value={
                        regionPresetOptions.some((option) => option === draftFilters.location)
                          ? draftFilters.location
                          : undefined
                      }
                      onValueChange={(value) =>
                        setDraftFilters((current) => ({
                          ...current,
                          location: value,
                        }))
                      }
                    >
                      <SelectTrigger className="h-10 rounded-xl">
                        <SelectValue placeholder="빠른 지역 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {regionPresetOptions.map((region) => (
                          <SelectItem key={region} value={region}>
                            {region}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">반경</label>
                    <Select
                      value={String(draftFilters.radiusKm)}
                      onValueChange={(value) =>
                        setDraftFilters((current) => ({
                          ...current,
                          radiusKm: Number(value),
                        }))
                      }
                      disabled={!hasDraftCoordinates}
                    >
                      <SelectTrigger className="h-10 rounded-xl">
                        <SelectValue placeholder="반경 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {radiusOptions.map((radiusKm) => (
                          <SelectItem key={radiusKm} value={String(radiusKm)}>
                            {formatRadiusLabel(radiusKm)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">현재 위치</label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleUseCurrentLocation}
                        disabled={isLocating}
                        className="h-10 flex-1 rounded-xl px-4"
                      >
                        <LocateFixed
                          className={`mr-2 h-4 w-4 ${isLocating ? "animate-pulse" : ""}`}
                        />
                        {hasDraftCoordinates ? "위치 변경" : "위치 사용"}
                      </Button>
                      {hasDraftCoordinates ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={handleClearCoordinates}
                          className="h-10 w-10 rounded-xl border border-border/70"
                          aria-label="현재 위치 기준 해제"
                        >
                          <MapPin className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">날짜</label>
                    <Select
                      value={draftFilters.dateRange}
                      onValueChange={(value) =>
                        setDraftFilters((current) => ({
                          ...current,
                          dateRange: value as ItemDateRange,
                        }))
                      }
                    >
                      <SelectTrigger className="h-10 rounded-xl">
                        <SelectValue placeholder="기간 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {dateRangeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">정렬</label>
                    <Select
                      value={draftFilters.sort}
                      onValueChange={(value) =>
                        setDraftFilters((current) => ({
                          ...current,
                          sort: value as ItemSortOrder,
                        }))
                      }
                    >
                      <SelectTrigger className="h-10 rounded-xl">
                        <SelectValue placeholder="정렬 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {sortOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end gap-2 xl:col-span-2">
                    <Button type="submit" className="h-10 flex-1 rounded-xl px-4">
                      적용
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleResetFilters}
                      className="h-10 rounded-xl px-4"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      초기화
                    </Button>
                  </div>
                </div>
              </div>
            </form>

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
                <h3 className="mb-2 text-lg font-bold text-foreground">
                  {hasActiveFilters
                    ? `조건에 맞는 ${emptyLabel}이 없어요`
                    : `등록된 ${emptyLabel}이 없어요`}
                </h3>
                <p className="mb-8 max-w-sm text-center leading-relaxed text-muted-foreground">
                  {hasActiveFilters
                    ? "카테고리, 색상, 날짜 조건을 바꿔서 다시 확인해보세요."
                    : "첫 게시물을 등록해서 더 빠르게 연결을 시작해보세요."}
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {hasActiveFilters ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleResetFilters}
                      className="h-11 rounded-full px-6 font-medium"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      필터 초기화
                    </Button>
                  ) : null}
                  <Button asChild className="h-11 rounded-full px-6 font-medium">
                    <Link href={filters.type === "found" ? "/report/found" : "/report/lost"}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      {filters.type === "found" ? "습득물 등록하기" : "분실물 신고하기"}
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="flex items-center gap-3 text-2xl font-bold text-foreground">
                    전체 게시물
                    <span className="inline-flex items-center justify-center rounded-full bg-accent px-3 py-0.5 text-sm font-bold text-primary">
                      {items.length}건
                    </span>
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    {hasActiveFilters ? (
                      <span className="inline-flex items-center rounded-full border border-primary/15 bg-[hsl(var(--primary-light))] px-3 py-1 text-xs font-semibold text-primary">
                        필터 적용 중
                      </span>
                    ) : null}
                    {filters.type === "found" ? (
                      <Button asChild variant="outline" className="rounded-full px-4">
                        <Link href="/search">
                          <SearchIcon className="mr-2 h-4 w-4" />
                          AI로 찾기
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {items.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
