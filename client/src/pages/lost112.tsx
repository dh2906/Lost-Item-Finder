import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin,
  Calendar,
  Building2,
  Phone,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  RotateCcw,
  PackageOpen,
  SearchIcon,
  ShieldCheck,
} from "lucide-react";
import { api, type Lost112ItemsResponse } from "@shared/routes";
import { cn } from "@/lib/utils";

const ALL_CATEGORIES = "all-categories";
const ALL_REGIONS = "all-regions";

const CATEGORIES = [
  { code: ALL_CATEGORIES, label: "전체 카테고리" },
  { code: "지갑", label: "지갑" },
  { code: "가방", label: "가방" },
  { code: "도서용품", label: "도서용품" },
  { code: "의류", label: "의류" },
  { code: "잡화", label: "잡화류" },
  { code: "유가증권", label: "유가증권" },
  { code: "스포츠", label: "스포츠용품" },
  { code: "전자기기", label: "전자기기" },
  { code: "귀금속", label: "귀금속" },
  { code: "자동차", label: "자동차" },
  { code: "자전거", label: "자전거/이륜차" },
  { code: "동물", label: "동물" },
  { code: "현금", label: "현금" },
  { code: "기타", label: "기타" },
] as const;

const REGIONS = [
  { code: ALL_REGIONS, label: "전국" },
  { code: "서울특별시", label: "서울" },
  { code: "부산광역시", label: "부산" },
  { code: "대구광역시", label: "대구" },
  { code: "인천광역시", label: "인천" },
  { code: "광주광역시", label: "광주" },
  { code: "대전광역시", label: "대전" },
  { code: "울산광역시", label: "울산" },
  { code: "세종특별자치시", label: "세종" },
  { code: "경기도", label: "경기" },
  { code: "강원특별자치도", label: "강원" },
  { code: "충청북도", label: "충북" },
  { code: "충청남도", label: "충남" },
  { code: "전북특별자치도", label: "전북" },
  { code: "전라남도", label: "전남" },
  { code: "경상북도", label: "경북" },
  { code: "경상남도", label: "경남" },
  { code: "제주특별자치도", label: "제주" },
] as const;

const DATE_RANGES = [
  { value: "7", label: "최근 1주일" },
  { value: "30", label: "최근 1개월" },
  { value: "90", label: "최근 3개월" },
  { value: "180", label: "최근 6개월" },
  { value: "365", label: "최근 1년" },
] as const;

