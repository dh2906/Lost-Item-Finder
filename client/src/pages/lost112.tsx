import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Calendar, Building2, Phone, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { api, type Lost112ItemsResponse } from "@shared/routes";

const ALL_CATEGORIES = "all-categories";
const ALL_REGIONS = "all-regions";

// 경찰청 습득물 API 카테고리 코드
const CATEGORIES = [
  { code: ALL_CATEGORIES, label: "전체" },
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

// 시도 코드
const REGIONS = [
  { code: ALL_REGIONS, label: "전국" },
  { code: "서울", label: "서울" },
  { code: "부산", label: "부산" },
  { code: "대구", label: "대구" },
  { code: "인천", label: "인천" },
  { code: "광주", label: "광주" },
  { code: "대전", label: "대전" },
  { code: "울산", label: "울산" },
  { code: "세종", label: "세종" },
  { code: "경기", label: "경기" },
  { code: "강원", label: "강원" },
  { code: "충북", label: "충북" },
  { code: "충남", label: "충남" },
  { code: "전북", label: "전북" },
  { code: "전남", label: "전남" },
  { code: "경북", label: "경북" },
  { code: "경남", label: "경남" },
  { code: "제주", label: "제주" },
] as const;

// 기간 옵션
const DATE_RANGES = [
  { value: "7", label: "1주일" },
  { value: "30", label: "1개월" },
  { value: "90", label: "3개월" },
  { value: "180", label: "6개월" },
  { value: "365", label: "1년" },
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
  if (!ymd || ymd.length < 8) return ymd;
  return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`;
}

function Lost112ItemCard({ item }: { item: Lost112ItemsResponse["items"][number] }) {
  const detailUrl = `https://www.lost112.go.kr/find/findDetail.do?ATC_ID=${encodeURIComponent(
    item.atcId
  )}&FD_SN=${encodeURIComponent(item.fdSn || "1")}&pageIndex=1`;
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(item.fdFilePathImg) && !imageFailed;
  const title = item.fdSbjt || item.fdPrdtNm || "물품명 없음";
  const storagePlace = item.depPlace || item.fdHor;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* 이미지 */}
      <div className="relative h-44 bg-gray-50 flex items-center justify-center overflow-hidden">
        {hasImage ? (
          <img
            src={item.fdFilePathImg}
            alt={title}
            className="w-full h-full object-cover"
            onError={() => {
              setImageFailed(true);
            }}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-300">
            <Building2 className="w-12 h-12" />
            <span className="text-xs">이미지 없음</span>
          </div>
        )}
        <div className="absolute top-2 left-2">
          <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
            포털기관 습득물
          </Badge>
        </div>
      </div>

      {/* 내용 */}
      <div className="p-3 space-y-2">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{title}</h3>
          {item.prdtClNm && (
            <p className="text-xs text-gray-500 mt-0.5">{item.prdtClNm}{item.clrNm ? ` · ${item.clrNm}` : ""}</p>
          )}
        </div>

        <div className="space-y-1">
          {item.fdPlace && (
            <div className="flex items-start gap-1.5 text-xs text-gray-600">
              <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0 text-gray-400" />
              <span className="line-clamp-1">습득: {item.fdPlace}</span>
            </div>
          )}
          {storagePlace && (
            <div className="flex items-start gap-1.5 text-xs text-gray-600">
              <Building2 className="w-3 h-3 mt-0.5 flex-shrink-0 text-gray-400" />
              <span className="line-clamp-1">보관: {storagePlace}</span>
            </div>
          )}
          {item.fdYmd && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Calendar className="w-3 h-3 flex-shrink-0 text-gray-400" />
              <span>{formatDate(item.fdYmd)}</span>
            </div>
          )}
          {item.tel && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Phone className="w-3 h-3 flex-shrink-0 text-gray-400" />
              <span>{item.tel}</span>
            </div>
          )}
        </div>

        <a
          href={detailUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 w-full py-2 mt-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          경찰청에서 상세보기
        </a>
      </div>
    </div>
  );
}

function Lost112SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <Skeleton className="h-44 w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-8 w-full" />
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

  const queryKey = ["lost112", { category, region, startDate, endDate, page, numOfRows }];

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
        const errorPayload = (await res.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(
          errorPayload?.message ?? "Lost112 데이터를 불러오지 못했습니다."
        );
      }
      return res.json() as Promise<Lost112ItemsResponse>;
    },
    staleTime: 1000 * 60 * 5, // 5분 캐시
  });

  const totalPages = data ? Math.ceil(data.totalCount / numOfRows) : 0;

  const handleFilterChange = () => {
    setPage(1);
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 pb-24">
        {/* 헤더 */}
        <div className="pt-6 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🚔</span>
            <h1 className="text-xl font-bold text-gray-900">포털기관 습득물 조회</h1>
          </div>
          <p className="text-sm text-gray-500">
            전국 포털기관에서 보관 중인 습득물을 조회합니다
          </p>
        </div>

        {/* 필터 */}
        <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">카테고리</label>
              <Select
                value={category}
                onValueChange={(v) => { setCategory(v); handleFilterChange(); }}
              >
                <SelectTrigger className="h-9 text-sm bg-white">
                  <SelectValue placeholder="전체" />
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

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">지역</label>
              <Select
                value={region}
                onValueChange={(v) => { setRegion(v); handleFilterChange(); }}
              >
                <SelectTrigger className="h-9 text-sm bg-white">
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
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">기간</label>
            <div className="flex gap-2 flex-wrap">
              {DATE_RANGES.map((dr) => (
                <button
                  key={dr.value}
                  type="button"
                  onClick={() => { setDateRange(dr.value); handleFilterChange(); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    dateRange === dr.value
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300"
                  }`}
                >
                  {dr.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 결과 수 */}
        {!isLoading && data && (
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">
              총 <span className="font-semibold text-gray-800">{data.totalCount.toLocaleString()}</span>건
            </p>
            <p className="text-xs text-gray-400">{page} / {totalPages || 1} 페이지</p>
          </div>
        )}

        {/* 오류 */}
        {isError && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="font-medium">데이터를 불러오지 못했습니다</p>
            <p className="text-sm mt-1">
              {error instanceof Error
                ? error.message
                : "잠시 후 다시 시도해 주세요"}
            </p>
          </div>
        )}

        {/* 로딩 스켈레톤 */}
        {isLoading && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Lost112SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* 빈 결과 */}
        {!isLoading && !isError && data?.items.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-medium">조건에 맞는 습득물이 없습니다</p>
            <p className="text-sm mt-1">필터를 변경해 다시 검색해 보세요</p>
          </div>
        )}

        {/* 아이템 그리드 */}
        {!isLoading && !isError && data && data.items.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {data.items.map((item) => (
              <Lost112ItemCard key={item.atcId} item={item} />
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {/* 페이지 번호 (최대 5개) */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const startPage = Math.max(1, Math.min(page - 2, totalPages - 4));
              const pageNum = startPage + i;
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPage(pageNum)}
                  disabled={isLoading}
                  className="w-9 h-9 p-0 text-sm"
                >
                  {pageNum}
                </Button>
              );
            })}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || isLoading}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* 출처 안내 */}
        <div className="mt-6 p-3 bg-blue-50 rounded-lg text-xs text-blue-600 text-center">
          데이터 출처: 경찰청 유실물 통합포털 (lost112.go.kr) · 공공데이터포털
        </div>
      </div>
    </Layout>
  );
}
