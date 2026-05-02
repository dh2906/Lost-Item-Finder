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
  search: string;
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
  search: "",
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
const administrativeRegionOptions = [
  {
    label: "서울특별시",
    value: "서울특별시",
    districts: [
      { label: "강서구", value: "서울 강서구", dongs: ["마곡동", "등촌동", "화곡동", "공항동", "방화동"] },
      { label: "금천구", value: "서울 금천구", dongs: ["가산동", "독산동", "시흥동"] },
      { label: "서초구", value: "서울 서초구", dongs: ["서초동", "양재동", "반포동", "방배동"] },
      { label: "마포구", value: "서울 마포구", dongs: ["상암동", "서교동", "합정동", "공덕동"] },
      { label: "종로구", value: "서울 종로구", dongs: ["종로1가", "관철동", "익선동", "혜화동"] },
      { label: "양천구", value: "서울 양천구", dongs: ["목동", "신정동", "신월동"] },
    ],
  },
  {
    label: "경기도",
    value: "경기도",
    districts: [
      { label: "파주시", value: "경기 파주시", dongs: ["와동동", "운정동", "금촌동", "문산읍"] },
      { label: "화성시", value: "경기 화성시", dongs: ["동탄동", "봉담읍", "향남읍", "남양읍"] },
      { label: "용인시", value: "경기 용인시", dongs: ["처인구", "기흥구", "수지구"] },
      { label: "부천시", value: "경기 부천시", dongs: ["원미구", "오정구", "소사구"] },
      { label: "고양시", value: "경기 고양시", dongs: ["일산동구", "일산서구", "덕양구"] },
      { label: "남양주시", value: "경기 남양주시", dongs: ["화도읍", "다산동", "별내동"] },
    ],
  },
  {
    label: "부산광역시",
    value: "부산광역시",
    districts: [
      { label: "해운대구", value: "부산 해운대구", dongs: ["좌동", "우동", "중동", "반여동"] },
      { label: "기장군", value: "부산 기장군", dongs: ["기장읍", "정관읍", "일광읍"] },
      { label: "강서구", value: "부산 강서구", dongs: ["명지동", "녹산동", "대저동"] },
      { label: "사상구", value: "부산 사상구", dongs: ["괘법동", "감전동", "덕포동"] },
    ],
  },
  {
    label: "인천광역시",
    value: "인천광역시",
    districts: [
      { label: "서구", value: "인천 서구", dongs: ["청라동", "가정동", "검암동"] },
      { label: "미추홀구", value: "인천 미추홀구", dongs: ["주안동", "용현동", "학익동"] },
    ],
  },
  {
    label: "대구광역시",
    value: "대구광역시",
    districts: [
      { label: "달성군", value: "대구 달성군", dongs: ["구지면", "화원읍", "다사읍"] },
      { label: "수성구", value: "대구 수성구", dongs: ["범어동", "만촌동", "수성동"] },
      { label: "중구", value: "대구 중구", dongs: ["동인동", "삼덕동", "태평로"] },
    ],
  },
  {
    label: "광주광역시",
    value: "광주광역시",
    districts: [
      { label: "동구", value: "광주 동구", dongs: ["충장동", "금남로", "서석동"] },
      { label: "서구", value: "광주 서구", dongs: ["상무동", "화정동", "농성동"] },
      { label: "광산구", value: "광주 광산구", dongs: ["수완동", "첨단동", "우산동"] },
    ],
  },
  {
    label: "울산광역시",
    value: "울산광역시",
    districts: [
      { label: "남구", value: "울산 남구", dongs: ["삼산동", "달동", "무거동"] },
      { label: "중구", value: "울산 중구", dongs: ["성남동", "학성동", "태화동"] },
    ],
  },
  {
    label: "세종특별자치시",
    value: "세종특별자치시",
    districts: [
      { label: "세종시", value: "세종", dongs: ["어진동", "나성동", "도담동", "조치원읍"] },
    ],
  },
  {
    label: "강원특별자치도",
    value: "강원특별자치도",
    districts: [
      { label: "원주시", value: "강원 원주시", dongs: ["중앙동", "단계동", "무실동"] },
      { label: "춘천시", value: "강원 춘천시", dongs: ["퇴계동", "석사동", "소양동"] },
    ],
  },
  {
    label: "충청남도",
    value: "충청남도",
    districts: [
      { label: "홍성군", value: "충남 홍성군", dongs: ["홍성읍", "광천읍", "홍북읍"] },
      { label: "천안시", value: "충남 천안시", dongs: ["동남구", "서북구", "불당동"] },
    ],
  },
  {
    label: "전북특별자치도",
    value: "전북특별자치도",
    districts: [
      { label: "익산시", value: "전북 익산시", dongs: ["영등동", "어양동", "신동"] },
      { label: "완주군", value: "전북 완주군", dongs: ["봉동읍", "삼례읍", "이서면"] },
    ],
  },
  {
    label: "전라남도",
    value: "전라남도",
    districts: [
      { label: "목포시", value: "전남 목포시", dongs: ["상동", "하당동", "용해동"] },
    ],
  },
  {
    label: "경상북도",
    value: "경상북도",
    districts: [
      { label: "영주시", value: "경북 영주시", dongs: ["가흥동", "휴천동", "영주동"] },
      { label: "안동시", value: "경북 안동시", dongs: ["옥동", "송현동", "중구동"] },
      { label: "경산시", value: "경북 경산시", dongs: ["중방동", "하양읍", "진량읍"] },
    ],
  },
  {
    label: "경상남도",
    value: "경상남도",
    districts: [
      { label: "창원시", value: "경남 창원시", dongs: ["의창구", "성산구", "마산합포구"] },
    ],
  },
  {
    label: "제주특별자치도",
    value: "제주특별자치도",
    districts: [
      { label: "제주시", value: "제주 제주시", dongs: ["애월읍", "노형동", "이도동"] },
      { label: "서귀포시", value: "제주 서귀포시", dongs: ["중문동", "대정읍", "성산읍"] },
    ],
  },
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
  const location = params.get("location")?.trim() ?? "";

  return {
    type: params.get("type") === "lost" ? "lost" : "found",
    search: params.get("search")?.trim() ?? "",
    category: params.get("category")?.trim() ?? "",
    color: params.get("color")?.trim() ?? "",
    location: hasCoordinates ? "" : location,
    source: getValidSourceFilter(params.get("source")),
    latitude: hasCoordinates ? latitude : undefined,
    longitude: hasCoordinates ? longitude : undefined,
    radiusKm: getValidRadiusKm(params.get("radiusKm")),
    dateRange: getValidDateRange(params.get("dateRange")),
    sort: getValidSortOrder(params.get("sort")),
    page: getValidPage(params.get("page")),
  };
}

