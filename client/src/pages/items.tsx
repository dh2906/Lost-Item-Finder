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
  ChevronLeft,
  ChevronRight,
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
type ItemSourceFilter = "all" | "user" | "lost112";
const ITEMS_PAGE_SIZE = 24;

type ItemsPageFilters = {
  type: ItemTab;
  category: string;
  color: string;
  location: string;
  source: ItemSourceFilter;
  latitude?: number;
  longitude?: number;
  radiusKm: number;
  dateRange: ItemDateRange;
  sort: ItemSortOrder;
  page: number;
};

const DEFAULT_FILTERS = {
  category: "",
  color: "",
  location: "",
  source: "all" as const,
  latitude: undefined,
  longitude: undefined,
  radiusKm: 5,
  dateRange: "all" as const,
  sort: "latest" as const,
  page: 1,
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

const sourceOptions: Array<{ value: ItemSourceFilter; label: string }> = [
  { value: "all", label: "전체 출처" },
  { value: "user", label: "사용자 등록" },
  { value: "lost112", label: "경찰청 등록" },
];

const radiusOptions = [0.1, 0.3, 0.5, 1, 3, 5, 10, 20, 50] as const;
const regionOptions = [
  { label: "서울특별시", value: "서울" },
  { label: "부산광역시", value: "부산" },
  { label: "대구광역시", value: "대구" },
  { label: "인천광역시", value: "인천" },
  { label: "광주광역시", value: "광주" },
  { label: "대전광역시", value: "대전" },
  { label: "울산광역시", value: "울산" },
  { label: "세종특별자치시", value: "세종" },
  { label: "경기도", value: "경기" },
  { label: "강원특별자치도", value: "강원" },
  { label: "충청북도", value: "충북" },
  { label: "충청남도", value: "충남" },
  { label: "전북특별자치도", value: "전북" },
  { label: "전라남도", value: "전남" },
  { label: "경상북도", value: "경북" },
  { label: "경상남도", value: "경남" },
  { label: "제주특별자치도", value: "제주" },
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

function getValidSourceFilter(value: string | null): ItemSourceFilter {
  return sourceOptions.some((option) => option.value === value)
    ? (value as ItemSourceFilter)
    : "all";
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

function getValidPage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
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
    source: getValidSourceFilter(params.get("source")),
    latitude: hasCoordinates ? latitude : undefined,
    longitude: hasCoordinates ? longitude : undefined,
    radiusKm: getValidRadiusKm(params.get("radiusKm")),
    dateRange: getValidDateRange(params.get("dateRange")),
    sort: getValidSortOrder(params.get("sort")),
    page: getValidPage(params.get("page")),
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

  if (filters.source !== "all") {
    params.set("source", filters.source);
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

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  return `/items?${params.toString()}`;
}

function getActiveFilterCount(filters: ItemsPageFilters): number {
  return [
    Boolean(filters.category),
    Boolean(filters.color),
    Boolean(filters.location) ||
      (filters.latitude !== undefined && filters.longitude !== undefined),
    filters.source !== "all",
    filters.dateRange !== "all",
    filters.sort !== "latest",
  ].filter(Boolean).length;
}

function getSourceFilterLabel(source: ItemSourceFilter): string | null {
  if (source === "all") {
    return null;
  }

  return sourceOptions.find((option) => option.value === source)?.label ?? null;
}

function getActiveFilterLabels(filters: ItemsPageFilters): string[] {
  return [
    getSourceFilterLabel(filters.source),
    filters.category ? `카테고리: ${filters.category}` : null,
    filters.color ? `색상: ${filters.color}` : null,
    filters.location ? `지역: ${filters.location}` : null,
    filters.latitude !== undefined && filters.longitude !== undefined
      ? `현재 위치 ${formatRadiusLabel(filters.radiusKm)} 이내`
      : null,
    filters.dateRange !== "all"
      ? dateRangeOptions.find((option) => option.value === filters.dateRange)?.label
      : null,
    filters.sort !== "latest"
      ? sortOptions.find((option) => option.value === filters.sort)?.label
      : null,
  ].filter((label): label is string => Boolean(label));
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
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [pageInputValue, setPageInputValue] = useState(String(filters.page));
  const [isLocating, setIsLocating] = useState(false);
  const hasDraftCoordinates =
    draftFilters.latitude !== undefined && draftFilters.longitude !== undefined;

  const { data: itemsResult, isLoading, isFetching } = useItems({
    type: filters.type,
    category: filters.category || undefined,
    color: filters.color || undefined,
    location: filters.location || undefined,
    source: filters.source === "all" ? undefined : filters.source,
    latitude: filters.latitude,
    longitude: filters.longitude,
    radiusKm:
      filters.latitude !== undefined && filters.longitude !== undefined
        ? filters.radiusKm
        : undefined,
    dateRange: filters.dateRange === "all" ? undefined : filters.dateRange,
    sort: filters.sort === "latest" ? undefined : filters.sort,
    page: filters.page,
    limit: ITEMS_PAGE_SIZE,
  });
  const items = itemsResult?.items ?? [];
  const totalCount = itemsResult?.totalCount ?? 0;
  const totalPages = itemsResult?.totalPages ?? 1;
  const currentPage = itemsResult?.page ?? filters.page;

  useEffect(() => {
    setPageInputValue(String(currentPage));
  }, [currentPage]);

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
    filters.type === "found" ? "습득물 탐색" : "분실물 제보 탐색";
  const description =
    filters.type === "found"
      ? "경찰청 수집 데이터와 사용자 등록 습득물을 출처, 지역, 기간으로 좁혀 직접 확인하는 보조 탐색 화면입니다."
      : "사용자가 등록한 분실물을 지역과 특징으로 좁혀 필요한 제보 대상을 확인하세요.";
  const resultTitle = filters.type === "found" ? "습득물 탐색 결과" : "분실물 탐색 결과";
  const emptyLabel = filters.type === "found" ? "습득물" : "분실물";
  const activeFilterCount = getActiveFilterCount(filters);
  const hasActiveFilters = activeFilterCount > 0;
  const activeFilterLabels = getActiveFilterLabels(filters);

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
      page: 1,
    });
  };

  const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applyFilters({
      ...draftFilters,
      type: filters.type,
      page: 1,
    });
  };

  const handleResetFilters = () => {
    applyFilters({
      type: filters.type,
      ...DEFAULT_FILTERS,
    });
  };

  const handlePageChange = (page: number) => {
    const nextPage = Math.min(Math.max(1, page), totalPages);
    if (nextPage === currentPage) {
      setPageInputValue(String(currentPage));
      return;
    }

    applyFilters({
      ...filters,
      page: nextPage,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePageJumpSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const page = Number(pageInputValue);

    if (!Number.isInteger(page)) {
      setPageInputValue(String(currentPage));
      return;
    }

    handlePageChange(page);
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
              {filters.type === "found" ? "경찰청 + 사용자 습득물" : "사용자 분실물"}
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
                    {filters.type === "found" ? "주운 물건 등록" : "잃어버린 물건 등록"}
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
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Filter className="h-4 w-4 text-primary" />
                      탐색 조건
                    </div>
                    <p className="text-sm text-muted-foreground">
                      출처, 지역, 물건 특징을 기준으로 확인할 대상을 좁혀보세요.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start lg:self-auto">
                    {hasActiveFilters ? (
                      <div className="inline-flex items-center rounded-full bg-[hsl(var(--primary-light))] px-3 py-1 text-xs font-semibold text-primary">
                        적용된 필터 {activeFilterCount}개
                      </div>
                    ) : null}
                    <button
                      type="button"
                      aria-expanded={isFilterOpen}
                      aria-controls="items-filter-fields"
                      onClick={() => setIsFilterOpen((current) => !current)}
                      className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-full border border-input bg-white/92 px-3.5 text-sm font-medium text-foreground shadow-sm transition-all hover:border-primary/20 hover:bg-accent md:hidden"
                    >
                      필터
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          isFilterOpen ? "rotate-180" : ""
                        )}
                      />
                    </button>
                  </div>
                </div>

                <div
                  id="items-filter-fields"
                  className={cn(
                    "filter-fields gap-3 md:grid-cols-2 xl:grid-cols-4",
                    isFilterOpen ? "grid" : "hidden md:grid"
                  )}
                >
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">출처</label>
                    <Select
                      value={draftFilters.source}
                      onValueChange={(value) =>
                        setDraftFilters((current) => ({
                          ...current,
                          source: value as ItemSourceFilter,
                        }))
                      }
                    >
                      <SelectTrigger className="h-10 rounded-xl">
                        <SelectValue placeholder="출처 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

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
                      placeholder="예: 강남구, 마곡나루역, 정부청사"
                      className="h-10 rounded-xl"
                    />
                    <Select
                      value={
                        regionOptions.some((option) => option.value === draftFilters.location)
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
                        <SelectValue placeholder="시/도 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {regionOptions.map((region) => (
                          <SelectItem key={region.value} value={region.value}>
                            {region.label}
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
            ) : items.length === 0 ? (
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
                    : filters.type === "found"
                    ? "주운 물건을 등록하면 다른 사람의 분실물과 매칭될 수 있어요."
                    : "잃어버린 물건을 등록하면 습득물 후보와 자동으로 비교할 수 있어요."}
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
                      {filters.type === "found" ? "주운 물건 등록하기" : "잃어버린 물건 등록하기"}
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {activeFilterLabels.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-[20px] border border-primary/10 bg-[hsl(var(--primary-light))]/55 px-4 py-3">
                    <span className="text-xs font-semibold text-primary">적용 조건</span>
                    {activeFilterLabels.map((label) => (
                      <span
                        key={label}
                        className="inline-flex items-center rounded-full border border-primary/15 bg-white/90 px-3 py-1 text-xs font-semibold text-foreground shadow-sm"
                      >
                        {label}
                      </span>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleResetFilters}
                      className="h-8 rounded-full px-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      초기화
                    </Button>
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="flex items-center gap-3 text-2xl font-bold text-foreground">
                    {resultTitle}
                    <span className="inline-flex items-center justify-center rounded-full bg-accent px-3 py-0.5 text-sm font-bold text-primary">
                      {totalCount.toLocaleString()}건
                    </span>
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-border/70 bg-white px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
                      {currentPage}/{totalPages}페이지
                    </span>
                    {isFetching ? (
                      <span className="inline-flex items-center rounded-full border border-primary/15 bg-[hsl(var(--primary-light))] px-3 py-1 text-xs font-semibold text-primary">
                        새 목록 불러오는 중
                      </span>
                    ) : null}
                    {hasActiveFilters ? (
                      <span className="inline-flex items-center rounded-full border border-primary/15 bg-[hsl(var(--primary-light))] px-3 py-1 text-xs font-semibold text-primary">
                        필터 적용 중
                      </span>
                    ) : null}
                    {filters.type === "found" ? (
                      <Button asChild variant="outline" className="rounded-full px-4">
                        <Link href="/search">
                          <SearchIcon className="mr-2 h-4 w-4" />
                          사진/설명으로 찾기
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {items.map((item, index) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      imageLoading={index < 4 ? "eager" : "lazy"}
                    />
                  ))}
                </div>

                {totalPages > 1 ? (
                  <div className="flex flex-col items-center gap-3 border-t border-border/60 pt-5 sm:flex-row sm:justify-between">
                    <p className="text-sm font-medium text-muted-foreground">
                      한 페이지에 {ITEMS_PAGE_SIZE}개씩 표시합니다.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handlePageChange(1)}
                        disabled={currentPage <= 1 || isFetching}
                        className="h-10 rounded-full px-4"
                      >
                        처음
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage <= 1 || isFetching}
                        className="h-10 rounded-full px-4"
                      >
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        이전
                      </Button>
                      <span className="min-w-20 text-center text-sm font-semibold text-foreground">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages || isFetching}
                        className="h-10 rounded-full px-4"
                      >
                        다음
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handlePageChange(totalPages)}
                        disabled={currentPage >= totalPages || isFetching}
                        className="h-10 rounded-full px-4"
                      >
                        끝
                      </Button>
                      <form
                        onSubmit={handlePageJumpSubmit}
                        className="flex items-center gap-2 rounded-full border border-border/70 bg-white p-1 shadow-sm"
                      >
                        <Input
                          type="number"
                          min={1}
                          max={totalPages}
                          value={pageInputValue}
                          onChange={(event) => setPageInputValue(event.target.value)}
                          className="h-8 w-16 rounded-full border-0 px-3 text-center text-sm font-semibold shadow-none [appearance:textfield] focus-visible:ring-1 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          aria-label="이동할 페이지"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isFetching}
                          className="h-8 rounded-full px-3"
                        >
                          이동
                        </Button>
                      </form>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