function getDateString(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function formatDate(ymd: string): string {
  if (!ymd) return ymd;
  if (ymd.includes("-")) {
    const parts = ymd.split("-");
    if (parts.length >= 3) {
      return `${parts[0]}.${parts[1]}.${parts[2].slice(0, 2)}`;
    }
    return ymd;
  }
  if (ymd.length < 8) return ymd;
  return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`;
}

function Lost112ItemCard({
  item,
}: {
  item: Lost112ItemsResponse["items"][number];
}) {
  const detailUrl = `https://www.lost112.go.kr/find/findDetail.do?ATC_ID=${encodeURIComponent(
    item.atcId
  )}&FD_SN=${encodeURIComponent(item.fdSn || "1")}&pageIndex=1`;
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(item.fdFilePathImg) && !imageFailed;
  const title = item.fdSbjt || item.fdPrdtNm || "물품명 없음";
  const storagePlace = item.depPlace || item.fdHor;

  return (
    <a
      href={detailUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col overflow-hidden rounded-[26px] border border-border/70 bg-white/92 shadow-sm transition-all hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* 썸네일 이미지 영역 */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {hasImage ? (
          <img
            src={item.fdFilePathImg}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Building2 className="h-10 w-10 opacity-40" />
            <span className="text-xs font-medium">이미지 없음</span>
          </div>
        )}
        <div className="absolute left-3 top-3 inline-flex items-center rounded-full border border-primary/10 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-primary shadow-sm backdrop-blur-sm">
          포털기관 데이터
        </div>
      </div>

      {/* 정보 영역 */}
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <h3 className="line-clamp-1 text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
            {title}
          </h3>
          {item.prdtClNm && (
            <p className="mt-1 text-xs text-muted-foreground">
              {item.prdtClNm}
              {item.clrNm ? ` · ${item.clrNm}` : ""}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          {item.fdPlace && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="line-clamp-1">{item.fdPlace}</span>
            </div>
          )}
          {item.fdYmd && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>{formatDate(item.fdYmd)}</span>
            </div>
          )}
          {storagePlace && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="line-clamp-1">보관: {storagePlace}</span>
            </div>
          )}
          {item.tel && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4 shrink-0" />
              <span>{item.tel}</span>
            </div>
          )}
        </div>

        {/* <div className="mt-auto pt-2">
          <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary-light))] py-2.5 text-xs font-semibold text-primary transition-colors group-hover:bg-primary/15">
            <ExternalLink className="h-4 w-4" />
            경찰청에서 상세 확인
          </div>
        </div> */}
      </div>
    </a>
  );
}

function Lost112SkeletonCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-[26px] border border-border/70 bg-white/92 shadow-sm">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <div className="mt-auto pt-2">
          <Skeleton className="h-9 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function Lost112Page() {
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [region, setRegion] = useState(ALL_REGIONS);
  const [dateRange, setDateRange] = useState("30");
  const [page, setPage] = useState(1);
  const numOfRows = 20;

  const startDate = getDateString(Number(dateRange));
  const endDate = getDateString(0);

  const queryKey = [
    "lost112",
    { category, region, startDate, endDate, page, numOfRows },
  ];

  const { data, error, isLoading, isError } = useQuery<Lost112ItemsResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        numOfRows: String(numOfRows),
      });
      if (category !== ALL_CATEGORIES) params.set("category", category);
      if (region !== ALL_REGIONS) params.set("region", region);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`${api.lost112.items.path}?${params.toString()}`);
      if (!res.ok) {
        const errorPayload = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(
          errorPayload?.message ?? "Lost112 데이터를 불러오지 못했습니다."
        );
      }
      return res.json() as Promise<Lost112ItemsResponse>;
    },
    staleTime: 1000 * 60 * 5,
  });

  const totalPages = data ? Math.ceil(data.totalCount / numOfRows) : 0;

  const handleFilterChange = () => {
    setPage(1);
  };

  const handleResetFilters = () => {
    setCategory(ALL_CATEGORIES);
    setRegion(ALL_REGIONS);
    setDateRange("30");
    setPage(1);
  };

  const activeFilterCount = [
    category !== ALL_CATEGORIES,
    region !== ALL_REGIONS,
    dateRange !== "30",
  ].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  return (
    <Layout>
      {/* 헤더 섹션 (ItemsPage와 동일) */}
      <section className="border-b border-border/70 bg-[linear-gradient(180deg,hsl(var(--primary-light))_0%,transparent_100%)] pb-10 pt-14">
        <div className="container mx-auto max-w-6xl px-5">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/12 bg-white/88 px-3 py-1 text-sm font-semibold text-primary shadow-sm">
              <ShieldCheck className="h-4 w-4" />
              경찰청 연동 데이터
            </div>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  포털기관 습득물 조회
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                  전국 경찰서 및 유실물 센터에 보관 중인 습득물 데이터를
                  실시간으로 조회합니다.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full border-border/70 bg-white/92 px-5 shadow-sm"
                >
                  <Link href="/items?type=found">Findy 습득물 보기</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 메인 컨텐츠 섹션 */}
      <section className="pb-16 pt-10">
        <div className="container mx-auto max-w-6xl px-5">
          <div className="space-y-6">
            {/* 필터 섹션 */}
            <div className="rounded-[28px] border border-border/70 bg-white/92 p-5 shadow-[0_20px_40px_-32px_rgba(27,31,59,0.2)]">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Filter className="h-4 w-4 text-primary" />
                      게시글 필터
                    </div>
                    <p className="text-sm text-muted-foreground">
                      카테고리, 지역, 기간 기준으로 포털기관 데이터를
                      좁혀보세요.
                    </p>
                  </div>
                  {hasActiveFilters ? (
                    <div className="inline-flex items-center self-start rounded-full bg-[hsl(var(--primary-light))] px-3 py-1 text-xs font-semibold text-primary lg:self-auto">
                      적용된 필터 {activeFilterCount}개
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      카테고리
                    </label>
                    <Select
                      value={category}
                      onValueChange={(v) => {
                        setCategory(v);
                        handleFilterChange();
                      }}
                    >
                      <SelectTrigger className="h-11 rounded-2xl bg-white">
                        <SelectValue placeholder="전체 카테고리" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.code} value={cat.code}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      지역
                    </label>
                    <Select
                      value={region}
                      onValueChange={(v) => {
                        setRegion(v);
                        handleFilterChange();
                      }}
                    >
                      <SelectTrigger className="h-11 rounded-2xl bg-white">
                        <SelectValue placeholder="전국" />
                      </SelectTrigger>
                      <SelectContent>
                        {REGIONS.map((r) => (
                          <SelectItem key={r.code} value={r.code}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      기간
                    </label>
                    <Select
                      value={dateRange}
                      onValueChange={(v) => {
                        setDateRange(v);
                        handleFilterChange();
                      }}
                    >
                      <SelectTrigger className="h-11 rounded-2xl bg-white">
                        <SelectValue placeholder="기간 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {DATE_RANGES.map((dr) => (
                          <SelectItem key={dr.value} value={dr.value}>
                            {dr.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end md:col-span-3 xl:col-span-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleResetFilters}
                      className="h-11 w-full rounded-2xl bg-white"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      초기화
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* 에러 상태 */}
            {isError && (
              <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-border/80 bg-secondary/35 py-20 text-center">
                <div className="mb-4 rounded-full border border-border/70 bg-white p-4 shadow-sm">
                  <PackageOpen className="h-8 w-8 text-muted-foreground/55" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-foreground">
                  데이터를 불러오지 못했습니다
                </h3>
                <p className="text-muted-foreground">
                  {error instanceof Error
                    ? error.message
                    : "잠시 후 다시 시도해 주세요"}
                </p>
              </div>
            )}

            {/* 정상 리스트 렌더링 영역 */}
            {!isError && (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="flex items-center gap-3 text-2xl font-bold text-foreground">
                    전체 게시물
                    {!isLoading && data && (
                      <span className="inline-flex items-center justify-center rounded-full bg-accent px-3 py-0.5 text-sm font-bold text-primary">
                        {data.totalCount.toLocaleString()}건
                      </span>
                    )}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      데이터 출처: 경찰청 유실물 통합포털 (lost112.go.kr)
                    </span>
                  </div>
                </div>

                {/* 로딩 스켈레톤 */}
                {isLoading ? (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Lost112SkeletonCard key={i} />
                    ))}
                  </div>
                ) : data?.items.length === 0 ? (
                  /* 빈 결과 상태 */
                  <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-border/80 bg-secondary/35 py-20 text-center">
                    <div className="mb-4 rounded-full border border-border/70 bg-white p-4 shadow-sm">
                      <SearchIcon className="h-8 w-8 text-muted-foreground/55" />
                    </div>
                    <h3 className="mb-2 text-lg font-bold text-foreground">
                      조건에 맞는 습득물이 없어요
                    </h3>
                    <p className="max-w-sm text-center leading-relaxed text-muted-foreground">
                      카테고리, 지역, 날짜 조건을 바꿔서 다시 확인해보세요.
                    </p>
                    <div className="mt-6 flex justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleResetFilters}
                        className="h-11 rounded-full px-6 font-medium"
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        필터 초기화
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* 카드 그리드 */
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {data?.items.map((item) => (
                      <Lost112ItemCard key={item.atcId} item={item} />
                    ))}
                  </div>
                )}

                {/* 페이지네이션 */}
                {!isLoading && totalPages > 1 && (
                  <div className="mt-10 flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1 || isLoading}
                      className="h-10 w-10 rounded-xl p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const startPage = Math.max(
                        1,
                        Math.min(page - 2, totalPages - 4)
                      );
                      const pageNum = startPage + i;
                      return (
                        <Button
                          key={pageNum}
                          variant={pageNum === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPage(pageNum)}
                          disabled={isLoading}
                          className={cn(
                            "h-10 w-10 rounded-xl p-0 text-sm font-semibold",
                            pageNum === page
                              ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages || isLoading}
                      className="h-10 w-10 rounded-xl p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
