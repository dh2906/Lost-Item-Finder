import { type FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Filter,
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LocationPicker } from "@/components/location-picker";
import {
  locationFilterScopes,
  locationRadiusOptions,
  type LocationFilterScope,
} from "@shared/routes";

type ItemTab = "found" | "lost";
type ItemDateRange = "all" | "7d" | "30d" | "90d";
type ItemSortOrder = "latest" | "oldest";

type ItemsPageFilters = {
  type: ItemTab;
  category: string;
  color: string;
  dateRange: ItemDateRange;
  sort: ItemSortOrder;
  useLocationFilter: boolean;
  locationScope: LocationFilterScope;
  locationText: string;
  latitude: string;
  longitude: string;
  radiusKm: number;
};

const DEFAULT_FILTERS = {
  category: "",
  color: "",
  dateRange: "all" as const,
  sort: "latest" as const,
  useLocationFilter: false,
  locationScope: "radius" as const,
  locationText: "",
  latitude: "",
  longitude: "",
  radiusKm: 3,
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

const locationScopeOptions: Array<{ value: LocationFilterScope; label: string }> = [
  { value: "radius", label: "반경 기준" },
  { value: "dong", label: "동 단위" },
  { value: "sigungu", label: "시/구 단위" },
  { value: "sido", label: "시/도 단위" },
];

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

function getValidLocationScope(value: string | null): LocationFilterScope {
  return locationScopeOptions.some((option) => option.value === value)
    ? (value as LocationFilterScope)
    : "radius";
}

function getValidRadius(value: string | null): number {
  const radius = Number(value);
  return locationRadiusOptions.includes(radius as (typeof locationRadiusOptions)[number])
    ? radius
    : 3;
}

function getFiltersFromSearch(search: string): ItemsPageFilters {
  const params = new URLSearchParams(search);

  return {
    type: params.get("type") === "lost" ? "lost" : "found",
    category: params.get("category")?.trim() ?? "",
    color: params.get("color")?.trim() ?? "",
    dateRange: getValidDateRange(params.get("dateRange")),
    sort: getValidSortOrder(params.get("sort")),
    useLocationFilter: params.get("useLocationFilter") === "true",
    locationScope: getValidLocationScope(params.get("locationScope")),
    locationText: params.get("locationText")?.trim() ?? "",
    latitude: params.get("latitude")?.trim() ?? "",
    longitude: params.get("longitude")?.trim() ?? "",
    radiusKm: getValidRadius(params.get("radiusKm")),
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

  if (filters.dateRange !== "all") {
    params.set("dateRange", filters.dateRange);
  }

  if (filters.sort !== "latest") {
    params.set("sort", filters.sort);
  }

  if (filters.useLocationFilter) {
    params.set("useLocationFilter", "true");
    params.set("locationScope", filters.locationScope);
    if (filters.locationText) {
      params.set("locationText", filters.locationText);
    }
    if (filters.latitude) {
      params.set("latitude", filters.latitude);
    }
    if (filters.longitude) {
      params.set("longitude", filters.longitude);
    }
    params.set("radiusKm", String(filters.radiusKm));
  }

  return `/items?${params.toString()}`;
}

function getActiveFilterCount(filters: ItemsPageFilters): number {
  return [
    Boolean(filters.category),
    Boolean(filters.color),
    filters.dateRange !== "all",
    filters.sort !== "latest",
    filters.useLocationFilter,
  ].filter(Boolean).length;
}

export default function ItemsPage() {
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState<ItemsPageFilters>(() =>
    getFiltersFromSearch(window.location.search)
  );
  const [draftFilters, setDraftFilters] = useState<ItemsPageFilters>(() =>
    getFiltersFromSearch(window.location.search)
  );

  const { data: items, isLoading } = useItems({
    type: filters.type,
    category: filters.category || undefined,
    color: filters.color || undefined,
    dateRange: filters.dateRange === "all" ? undefined : filters.dateRange,
    sort: filters.sort === "latest" ? undefined : filters.sort,
    useLocationFilter: filters.useLocationFilter || undefined,
    locationScope: filters.useLocationFilter ? filters.locationScope : undefined,
    locationText: filters.useLocationFilter ? filters.locationText || undefined : undefined,
    latitude: filters.useLocationFilter ? filters.latitude || undefined : undefined,
    longitude: filters.useLocationFilter ? filters.longitude || undefined : undefined,
    radiusKm: filters.useLocationFilter ? filters.radiusKm : undefined,
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
      : "카테고리, 색상, 날짜 조건과 선택적 지역 필터로 필요한 제보를 더 빨리 확인해보세요.";
  const emptyLabel = filters.type === "found" ? "습득물" : "분실물";
  const activeFilterCount = getActiveFilterCount(filters);
  const hasActiveFilters = activeFilterCount > 0;

  const applyFilters = (nextFilters: ItemsPageFilters) => {
    const normalizedFilters = {
      ...nextFilters,
      category: nextFilters.category.trim(),
      color: nextFilters.color.trim(),
      locationText: nextFilters.locationText.trim(),
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

  const handleLocationChange = (location: {
    latitude: string;
    longitude: string;
    address?: string;
  }) => {
    setDraftFilters((current) => ({
      ...current,
      latitude: location.latitude,
      longitude: location.longitude,
      locationText: location.address?.trim() || current.locationText,
    }));
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
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  {title}
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">
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

      <section className="pb-16 pt-10">
        <div className="container mx-auto max-w-6xl px-5">
          <div className="space-y-6">
            <form
              onSubmit={handleFilterSubmit}
              className="rounded-[28px] border border-border/70 bg-white/92 p-5 shadow-[0_20px_40px_-32px_rgba(27,31,59,0.2)]"
            >
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Filter className="h-4 w-4 text-primary" />
                      게시글 필터
                    </div>
                    <p className="text-sm text-muted-foreground">
                      카테고리, 색상, 날짜, 정렬 기준으로 목록을 좁혀보세요.
                    </p>
                  </div>
                  {hasActiveFilters ? (
                    <div className="inline-flex items-center self-start rounded-full bg-[hsl(var(--primary-light))] px-3 py-1 text-xs font-semibold text-primary lg:self-auto">
                      적용된 필터 {activeFilterCount}개
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_160px_auto]">
                  <div className="space-y-2">
                    <label htmlFor="category-filter" className="text-sm font-medium text-foreground">
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
                      className="rounded-2xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="color-filter" className="text-sm font-medium text-foreground">
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
                      className="rounded-2xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">날짜</label>
                    <Select
                      value={draftFilters.dateRange}
                      onValueChange={(value) =>
                        setDraftFilters((current) => ({
                          ...current,
                          dateRange: value as ItemDateRange,
                        }))
                      }
                    >
                      <SelectTrigger className="h-11 rounded-2xl">
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
                    <label className="text-sm font-medium text-foreground">정렬</label>
                    <Select
                      value={draftFilters.sort}
                      onValueChange={(value) =>
                        setDraftFilters((current) => ({
                          ...current,
                          sort: value as ItemSortOrder,
                        }))
                      }
                    >
                      <SelectTrigger className="h-11 rounded-2xl">
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

                  <div className="flex items-end gap-2">
                    <Button type="submit" className="h-11 flex-1 rounded-2xl px-4">
                      적용
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleResetFilters}
                      className="h-11 rounded-2xl px-4"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      초기화
                    </Button>
                  </div>
                </div>

                <div className="rounded-[24px] border border-border/70 bg-secondary/35 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <MapPin className="h-4 w-4 text-primary" />
                        지역 기반 검색
                      </div>
                      <p className="text-sm text-muted-foreground">
                        필요할 때만 켜서 내 주변이나 같은 동네 게시물 중심으로 볼 수 있어요.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 rounded-full border border-border/70 bg-white px-4 py-2 shadow-sm">
                      <span className="text-sm font-medium text-foreground">
                        {draftFilters.useLocationFilter ? "사용 중" : "사용 안 함"}
                      </span>
                      <Switch
                        checked={draftFilters.useLocationFilter}
                        onCheckedChange={(checked) =>
                          setDraftFilters((current) => ({
                            ...current,
                            useLocationFilter: checked,
                          }))
                        }
                      />
                    </div>
                  </div>

                  {draftFilters.useLocationFilter ? (
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">범위 기준</label>
                          <Select
                            value={draftFilters.locationScope}
                            onValueChange={(value) =>
                              setDraftFilters((current) => ({
                                ...current,
                                locationScope: value as LocationFilterScope,
                              }))
                            }
                          >
                            <SelectTrigger className="h-11 rounded-2xl bg-white">
                              <SelectValue placeholder="범위 선택" />
                            </SelectTrigger>
                            <SelectContent>
                              {locationScopeOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {draftFilters.locationScope === "radius" ? (
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">반경</label>
                            <Select
                              value={String(draftFilters.radiusKm)}
                              onValueChange={(value) =>
                                setDraftFilters((current) => ({
                                  ...current,
                                  radiusKm: Number(value),
                                }))
                              }
                            >
                              <SelectTrigger className="h-11 rounded-2xl bg-white">
                                <SelectValue placeholder="반경 선택" />
                              </SelectTrigger>
                              <SelectContent>
                                {locationRadiusOptions.map((radius) => (
                                  <SelectItem key={radius} value={String(radius)}>
                                    {radius}km
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">행정구역 범위</label>
                            <div className="flex h-11 items-center rounded-2xl border border-border/70 bg-white px-4 text-sm text-muted-foreground">
                              선택한 위치의 {draftFilters.locationScope === "dong" ? "동" : draftFilters.locationScope === "sigungu" ? "시/구" : "시/도"}를 기준으로 필터링합니다.
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="overflow-hidden rounded-[20px] border border-border/70 bg-white shadow-card">
                        <LocationPicker
                          value={
                            draftFilters.latitude && draftFilters.longitude
                              ? {
                                  latitude: draftFilters.latitude,
                                  longitude: draftFilters.longitude,
                                }
                              : undefined
                          }
                          onChange={handleLocationChange}
                          height="240px"
                        />
                      </div>

                      {draftFilters.locationText ? (
                        <div className="rounded-[16px] border border-primary/12 bg-white/92 px-4 py-3 text-sm text-foreground/80">
                          선택한 위치: {draftFilters.locationText}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
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

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
