import { useState, useRef, type ChangeEvent, type DragEvent, type KeyboardEvent } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles, Image as ImageIcon, Search as SearchIcon, X, Loader2, PlusCircle, MapPin } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ItemCard } from "@/components/item-card";
import { useSearchSimilar } from "@/hooks/use-ai";
import { optimizeImageForUpload } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { LocationPicker } from "@/components/location-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }

  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)}km`;
}

const searchSchema = z
  .object({
    prompt: z.string().optional(),
    imageUrl: z.string().optional(),
    location: z.string().optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    radiusKm: z.number().positive().optional(),
  })
  .refine((data) => data.prompt || data.imageUrl, {
    message: "설명이나 이미지를 제공해주세요.",
    path: ["prompt"],
  });

type SearchFormValues = z.infer<typeof searchSchema>;
type LocationMode = "none" | "nearby" | "region" | "map";

const searchRadiusOptions = [
  { value: 0.1, label: "100m" },
  { value: 0.3, label: "300m" },
  { value: 0.5, label: "500m" },
  { value: 1, label: "1km" },
  { value: 3, label: "3km" },
] as const;

export default function SearchPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [locationMode, setLocationMode] = useState<LocationMode>("none");
  const [isLocating, setIsLocating] = useState(false);
  const { toast } = useToast();
  const searchMutation = useSearchSimilar();

  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      prompt: "",
      imageUrl: "",
      location: "",
      latitude: "",
      longitude: "",
      radiusKm: undefined,
    },
  });

  const processSelectedFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: "이미지 파일만 업로드 가능",
        description: "사진 파일을 선택하거나 드래그해 주세요.",
      });
      return;
    }

    try {
      const base64 = await optimizeImageForUpload(file);
      setImagePreview(base64);
      form.setValue("imageUrl", base64);
      form.clearErrors("prompt");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "이미지 처리 실패",
        description: "이미지를 처리하는 중 오류가 발생했습니다.",
      });
    }
  };

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await processSelectedFile(file);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    await processSelectedFile(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    form.setValue("imageUrl", "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleLocationChange = (location: { latitude: string; longitude: string }) => {
    form.setValue("latitude", location.latitude);
    form.setValue("longitude", location.longitude);
    form.setValue("radiusKm", form.getValues("radiusKm") ?? 1);
  };

  const toggleLocation = () => {
    setShowLocation(!showLocation);
  };

  const clearLocationFilters = () => {
    form.setValue("location", "");
    form.setValue("latitude", "");
    form.setValue("longitude", "");
    form.setValue("radiusKm", undefined);
  };

  const handleLocationModeChange = (value: string) => {
    const nextMode = value as LocationMode;
    setLocationMode(nextMode);

    if (nextMode === "none") {
      clearLocationFilters();
      return;
    }

    if (nextMode === "region") {
      form.setValue("latitude", "");
      form.setValue("longitude", "");
      form.setValue("radiusKm", undefined);
      return;
    }

    form.setValue("location", "");
    form.setValue("radiusKm", form.getValues("radiusKm") ?? 1);
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
        form.setValue("latitude", position.coords.latitude.toFixed(6));
        form.setValue("longitude", position.coords.longitude.toFixed(6));
        form.setValue("radiusKm", form.getValues("radiusKm") ?? 1);
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

  const onSubmit = async (data: SearchFormValues) => {
    try {
      const payload = {
        ...data,
        location: locationMode === "region" ? data.location?.trim() : undefined,
        latitude:
          locationMode === "nearby" || locationMode === "map"
            ? data.latitude
            : undefined,
        longitude:
          locationMode === "nearby" || locationMode === "map"
            ? data.longitude
            : undefined,
        radiusKm:
          locationMode === "nearby" || locationMode === "map"
            ? data.radiusKm
            : undefined,
      };

      await searchMutation.mutateAsync(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "검색 중 오류가 발생했습니다.";
      toast({
        variant: "destructive",
        title: "검색 실패",
        description: message,
      });
    }
  };

  const handlePromptKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (searchMutation.isPending) return;
    void form.handleSubmit(onSubmit)();
  };

  return (
    <Layout>
      {/* Header & Search Input Section */}
      <div className="bg-[linear-gradient(180deg,hsl(var(--primary-light))_0%,transparent_100%)] pb-10 pt-14">
        <div className="container mx-auto max-w-4xl px-5">
          <div className="mb-6 text-center">
            <div className="mb-5 inline-flex items-center justify-center rounded-full border border-primary/15 bg-white/88 px-3 py-1.5 shadow-sm">
              <Sparkles className="mr-2 h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">AI 기반 스마트 검색</span>
            </div>
            <h1 className="mb-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl">
              잃어버린 물건을
              <br />
              <span className="whitespace-nowrap">
                <span className="text-gradient">더 빠르게</span> 찾아보세요
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              설명이나 사진으로 비슷한 게시물을 찾아보세요
            </p>
          </div>

          <Card
            className={cn(
              "mx-auto max-w-3xl rounded-[30px] border-border/70 bg-white/90 p-2 backdrop-blur-sm transition-all duration-300 focus-within:border-primary/20 focus-within:ring-2 focus-within:ring-primary/15 sm:p-3",
              isDragActive && "border-primary/45 bg-primary/5 ring-2 ring-primary/15"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
              {imagePreview && (
                <div className="px-2 pt-2">
                  <div className="flex items-start">
                    <div className="group relative shrink-0 overflow-hidden rounded-[20px] border border-border/70 bg-white shadow-sm">
                      <img
                        src={imagePreview}
                        alt="미리보기"
                        className="h-16 w-16 object-cover sm:h-20 sm:w-20"
                      />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-foreground shadow-sm transition-colors hover:bg-white"
                        aria-label="이미지 제거"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="px-2">
                <Textarea
                  placeholder="예: 검은색 모자, 학생회관 근처에서 잃어버렸어요"
                  className="min-h-[88px] resize-none rounded-[24px] border border-border/70 bg-white px-4 py-3.5 text-base shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 sm:min-h-[104px]"
                  onKeyDown={handlePromptKeyDown}
                  {...form.register("prompt")}
                />
              </div>

              <div className="flex flex-col items-stretch justify-between gap-3 border-t border-border/80 px-2 pb-2 pt-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-10 rounded-full border border-border/70 bg-white/90 px-4 text-foreground/80 shadow-sm transition-colors hover:border-primary/25 hover:bg-accent hover:text-primary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    <span className="font-medium">사진 추가</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={`h-10 rounded-full border px-4 font-medium shadow-sm transition-colors ${showLocation ? "border-primary/20 bg-accent text-primary" : "border-border/70 bg-white/90 text-foreground/80 hover:border-primary/25 hover:bg-accent hover:text-primary"}`}
                    onClick={toggleLocation}
                  >
                    <MapPin className="mr-2 h-4 w-4" />
                    <span>위치 설정</span>
                  </Button>
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="h-12 rounded-full px-8 font-semibold shadow-[0_12px_22px_-16px_hsl(var(--primary)/0.4)]"
                  disabled={searchMutation.isPending}
                >
                  {searchMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      검색 중...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      유사 게시물 찾기
                    </>
                  )}
                </Button>
              </div>

              {showLocation && (
                <div className="mt-2 animate-in slide-in-from-top-2 fade-in rounded-[24px] border border-border/70 bg-secondary/45 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <MapPin className="h-4 w-4 text-primary" />
                      분실 위치 주변에서 찾기 (선택)
                    </label>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={toggleLocation}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[1fr_160px]">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">검색 방식</label>
                      <Select value={locationMode} onValueChange={handleLocationModeChange}>
                        <SelectTrigger className="h-11 rounded-2xl bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">전체 지역</SelectItem>
                          <SelectItem value="nearby">내 근처</SelectItem>
                          <SelectItem value="region">지역명 직접 입력</SelectItem>
                          <SelectItem value="map">지도에서 위치 지정</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(locationMode === "nearby" || locationMode === "map") && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">반경</label>
                        <Select
                          value={String(form.watch("radiusKm") ?? 1)}
                          onValueChange={(value) => form.setValue("radiusKm", Number(value))}
                        >
                          <SelectTrigger className="h-11 rounded-2xl bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {searchRadiusOptions.map((option) => (
                              <SelectItem key={option.value} value={String(option.value)}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {locationMode === "nearby" && (
                    <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-border/70 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-muted-foreground">
                        {form.watch("latitude") && form.watch("longitude")
                          ? `현재 위치 기준 ${searchRadiusOptions.find((option) => option.value === form.watch("radiusKm"))?.label ?? "1km"} 이내`
                          : "현재 위치를 가져와 주변 습득물을 검색합니다."}
                      </div>
                      <Button type="button" variant="outline" className="rounded-xl" onClick={handleUseCurrentLocation} disabled={isLocating}>
                        {isLocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                        현재 위치 사용
                      </Button>
                    </div>
                  )}

                  {locationMode === "region" && (
                    <div className="mt-3 space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">지역명</label>
                      <Input
                        placeholder="예: 아산시, 서울특별시 강남구, 충청남도 천안시 동남구"
                        className="h-11 rounded-2xl bg-white"
                        {...form.register("location")}
                      />
                    </div>
                  )}

                  {locationMode === "map" && (
                    <div className="mt-3 overflow-hidden rounded-[20px] border border-border/70 bg-white shadow-card">
                      <LocationPicker
                        value={
                          form.watch("latitude") && form.watch("longitude")
                            ? { latitude: form.watch("latitude") || "", longitude: form.watch("longitude") || "" }
                            : undefined
                        }
                        onChange={handleLocationChange}
                        height="240px"
                      />
                    </div>
                  )}
                </div>
              )}
            </form>
            {form.formState.errors.prompt && !imagePreview && (
              <p className="text-sm text-destructive px-6 pb-3 pt-1">
                {form.formState.errors.prompt.message}
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* Results Section */}
      <section className="pb-16">
        <div className="container mx-auto max-w-6xl px-5">
          {searchMutation.isPending ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative mb-6">
                <div className="absolute inset-0 animate-pulse rounded-full bg-primary blur-xl opacity-15"></div>
                <div className="relative rounded-full border border-border/70 bg-white p-4 shadow-sm">
                  <Sparkles className="h-10 w-10 animate-pulse text-primary" />
                </div>
              </div>
              <h3 className="mb-2 text-xl font-bold text-foreground">AI가 일치하는 게시물을 찾고 있어요</h3>
              <p className="text-muted-foreground">입력하신 특징과 이미지, 위치 정보를 종합적으로 분석 중입니다.</p>
            </div>
          ) : searchMutation.isSuccess && searchMutation.data ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <h2 className="flex items-center gap-3 text-2xl font-bold text-foreground">
                  검색 결과
                  <span className="inline-flex items-center justify-center rounded-full bg-accent px-3 py-0.5 text-sm font-bold text-primary">
                    {searchMutation.data.length}건
                  </span>
                </h2>
              </div>

              {searchMutation.data.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-border/80 bg-secondary/35 py-20">
                  <div className="mb-4 rounded-full border border-border/70 bg-white p-4 shadow-sm">
                    <SearchIcon className="h-8 w-8 text-muted-foreground/55" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-foreground">일치하는 물건이 없어요</h3>
                  <p className="mb-8 max-w-sm text-center leading-relaxed text-muted-foreground">
                    설명을 조금 더 구체적으로 적어보시거나, 위치 범위를 넓혀서 다시 검색해보세요.
                  </p>
                  <Button asChild variant="outline" className="h-11 rounded-full px-6 font-medium">
                    <Link href="/report/lost">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      분실물 신고하기
                    </Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {searchMutation.data.map((result) => (
                      <ItemCard
                        key={result.item.id}
                        item={result.item}
                        score={result.score}
                        reasoning={result.reasoning}
                        distanceText={typeof result.distanceKm === "number" ? formatDistance(result.distanceKm) : undefined}
                      />
                    ))}
                  </div>

                  <div className="mt-12 rounded-[28px] border border-primary/10 bg-[linear-gradient(180deg,hsl(var(--primary-light))_0%,white_100%)] p-8 text-center">
                    <h4 className="mb-2 text-lg font-bold text-foreground">원하시는 물건을 찾지 못하셨나요?</h4>
                    <p className="mx-auto mb-6 max-w-md leading-relaxed text-muted-foreground">
                      직접 분실물 신고를 등록하시면, 누군가 비슷한 물건을 습득했을 때 알림을 보내드릴 수 있어요.
                    </p>
                    <Button asChild className="h-11 rounded-full px-6 font-medium">
                      <Link href="/report/lost">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        분실물 신고 등록하기
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="py-12 text-center sm:py-14">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border border-border/70 bg-white shadow-sm">
                <SearchIcon className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-foreground">AI 검색을 시작해보세요</h3>
              <p className="font-medium text-muted-foreground">
                위에서 물건 특징을 입력하고 검색해보세요
              </p>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