function findRegionByValue(value: string) {
  return administrativeRegionOptions.find((region) => region.value === value);
}

function findDistrictByValue(regionValue: string, districtValue: string) {
  return findRegionByValue(regionValue)?.districts.find(
    (district) => district.value === districtValue
  );
}

function buildItemsUrl(filters: ItemsPageFilters): string {
  const params = new URLSearchParams();
  params.set("type", filters.type);

  if (filters.category) {
    params.set("category", filters.category);
  }

  if (filters.search) {
    params.set("search", filters.search);
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
    Boolean(filters.search),
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
    filters.search ? `검색: ${filters.search}` : null,
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
  const [selectedRegion1, setSelectedRegion1] = useState("");
  const [selectedRegion2, setSelectedRegion2] = useState("");
  const [selectedRegion3, setSelectedRegion3] = useState("");
  const hasDraftCoordinates =
    draftFilters.latitude !== undefined && draftFilters.longitude !== undefined;
  const selectedRegion1Option = findRegionByValue(selectedRegion1);
  const selectedRegion2Option = selectedRegion1Option?.districts.find(
    (district) => district.value === selectedRegion2
  );

  const { data: itemsResult, isLoading, isFetching } = useItems({
    type: filters.type,
    search: filters.search || undefined,
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
      if (!nextFilters.location) {
        setSelectedRegion1("");
        setSelectedRegion2("");
        setSelectedRegion3("");
      }
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
      search: nextFilters.search.trim(),
      category: nextFilters.category.trim(),
      color: nextFilters.color.trim(),
      location: nextFilters.location.trim(),
    };

    if (
      normalizedFilters.location &&
      normalizedFilters.latitude !== undefined &&
      normalizedFilters.longitude !== undefined
    ) {
      normalizedFilters.latitude = undefined;
      normalizedFilters.longitude = undefined;
      normalizedFilters.radiusKm = DEFAULT_FILTERS.radiusKm;
    }

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

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applyFilters({
      ...draftFilters,
      type: filters.type,
      page: 1,
    });
  };

  const handleResetFilters = () => {
    setSelectedRegion1("");
    setSelectedRegion2("");
    setSelectedRegion3("");
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
          location: "",
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          radiusKm: current.radiusKm || DEFAULT_FILTERS.radiusKm,
        }));
        setSelectedRegion1("");
        setSelectedRegion2("");
        setSelectedRegion3("");
        setIsLocating(false);
        toast({
          title: "현재 위치를 적용했어요",
          description: "지역 필터를 해제하고 현재 위치 반경으로 전환했습니다.",
        });
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

  const setLocationFilter = (location: string) => {
    setDraftFilters((current) => ({
      ...current,
      location,
      latitude: undefined,
      longitude: undefined,
      radiusKm: DEFAULT_FILTERS.radiusKm,
    }));
  };

  const handleRegion1Change = (value: string) => {
    const region = findRegionByValue(value);
    setSelectedRegion1(value);
    setSelectedRegion2("");
    setSelectedRegion3("");
    setLocationFilter(region?.value ?? value);
  };

  const handleRegion2Change = (value: string) => {
    setSelectedRegion2(value);
    setSelectedRegion3("");
    setLocationFilter(value);
  };

  const handleRegion3Change = (value: string) => {
    const district = findDistrictByValue(selectedRegion1, selectedRegion2);
    setSelectedRegion3(value);
    setLocationFilter(
      district ? `${district.value} ${value}` : value
    );
  };

  return (
    <Layout>
      <section className="border-b border-border bg-white pb-7 pt-8 md:pb-8 md:pt-10">
        <div className="container mx-auto max-w-6xl px-5">
          <div className="space-y-4">
            <div className="inline-flex items-center rounded-lg bg-accent px-3 py-1 text-sm font-semibold text-primary">
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
                  <TabsList className="h-11 rounded-xl border border-border bg-secondary p-1 shadow-none">
                    <TabsTrigger
                      value="found"
                      className="rounded-lg px-4 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                    >
                      습득물
                    </TabsTrigger>
                    <TabsTrigger
                      value="lost"
                      className="rounded-lg px-4 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:"
                    >
                      분실물
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-lg border-border bg-white px-4 shadow-none"
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
              onSubmit={handleSearchSubmit}
              className="rounded-xl border border-border bg-white p-4 shadow-sm md:p-5"
            >
              <div className="flex flex-col gap-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
                  <div className="space-y-2">
                    <label htmlFor="items-search" className="text-sm font-semibold text-foreground">
                      물건명, 설명, 지역으로 찾기
                    </label>
                    <div className="relative">
                      <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="items-search"
                        value={draftFilters.search}
                        onChange={(event) =>
                          setDraftFilters((current) => ({
                            ...current,
                            search: event.target.value,
                          }))
                        }
                        placeholder="예: 검은 지갑, 에어팟, 마곡동"
                        className="h-11 bg-white pl-10 shadow-none"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="h-11 px-5">
                    검색
                  </Button>
                  {filters.type === "found" ? (
                    <Button asChild variant="outline" className="h-11 px-5">
                      <Link href="/search">
                        <SearchIcon className="mr-2 h-4 w-4" />
                        AI 찾기
                      </Link>
                    </Button>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Filter className="h-4 w-4 text-primary" />
                      탐색 조건
                    </div>
                    <p className="text-sm text-muted-foreground">
                      지역과 현재 위치는 동시에 적용되지 않습니다.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                    {hasActiveFilters ? (
                      <div className="inline-flex items-center rounded-lg bg-[hsl(var(--primary-light))] px-3 py-1 text-xs font-semibold text-primary">
                        적용된 필터 {activeFilterCount}개
                      </div>
                    ) : null}
                    <button
                      type="button"
                      aria-expanded={isFilterOpen}
                      aria-controls="items-filter-fields"
                      onClick={() => setIsFilterOpen((current) => !current)}
                      className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-input bg-white px-3.5 text-sm font-medium text-foreground transition-all hover:border-primary/20 hover:bg-accent"
                    >
                      {isFilterOpen ? "필터 닫기" : "필터 열기"}
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
                    "grid-cols-1 gap-4 border-t border-border pt-4 md:grid-cols-2 lg:grid-cols-4",
                    isFilterOpen ? "grid" : "hidden"
                  )}
                >
                  <div className="space-y-2 md:col-span-2 lg:col-span-2">
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
                      <SelectTrigger className="h-11 rounded-lg bg-white shadow-none">
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
                      className="h-11 rounded-lg bg-white shadow-none"
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
                      className="h-11 rounded-lg bg-white shadow-none"
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
                        setLocationFilter(event.target.value)
                      }
                      placeholder="예: 마곡동, 시흥동, 마곡나루역"
                      className="h-11 rounded-lg bg-white shadow-none"
                    />
                    <div className="grid gap-2">
                      <Select value={selectedRegion1} onValueChange={handleRegion1Change}>
                        <SelectTrigger className="h-11 rounded-lg bg-white shadow-none">
                          <SelectValue placeholder="시/도 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {administrativeRegionOptions.map((region) => (
                            <SelectItem key={region.value} value={region.value}>
                              {region.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={selectedRegion2}
                        onValueChange={handleRegion2Change}
                        disabled={!selectedRegion1Option}
                      >
                        <SelectTrigger className="h-11 rounded-lg bg-white shadow-none">
                          <SelectValue placeholder="시/군/구 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedRegion1Option?.districts.map((district) => (
                            <SelectItem key={district.value} value={district.value}>
                              {district.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={selectedRegion3}
                        onValueChange={handleRegion3Change}
                        disabled={!selectedRegion2Option}
                      >
                        <SelectTrigger className="h-11 rounded-lg bg-white shadow-none">
                          <SelectValue placeholder="읍/면/동 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedRegion2Option?.dongs.map((dong) => (
                            <SelectItem key={dong} value={dong}>
                              {dong}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">
                      지역을 선택하면 현재 위치 반경 검색은 자동으로 해제됩니다.
                    </p>
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
                      <SelectTrigger className="h-11 rounded-lg bg-white shadow-none">
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
                    <p className="text-xs leading-5 text-muted-foreground">
                      현재 위치를 쓰면 지역 검색은 자동으로 해제됩니다.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleUseCurrentLocation}
                        disabled={isLocating}
                        className="h-11 flex-1 rounded-lg px-4"
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
                          className="h-11 w-11 rounded-lg border border-border"
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
                      <SelectTrigger className="h-11 rounded-lg bg-white shadow-none">
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
                      <SelectTrigger className="h-11 rounded-lg bg-white shadow-none">
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

                  <div className="flex items-end gap-2 md:col-span-2 lg:col-span-4">
                    <Button type="submit" className="h-11 flex-1 rounded-lg px-4">
                      적용
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleResetFilters}
                      className="h-11 rounded-lg px-4"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      초기화
                    </Button>
                  </div>
                </div>
              </div>
            </form>

            <div className="min-w-0 space-y-6">
              {isLoading ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {[1, 2, 3, 4, 5].map((index) => (
                  <div key={index} className="h-[290px] animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-secondary/35 py-20 text-center">
                <div className="mb-4 rounded-lg border border-border bg-white p-4 ">
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
                      className="h-11 rounded-lg px-6 font-medium"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      필터 초기화
                    </Button>
                  ) : null}
                  <Button asChild className="h-11 rounded-lg px-6 font-medium">
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
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/10 bg-[hsl(var(--primary-light))]/55 px-4 py-3">
                    <span className="text-xs font-semibold text-primary">적용 조건</span>
                    {activeFilterLabels.map((label) => (
                      <span
                        key={label}
                        className="inline-flex items-center rounded-lg border border-primary/15 bg-white px-3 py-1 text-xs font-semibold text-foreground "
                      >
                        {label}
                      </span>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleResetFilters}
                      className="h-8 rounded-lg px-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      초기화
                    </Button>
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="flex items-center gap-3 text-2xl font-bold text-foreground">
                    {resultTitle}
                    <span className="inline-flex items-center justify-center rounded-lg bg-accent px-3 py-0.5 text-sm font-bold text-primary">
                      {totalCount.toLocaleString()}건
                    </span>
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-lg border border-border bg-white px-3 py-1 text-xs font-semibold text-muted-foreground ">
                      {currentPage}/{totalPages}페이지
                    </span>
                    {isFetching ? (
                      <span className="inline-flex items-center rounded-lg border border-primary/15 bg-[hsl(var(--primary-light))] px-3 py-1 text-xs font-semibold text-primary">
                        새 목록 불러오는 중
                      </span>
                    ) : null}
                    {hasActiveFilters ? (
                      <span className="inline-flex items-center rounded-lg border border-primary/15 bg-[hsl(var(--primary-light))] px-3 py-1 text-xs font-semibold text-primary">
                        필터 적용 중
                      </span>
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
                        className="h-10 rounded-lg px-4"
                      >
                        처음
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage <= 1 || isFetching}
                        className="h-10 rounded-lg px-4"
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
                        className="h-10 rounded-lg px-4"
                      >
                        다음
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handlePageChange(totalPages)}
                        disabled={currentPage >= totalPages || isFetching}
                        className="h-10 rounded-lg px-4"
                      >
                        끝
                      </Button>
                      <form
                        onSubmit={handlePageJumpSubmit}
                        className="flex items-center gap-2 rounded-lg border border-border bg-white p-1 "
                      >
                        <Input
                          type="number"
                          min={1}
                          max={totalPages}
                          value={pageInputValue}
                          onChange={(event) => setPageInputValue(event.target.value)}
                          className="h-8 w-16 rounded-lg border-0 px-3 text-center text-sm font-semibold shadow-none [appearance:textfield] focus-visible:ring-1 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          aria-label="이동할 페이지"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isFetching}
                          className="h-8 rounded-lg px-3"
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
        </div>
      </section>
    </Layout>
  );
}
