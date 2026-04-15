import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Image as ImageIcon,
  Loader2,
  MapPin,
  PlusCircle,
  Search as SearchIcon,
  Sparkles,
  X,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ItemCard } from "@/components/item-card";
import { LocationPicker } from "@/components/location-picker";
import { useSearchSimilar } from "@/hooks/use-ai";
import { useToast } from "@/hooks/use-toast";
import { cn, optimizeImageForUpload } from "@/lib/utils";
import {
  locationFilterScopes,
  locationRadiusOptions,
  type LocationFilterScope,
} from "@shared/routes";

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
    useLocationFilter: z.boolean().optional(),
    locationScope: z.enum(locationFilterScopes).optional(),
    locationText: z.string().optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    radiusKm: z.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.prompt && !data.imageUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "설명이나 이미지를 제공해주세요.",
        path: ["prompt"],
      });
    }

    if (
      data.useLocationFilter &&
      data.locationScope !== "radius" &&
      !data.locationText?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "동네 기준 비교를 위해 위치를 먼저 선택해주세요.",
        path: ["locationText"],
      });
    }

    if (
      data.useLocationFilter &&
      data.locationScope === "radius" &&
      !(data.latitude && data.longitude)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "반경 검색을 위해 위치 좌표가 필요합니다.",
        path: ["latitude"],
      });
    }
  });

type SearchFormValues = z.infer<typeof searchSchema>;

const locationScopeOptions: Array<{ value: LocationFilterScope; label: string }> = [
  { value: "radius", label: "반경 기준" },
  { value: "dong", label: "동 단위" },
  { value: "sigungu", label: "시/구 단위" },
  { value: "sido", label: "시/도 단위" },
];

