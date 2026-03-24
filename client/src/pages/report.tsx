import {
  useCallback,
  useEffect,
  useState,
  useRef,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Upload,
  Loader2,
  MapPinned,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useAnalyzeImage } from "@/hooks/use-ai";
import { optimizeImageForUpload, cn } from "@/lib/utils";
import { useCreateItem as useSaveItem } from "@/hooks/use-items";
import { useToast } from "@/hooks/use-toast";
import { LocationPicker } from "@/components/location-picker";

const formSchema = z.object({
  title: z.string().min(3, "제목은 3자 이상이어야 합니다"),
  description: z.string().optional(),
  itemCategory: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  location: z.string().optional(),
  contactInfo: z
    .string()
    .optional()
    .refine(
      (value) => !value || /^01[0-9]{8,9}$/.test(value.replace(/-/g, "")),
      {
        message: "올바른 전화번호 형식이 아닙니다 (예: 01012345678)",
      }
    ),
  tags: z.array(z.string()).optional(),
  imageUrl: z.string().optional(),
  reportType: z.enum(["found", "lost"]).default("found"),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;
type ReportType = "found" | "lost";
type ReportPageProps = {
  forcedType?: ReportType;
};

const config = {
  found: {
    locationLabel: "발견 장소",
    locationPlaceholder: "예: 중앙공원 분수대 앞",
    submitText: "습득물 신고하기",
    requireImage: true,
    title: "습득물 신고",
    description: "사진과 위치를 함께 등록해 주세요.",
    guidance: "사진, 위치, 물건 정보를 순서대로 입력해 주세요.",
    gradient: "from-primary to-[hsl(270_68%_61%)]",
    badge: "bg-emerald-100 text-emerald-700",
  },
  lost: {
    locationLabel: "분실 장소",
    locationPlaceholder: "예: 지하철 2호선 강남역",
    submitText: "분실물 신고하기",
    requireImage: false,
    title: "분실물 신고",
    description: "물건 정보와 분실 위치를 입력해 신고를 완료해 주세요.",
    guidance: "사진, 위치, 물건 정보를 순서대로 입력해 주세요.",
    gradient: "from-primary to-[hsl(270_68%_61%)]",
    badge: "bg-accent text-primary",
  },
};

export default function ReportPage({ forcedType }: ReportPageProps) {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasUserEditedTitleRef = useRef(false);

  const getInitialReportType = (): ReportType => {
    if (forcedType) {
      return forcedType;
    }

    if (window.location.pathname === "/report/lost") {
      return "lost";
    }

    if (window.location.pathname === "/report/found") {
      return "found";
    }

    const params = new URLSearchParams(window.location.search);
    return params.get("type") === "lost" ? "lost" : "found";
  };

  const [reportType, setReportType] =
    useState<ReportType>(getInitialReportType);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [latestAnalyzedTitle, setLatestAnalyzedTitle] = useState<string>("");

  const analyzeMutation = useAnalyzeImage();
  const createMutation = useSaveItem();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reportType: getInitialReportType(),
      title: "",
      description: "",
      itemCategory: "",
      color: "",
      size: "",
      location: "",
      contactInfo: "",
      tags: [],
      imageUrl: "",
      latitude: "",
      longitude: "",
    },
  });
  const titleField = form.register("title");

  useEffect(() => {
    const nextReportType = getInitialReportType();
    setReportType(nextReportType);
    form.setValue("reportType", nextReportType, {
      shouldDirty: false,
      shouldTouch: false,
    });
  }, [forcedType, form, location]);

  const formatPhoneNumber = (value: string): string => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    form.setValue("contactInfo", formatted.replace(/-/g, ""));
  };

  const handleLocationChange = useCallback(
    (location: { latitude: string; longitude: string }) => {
      form.setValue("latitude", location.latitude);
      form.setValue("longitude", location.longitude);
    },
    [form]
  );

  const processSelectedFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "이미지 파일만 업로드 가능합니다",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAnalyzing(true);
      const base64 = await optimizeImageForUpload(file);
      setImagePreview(base64);
      form.setValue("imageUrl", base64);

      const analysis = await analyzeMutation.mutateAsync({ imageUrl: base64 });

      const responseData = analysis as any;
      if (responseData.maskedImage) {
        setImagePreview(responseData.maskedImage);
        form.setValue("imageUrl", responseData.maskedImage);
      }

      form.setValue("itemCategory", analysis.itemCategory);
      form.setValue("color", analysis.color);
      form.setValue("size", analysis.size);
      form.setValue("description", analysis.description);
      form.setValue("tags", analysis.tags);

      const suggestedTitle =
        analysis.title || `${analysis.color} ${analysis.itemCategory}`;
      setLatestAnalyzedTitle(suggestedTitle);

      if (!hasUserEditedTitleRef.current) {
        form.setValue("title", suggestedTitle);
      }

      toast({
        title: "AI 분석 완료",
        description: "입력 가능한 정보를 먼저 채워 두었습니다.",
      });
    } catch {
      toast({
        title: "분석 실패",
        description: "직접 입력해도 괜찮습니다.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processSelectedFile(file);
    e.target.value = "";
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
    if (!file) return;

    await processSelectedFile(file);
  };

  const onSubmit = async (data: FormValues) => {
    if (reportType === "found" && !data.imageUrl) {
      toast({ title: "사진을 업로드해주세요", variant: "destructive" });
      return;
    }

    try {
      const result = await createMutation.mutateAsync({ ...data, reportType });
      const matchDescription =
        result.reportType === "found" && result.automaticMatchCount
          ? `게시물이 등록되었고 ${result.automaticMatchCount}개의 자동 매칭 후보를 저장했어요.`
          : "게시물이 등록되었습니다.";
      toast({ title: "신고 완료", description: matchDescription });
      setLocation(`/item/${result.id}`);
    } catch (error) {
      const description =
        error instanceof Error ? error.message : "제출 중 문제가 발생했습니다.";
      toast({ title: "제출 실패", description, variant: "destructive" });
    }
  };

  const currentConfig = config[reportType];

  return (
    <Layout>
      <div className="container py-6 xl:max-w-[1440px]">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="mb-2 h-auto px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setLocation("/");
            }}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            돌아가기
          </a>
        </Button>

        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                currentConfig.badge
              )}
            >
              {reportType === "found" ? "습득" : "분실"}
            </span>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight sm:text-[1.85rem]">
              {currentConfig.title}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {currentConfig.description}
            </p>
          </div>
        </div>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)] xl:items-start"
        >
          <div className="space-y-5 xl:sticky xl:top-24">
            <Card className="overflow-hidden">
              <CardHeader
                className={cn(
                  "border-b bg-gradient-to-br px-5 py-1.5 text-white",
                  currentConfig.gradient
                )}
              >
                <div className="mb-1 inline-flex w-fit rounded-full border border-white/15 bg-white/12 px-2.5 py-1 text-[11px] font-semibold text-white/88">
                  1단계
                </div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Upload className="h-4 w-4" />
                  사진 업로드
                </CardTitle>
                <CardDescription className="text-white/64">
                  {currentConfig.requireImage
                    ? "먼저 사진을 올리면 입력이 더 쉬워져요."
                    : "사진이 있으면 물건 특징을 더 정확하게 전달할 수 있어요."}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                />
                <div
                  className={cn(
                    "relative min-h-[240px] cursor-pointer overflow-hidden rounded-[22px] border-2 border-dashed transition-all xl:min-h-[300px]",
                    isDragActive && "border-primary bg-primary/10 shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]",
                    imagePreview
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 bg-muted/50 hover:border-primary/50 hover:bg-muted"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="absolute inset-0 h-full w-full rounded-[22px] object-cover"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center py-7 text-center">
                      <div className="mb-1.5 rounded-full bg-background p-3 shadow-sm">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-semibold leading-none">
                        클릭하거나 드래그해서 사진 업로드
                      </p>
                      <p className="mt-0.5 text-xs leading-[1.4] text-muted-foreground">
                        정면이 잘 보이는 사진일수록 정확도가 높아요.
                      </p>
                    </div>
                  )}
                  {isAnalyzing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[22px] bg-background/90 backdrop-blur-sm">
                      <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" />
                      <p className="text-sm font-semibold">AI 분석 중...</p>
                      <p className="text-xs text-muted-foreground">
                        사진을 분석하고 있어요
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-secondary/45 px-5 py-2.5">
                <div className="mb-1 inline-flex w-fit rounded-full border border-primary/10 bg-accent px-2.5 py-1 text-[11px] font-semibold text-primary">
                  2단계
                </div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <MapPinned className="h-4 w-4 text-primary" />
                  위치 지정
                </CardTitle>
                <CardDescription>
                  발견 위치를 먼저 지정해 주세요.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <div className="overflow-hidden rounded-[22px] border border-border/70 shadow-card">
                  <LocationPicker
                    value={
                      form.watch("latitude") && form.watch("longitude")
                        ? {
                            latitude: form.watch("latitude") || "",
                            longitude: form.watch("longitude") || "",
                          }
                        : undefined
                    }
                    onChange={handleLocationChange}
                    height="280px"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card className="border-primary/10 shadow-[0_18px_34px_-28px_rgba(27,31,59,0.16)]">
              <CardHeader className="border-b bg-secondary/45 px-5 py-2.5">
                <div className="mb-1 inline-flex w-fit rounded-full border border-primary/10 bg-accent px-2.5 py-1 text-[11px] font-semibold text-primary">
                  3단계
                </div>
                <CardTitle className="text-base font-semibold">
                  기본 정보
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-5 pt-3">
                <section className="space-y-4 rounded-[22px] border border-border/60 bg-white/72 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    물건 식별 정보
                  </p>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="title" className="text-sm font-semibold">
                        제목 <span className="text-destructive">*</span>
                      </Label>
                      {latestAnalyzedTitle ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto px-0 text-xs font-medium text-primary hover:bg-transparent hover:text-primary/80"
                          onClick={() => {
                            hasUserEditedTitleRef.current = false;
                            form.setValue("title", latestAnalyzedTitle, {
                              shouldDirty: true,
                              shouldTouch: true,
                            });
                          }}
                        >
                          AI 제목 다시 적용
                        </Button>
                      ) : null}
                    </div>
                    <Input
                      id={titleField.name}
                      placeholder="예: 검은색 가죽 지갑"
                      className="mt-2 rounded-xl border-border/85 placeholder:text-slate-800/80 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/38 focus-visible:ring-offset-0"
                      name={titleField.name}
                      ref={titleField.ref}
                      onBlur={titleField.onBlur}
                      onChange={(event) => {
                        hasUserEditedTitleRef.current = true;
                        titleField.onChange(event);
                      }}
                    />
                    {latestAnalyzedTitle && form.getValues("title") !== latestAnalyzedTitle ? (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        최신 AI 추천 제목: {latestAnalyzedTitle}
                      </p>
                    ) : null}
                    {form.formState.errors.title && (
                      <p className="mt-1.5 text-sm text-destructive">
                        {form.formState.errors.title.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <Label
                        htmlFor="itemCategory"
                        className="text-sm font-semibold"
                      >
                        카테고리
                      </Label>
                      <Input
                        id="itemCategory"
                        placeholder="예: 지갑"
                        className="mt-2 rounded-xl border-border/85 placeholder:text-slate-800/80 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/38 focus-visible:ring-offset-0"
                        {...form.register("itemCategory")}
                      />
                    </div>
                    <div>
                      <Label htmlFor="color" className="text-sm font-semibold">
                        색상
                      </Label>
                      <Input
                        id="color"
                        placeholder="예: 검정"
                        className="mt-2 rounded-xl border-border/85 placeholder:text-slate-800/80 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/38 focus-visible:ring-offset-0"
                        {...form.register("color")}
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-4 rounded-[22px] border border-border/60 bg-white/72 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    상세 설명
                  </p>

                  <div>
                    <Textarea
                      id="description"
                      placeholder="예: 검은색 가죽 재질, 카드 수납칸 있음, 작은 로고가 있음"
                      className="min-h-[132px] resize-none rounded-xl border-border/85 px-4 py-3.5 placeholder:text-slate-800/80 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/38 focus-visible:ring-offset-0"
                      {...form.register("description")}
                    />
                    <p className="mt-1.5 text-xs text-slate-500">
                      구분 가능한 특징을 적어주세요.
                    </p>
                  </div>
                </section>

                <section className="space-y-4 rounded-[22px] border border-border/60 bg-white/72 px-4 pt-4 pb-3.5">
                  <p className="text-sm font-semibold text-foreground">
                    발견 정보
                  </p>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <Label
                        htmlFor="location"
                        className="text-sm font-semibold"
                      >
                        {currentConfig.locationLabel}
                      </Label>
                      <Input
                        id="location"
                        placeholder={currentConfig.locationPlaceholder}
                        className="mt-2 rounded-xl border-border/85 placeholder:text-slate-800/80 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/38 focus-visible:ring-offset-0"
                        {...form.register("location")}
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="contactInfo"
                        className="text-sm font-semibold"
                      >
                        연락처
                      </Label>
                      <Input
                        id="contactInfo"
                        placeholder="010-1234-5678"
                        className="mt-2 rounded-xl border-border/85 placeholder:text-slate-800/80 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/38 focus-visible:ring-offset-0"
                        value={formatPhoneNumber(
                          form.watch("contactInfo") || ""
                        )}
                        onChange={handlePhoneChange}
                      />
                      <p className="mt-1.5 pl-0.5 text-[12px] leading-5 text-muted-foreground">
                        주인이 연락할 수 있는 번호를 입력해 주세요.
                      </p>
                    </div>
                  </div>
                </section>
              </CardContent>
            </Card>

            <Card className="border-primary/14 bg-[linear-gradient(180deg,hsl(var(--primary-light))_0%,white_100%)] shadow-[0_22px_38px_-30px_hsl(var(--primary)/0.18)]">
              <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
                <div className="max-w-lg space-y-1">
                  <div className="mb-2 inline-flex w-fit rounded-full border border-primary/12 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-primary shadow-sm">
                    4단계
                  </div>
                  <p className="text-base font-semibold text-foreground">
                    입력 내용을 확인해 주세요
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    사진, 위치, 연락처를 다시 확인한 뒤 신고를 완료해 주세요.
                  </p>
                </div>
                <Button
                  type="submit"
                  className="h-[3.2rem] rounded-full px-9 text-base font-semibold shadow-[0_22px_32px_-18px_hsl(var(--primary)/0.54)] transition-all hover:-translate-y-0.5 hover:shadow-[0_26px_38px_-18px_hsl(var(--primary)/0.6)] disabled:translate-y-0 disabled:shadow-none disabled:opacity-60 sm:min-w-[240px] sm:ml-6"
                  size="lg"
                  disabled={createMutation.isPending || isAnalyzing}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      처리 중...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {currentConfig.submitText}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </form>
      </div>
    </Layout>
  );
}