export default function SearchPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [showLocationPanel, setShowLocationPanel] = useState(false);
  const { toast } = useToast();
  const searchMutation = useSearchSimilar();

  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      prompt: "",
      imageUrl: "",
      useLocationFilter: false,
      locationScope: "radius",
      locationText: "",
      latitude: "",
      longitude: "",
      radiusKm: 3,
    },
  });

  const isLocationFilterEnabled = form.watch("useLocationFilter") === true;
  const selectedLocationScope = form.watch("locationScope") ?? "radius";
  const selectedRadius = form.watch("radiusKm") ?? 3;
  const selectedLocationText = form.watch("locationText");
  const selectedLatitude = form.watch("latitude");
  const selectedLongitude = form.watch("longitude");

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
    } catch {
      toast({
        variant: "destructive",
        title: "이미지 처리 실패",
        description: "이미지를 처리하는 중 오류가 발생했습니다.",
      });
    }
  };

  const handleImageSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleLocationChange = (location: {
    latitude: string;
    longitude: string;
    address?: string;
  }) => {
    form.setValue("latitude", location.latitude);
    form.setValue("longitude", location.longitude);

    if (location.address) {
      form.setValue("locationText", location.address, {
        shouldDirty: true,
        shouldTouch: true,
      });
    }
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    if (form.getValues("latitude") && form.getValues("longitude")) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.setValue("latitude", position.coords.latitude.toFixed(6), {
          shouldDirty: false,
          shouldTouch: false,
        });
        form.setValue("longitude", position.coords.longitude.toFixed(6), {
          shouldDirty: false,
          shouldTouch: false,
        });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [form]);

  const onSubmit = async (data: SearchFormValues) => {
    try {
      await searchMutation.mutateAsync(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "검색 중 오류가 발생했습니다.";
      toast({
        variant: "destructive",
        title: "검색 실패",
        description: message,
      });
    }
  };

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    event.preventDefault();
    if (searchMutation.isPending) {
      return;
    }

    void form.handleSubmit(onSubmit)();
  };

  return (
    <Layout>
      <div className="bg-[linear-gradient(180deg,hsl(var(--primary-light))_0%,transparent_100%)] pb-10 pt-14">
        <div className="container mx-auto max-w-4xl px-5">
          <div className="mb-6 text-center">
            <div className="mb-5 inline-flex items-center justify-center rounded-full border border-primary/15 bg-white/88 px-3 py-1.5 shadow-sm">
              <Sparkles className="mr-2 h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">
                AI 기반 스마트 검색
              </span>
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
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-3"
            >
              {imagePreview ? (
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
              ) : null}

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
                    className={cn(
                      "h-10 rounded-full border px-4 font-medium shadow-sm transition-colors",
                      showLocationPanel || isLocationFilterEnabled
                        ? "border-primary/20 bg-accent text-primary"
                        : "border-border/70 bg-white/90 text-foreground/80 hover:border-primary/25 hover:bg-accent hover:text-primary"
                    )}
                    onClick={() => setShowLocationPanel((current) => !current)}
                  >
                    <MapPin className="mr-2 h-4 w-4" />
                    <span>
                      {isLocationFilterEnabled ? "지역 필터 설정됨" : "위치 설정"}
                    </span>
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

              {showLocationPanel ? (
                <div className="mt-2 animate-in slide-in-from-top-2 fade-in rounded-[24px] border border-border/70 bg-secondary/45 p-4">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <MapPin className="h-4 w-4 text-primary" />
                        지역 기반 검색
                      </label>
                      <p className="text-sm text-muted-foreground">
                        필요할 때만 켜서 동네 범위나 반경 기준으로 결과를 좁혀보세요.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                      onClick={() => setShowLocationPanel(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-[18px] border border-border/70 bg-white/92 px-4 py-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                          지역 기반 검색 사용
                        </p>
                        <p className="text-xs text-muted-foreground">
                          끄면 위치 정보는 보관하되 결과 필터링에는 사용하지 않습니다.
                        </p>
                      </div>
                      <Switch
                        checked={isLocationFilterEnabled}
                        onCheckedChange={(checked) =>
                          form.setValue("useLocationFilter", checked, {
                            shouldDirty: true,
                            shouldTouch: true,
                          })
                        }
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          범위 기준
                        </label>
                        <Select
                          value={selectedLocationScope}
                          onValueChange={(value) =>
                            form.setValue(
                              "locationScope",
                              value as LocationFilterScope,
                              {
                                shouldDirty: true,
                                shouldTouch: true,
                              }
                            )
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

                      {selectedLocationScope === "radius" ? (
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">
                            반경
                          </label>
                          <Select
                            value={String(selectedRadius)}
                            onValueChange={(value) =>
                              form.setValue("radiusKm", Number(value), {
                                shouldDirty: true,
                                shouldTouch: true,
                              })
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
                          <label className="text-sm font-medium text-foreground">
                            행정구역 범위
                          </label>
                          <div className="flex h-11 items-center rounded-2xl border border-border/70 bg-white px-4 text-sm text-muted-foreground">
                            선택한 위치의{" "}
                            {selectedLocationScope === "dong"
                              ? "동"
                              : selectedLocationScope === "sigungu"
                                ? "시/구"
                                : "시/도"}
                            를 기준으로 필터링합니다.
                          </div>
                        </div>
                      )}
                    </div>

                    <div
                      className={cn(
                        "overflow-hidden rounded-[20px] border border-border/70 bg-white shadow-card",
                        !isLocationFilterEnabled && "opacity-70"
                      )}
                    >
                      <LocationPicker
                        value={
                          selectedLatitude && selectedLongitude
                            ? {
                                latitude: selectedLatitude,
                                longitude: selectedLongitude,
                              }
                            : undefined
                        }
                        onChange={handleLocationChange}
                        height="240px"
                      />
                    </div>

                    {selectedLocationText ? (
                      <p className="rounded-[16px] border border-primary/12 bg-white/90 px-4 py-3 text-sm text-foreground/80">
                        선택한 위치: {selectedLocationText}
                      </p>
                    ) : null}

                    {form.formState.errors.locationText ? (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.locationText.message}
                      </p>
                    ) : null}
                    {form.formState.errors.latitude ? (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.latitude.message}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </form>

            {form.formState.errors.prompt && !imagePreview ? (
              <p className="px-6 pb-3 pt-1 text-sm text-destructive">
                {form.formState.errors.prompt.message}
              </p>
            ) : null}
          </Card>
        </div>
      </div>

      <section className="pb-16">
        <div className="container mx-auto max-w-6xl px-5">
          {searchMutation.isPending ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative mb-6">
                <div className="absolute inset-0 animate-pulse rounded-full bg-primary blur-xl opacity-15" />
                <div className="relative rounded-full border border-border/70 bg-white p-4 shadow-sm">
                  <Sparkles className="h-10 w-10 animate-pulse text-primary" />
                </div>
              </div>
              <h3 className="mb-2 text-xl font-bold text-foreground">
                AI가 일치하는 게시물을 찾고 있어요
              </h3>
              <p className="text-muted-foreground">
                입력하신 특징과 이미지, 위치 정보를 종합적으로 분석 중입니다.
              </p>
            </div>
          ) : searchMutation.isSuccess && searchMutation.data ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="flex items-center gap-3 text-2xl font-bold text-foreground">
                    검색 결과
                    <span className="inline-flex items-center justify-center rounded-full bg-accent px-3 py-0.5 text-sm font-bold text-primary">
                      {searchMutation.data.length}건
                    </span>
                  </h2>
                  {isLocationFilterEnabled ? (
                    <span className="inline-flex items-center rounded-full border border-primary/15 bg-[hsl(var(--primary-light))] px-3 py-1 text-xs font-semibold text-primary">
                      지역 필터 적용 중
                    </span>
                  ) : null}
                </div>
              </div>

              {searchMutation.data.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-border/80 bg-secondary/35 py-20">
                  <div className="mb-4 rounded-full border border-border/70 bg-white p-4 shadow-sm">
                    <SearchIcon className="h-8 w-8 text-muted-foreground/55" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-foreground">
                    일치하는 물건이 없어요
                  </h3>
                  <p className="mb-8 max-w-sm text-center leading-relaxed text-muted-foreground">
                    설명을 조금 더 구체적으로 적어보시거나, 위치 범위를 넓혀서 다시 검색해보세요.
                  </p>
                  <Button
                    asChild
                    variant="outline"
                    className="h-11 rounded-full px-6 font-medium"
                  >
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
                        distanceText={
                          typeof result.distanceKm === "number"
                            ? formatDistance(result.distanceKm)
                            : undefined
                        }
                      />
                    ))}
                  </div>

                  <div className="mt-12 rounded-[28px] border border-primary/10 bg-[linear-gradient(180deg,hsl(var(--primary-light))_0%,white_100%)] p-8 text-center">
                    <h4 className="mb-2 text-lg font-bold text-foreground">
                      원하시는 물건을 찾지 못하셨나요?
                    </h4>
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
              <h3 className="mb-2 text-lg font-bold text-foreground">
                AI 검색을 시작해보세요
              </h3>
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
