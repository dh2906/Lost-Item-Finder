import { useEffect, useRef, useState, type ChangeEvent } from "react";
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
  AlertCircle,
  Images,
  X,
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
import { useCreateItem, useItem, useUpdateItem } from "@/hooks/use-items";
import { useAuth } from "@/hooks/use-auth";
import { optimizeImageForUpload, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { LocationPicker } from "@/components/location-picker";
import {
  MAX_ITEM_IMAGE_COUNT,
  normalizeItemImageUrls,
} from "@shared/item-images";

const formSchema = z.object({
  title: z.string().min(3, "제목은 3자 이상이어야 합니다."),
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
        message: "올바른 전화번호 형식이 아닙니다. 예: 01012345678",
      }
    ),
  tags: z.array(z.string()).optional(),
  imageUrls: z.array(z.string()).max(MAX_ITEM_IMAGE_COUNT).optional(),
  reportType: z.enum(["found", "lost"]).default("found"),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;
type ReportType = "found" | "lost";
type ReportPageProps = {
  forcedType?: ReportType;
  itemId?: number;
};

const config = {
  found: {
    locationLabel: "발견 장소",
    locationPlaceholder: "예: 중앙도서관 1층 앞",
    submitText: "습득물 등록하기",
    requireImage: true,
    title: "습득물 신고",
    description:
      "사진과 위치를 함께 등록하면 찾는 사람이 더 빨리 확인할 수 있어요.",
    gradient: "from-primary to-[hsl(270_68%_61%)]",
    badge: "bg-emerald-100 text-emerald-700",
  },
  lost: {
    locationLabel: "분실 장소",
    locationPlaceholder: "예: 학생회관 2층 복도",
    submitText: "분실물 신고하기",
    requireImage: false,
    title: "분실물 신고",
    description: "물건 특징과 잃어버린 위치를 자세히 적어 주세요.",
    gradient: "from-primary to-[hsl(270_68%_61%)]",
    badge: "bg-accent text-primary",
  },
} satisfies Record<
  ReportType,
  {
    locationLabel: string;
    locationPlaceholder: string;
    submitText: string;
    requireImage: boolean;
    title: string;
    description: string;
    gradient: string;
    badge: string;
  }
>;

function getInitialReportType(forcedType?: ReportType): ReportType {
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
}

function LoadingState() {
  return (
    <Layout>
      <div className="container py-6 xl:max-w-[1440px]">
        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="space-y-5">
            <div className="h-[340px] animate-pulse rounded-[24px] bg-muted" />
            <div className="h-[360px] animate-pulse rounded-[24px] bg-muted" />
          </div>
          <div className="h-[720px] animate-pulse rounded-[24px] bg-muted" />
        </div>
      </div>
    </Layout>
  );
}

export default function ReportPage({ forcedType, itemId }: ReportPageProps) {
  const isEditMode = typeof itemId === "number" && itemId > 0;
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: existingItem, isLoading: isItemLoading } = useItem(itemId ?? 0);
  const analyzeMutation = useAnalyzeImage();
  const createMutation = useCreateItem();
  const updateMutation = useUpdateItem();

  const [reportType, setReportType] = useState<ReportType>(() =>
    getInitialReportType(forcedType)
  );
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reportType: getInitialReportType(forcedType),
      title: "",
      description: "",
      itemCategory: "",
      color: "",
      size: "",
      location: "",
      contactInfo: "",
      tags: [],
      imageUrls: [],
      latitude: "",
      longitude: "",
    },
  });

  useEffect(() => {
    if (isEditMode) {
      return;
    }

    const nextReportType = getInitialReportType(forcedType);
    setReportType(nextReportType);
    form.setValue("reportType", nextReportType, {
      shouldDirty: false,
      shouldTouch: false,
    });
  }, [forcedType, form, isEditMode, location]);

  useEffect(() => {
    if (!isEditMode || !existingItem) {
      return;
    }

    const nextType = existingItem.reportType as ReportType;
    const nextImageUrls = normalizeItemImageUrls(existingItem);
    setReportType(nextType);
    setImagePreviews(nextImageUrls);
    setActiveImageIndex(0);
    form.reset({
      reportType: nextType,
      title: existingItem.title,
      description: existingItem.description ?? "",
      itemCategory: existingItem.itemCategory ?? "",
      color: existingItem.color ?? "",
      size: existingItem.size ?? "",
      location: existingItem.location ?? "",
      contactInfo: existingItem.contactInfo ?? "",
      tags: existingItem.tags ?? [],
      imageUrls: nextImageUrls,
      latitude: existingItem.latitude ?? "",
      longitude: existingItem.longitude ?? "",
    });
  }, [existingItem, form, isEditMode]);

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

  const handleLocationChange = (nextLocation: {
    latitude: string;
    longitude: string;
  }) => {
    form.setValue("latitude", nextLocation.latitude);
    form.setValue("longitude", nextLocation.longitude);
  };

  const syncImagePreviews = (nextImages: string[], preferredIndex?: number) => {
    setImagePreviews(nextImages);
    form.setValue("imageUrls", nextImages, {
      shouldDirty: true,
      shouldTouch: true,
    });
    setActiveImageIndex((currentIndex) => {
      if (nextImages.length === 0) {
        return 0;
      }

      if (typeof preferredIndex === "number") {
        return Math.min(preferredIndex, nextImages.length - 1);
      }

      return Math.min(currentIndex, nextImages.length - 1);
    });
  };

  const setFieldIfEmpty = (
    field: "itemCategory" | "color" | "size" | "description" | "tags",
    value: string | string[]
  ) => {
    const currentValue = form.getValues(field) as string | string[] | undefined;
    const isEmptyArray =
      Array.isArray(currentValue) && currentValue.length === 0;
    const isEmptyString =
      typeof currentValue === "string" && currentValue.trim().length === 0;

    if (
      (currentValue === undefined || isEmptyArray || isEmptyString) &&
      value !== undefined
    ) {
      form.setValue(field, value as never, {
        shouldDirty: true,
        shouldTouch: true,
      });
    }
  };

  const processSelectedFiles = async (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    const skippedCount = files.length - imageFiles.length;

    if (imageFiles.length === 0) {
      toast({
        title: "이미지 파일만 업로드할 수 있어요.",
        variant: "destructive",
      });
      return;
    }

    const currentImages = form.getValues("imageUrls") ?? [];
    const remainingSlots = MAX_ITEM_IMAGE_COUNT - currentImages.length;

    if (remainingSlots <= 0) {
      toast({
        title: `이미지는 최대 ${MAX_ITEM_IMAGE_COUNT}장까지 올릴 수 있어요.`,
        variant: "destructive",
      });
      return;
    }

    const filesToAdd = imageFiles.slice(0, remainingSlots);
    const firstAddedIndex = currentImages.length;

    try {
      setIsAnalyzing(true);
      const optimizedImages = await Promise.all(
        filesToAdd.map((file) => optimizeImageForUpload(file))
      );
      let nextImages = [...currentImages, ...optimizedImages];
      syncImagePreviews(nextImages, firstAddedIndex);

      const analysis = await analyzeMutation.mutateAsync({
        imageUrl: optimizedImages[0],
      });

      if (analysis.maskedImage) {
        nextImages = nextImages.map((imageUrl, index) =>
          index === firstAddedIndex ? analysis.maskedImage! : imageUrl
        );
        syncImagePreviews(nextImages, firstAddedIndex);
      }

      setFieldIfEmpty("itemCategory", analysis.itemCategory);
      setFieldIfEmpty("color", analysis.color);
      setFieldIfEmpty("size", analysis.size);
      setFieldIfEmpty("description", analysis.description);
      setFieldIfEmpty("tags", analysis.tags);

      if (!form.getValues("title")) {
        form.setValue(
          "title",
          `${analysis.color} ${analysis.itemCategory}`.trim()
        );
      }

      toast({
        title: "AI 분석 완료",
        description: "입력 가능한 정보를 먼저 채워 두었어요.",
      });

      if (skippedCount > 0 || filesToAdd.length < imageFiles.length) {
        toast({
          title: `${nextImages.length}장의 사진을 저장했어요.`,
          description:
            skippedCount > 0
              ? "이미지가 아닌 파일은 제외했어요."
              : `최대 ${MAX_ITEM_IMAGE_COUNT}장까지만 등록할 수 있어요.`,
        });
      }
    } catch {
      toast({
        title: "이미지 분석에 실패했어요.",
        description: "필드는 직접 수정해도 괜찮아요.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    await processSelectedFiles(files);
    e.target.value = "";
  };

  const handleRemoveImage = (indexToRemove: number) => {
    const nextImages = imagePreviews.filter(
      (_, index) => index !== indexToRemove
    );
    syncImagePreviews(nextImages, Math.max(0, indexToRemove - 1));
  };

  const handleSetPrimaryImage = (indexToPromote: number) => {
    if (indexToPromote <= 0 || indexToPromote >= imagePreviews.length) {
      return;
    }

    const nextImages = [...imagePreviews];
    const [selectedImage] = nextImages.splice(indexToPromote, 1);
    nextImages.unshift(selectedImage);
    syncImagePreviews(nextImages);
  };

  const onSubmit = async (data: FormValues) => {
    if (
      reportType === "found" &&
      (!data.imageUrls || data.imageUrls.length === 0)
    ) {
      toast({
        title: "습득물 등록에는 사진이 필요해요.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (isEditMode && itemId) {
        await updateMutation.mutateAsync({
          itemId,
          data: {
            title: data.title,
            description: data.description,
            itemCategory: data.itemCategory,
            color: data.color,
            size: data.size,
            location: data.location,
            contactInfo: data.contactInfo,
            tags: data.tags,
            imageUrls: data.imageUrls,
            latitude: data.latitude,
            longitude: data.longitude,
          },
        });

        toast({
          title: "게시글이 수정되었어요.",
          description: "변경 내용이 바로 반영되었어요.",
        });
        setLocation(`/item/${itemId}`);
        return;
      }

      const createdItem = await createMutation.mutateAsync({
        ...data,
        reportType,
      });

      toast({
        title: "게시글이 등록되었어요.",
        description: "상세 페이지로 이동합니다.",
      });
      setLocation(`/item/${createdItem.id}`);
    } catch (error) {
      const description =
        error instanceof Error ? error.message : "처리 중 문제가 발생했습니다.";

      toast({
        title: isEditMode ? "수정에 실패했어요." : "등록에 실패했어요.",
        description,
        variant: "destructive",
      });
    }
  };

  if (isEditMode && isItemLoading) {
    return <LoadingState />;
  }

  if (isEditMode && !existingItem) {
    return (
      <Layout>
        <div className="container max-w-xl py-16">
          <Card>
            <CardContent className="space-y-4 py-10 text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground" />
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold">
                  게시글을 찾을 수 없어요.
                </h1>
                <p className="text-sm text-muted-foreground">
                  이미 삭제되었거나 접근할 수 없는 게시글입니다.
                </p>
              </div>
              <Button asChild>
                <a href="/mypage">마이페이지로 돌아가기</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (isEditMode && existingItem && existingItem.userId !== user?.id) {
    return (
      <Layout>
        <div className="container max-w-xl py-16">
          <Card>
            <CardContent className="space-y-4 py-10 text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground" />
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold">
                  내 게시글만 수정할 수 있어요.
                </h1>
                <p className="text-sm text-muted-foreground">
                  이 게시글은 현재 로그인한 계정이 작성한 글이 아닙니다.
                </p>
              </div>
              <Button asChild>
                <a href={`/item/${itemId}`}>게시글로 돌아가기</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const currentConfig = config[reportType];
  const isSubmitting =
    createMutation.isPending || updateMutation.isPending || isAnalyzing;
  const pageTitle = isEditMode
    ? reportType === "found"
      ? "습득물 게시글 수정"
      : "분실물 게시글 수정"
    : currentConfig.title;
  const pageDescription = isEditMode
    ? "기존 게시글 내용을 수정하고 다시 저장할 수 있어요."
    : currentConfig.description;
  const submitLabel = isEditMode
    ? "수정 내용 저장하기"
    : currentConfig.submitText;

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
            href={isEditMode && itemId ? `/item/${itemId}` : "/"}
            onClick={(e) => {
              e.preventDefault();
              setLocation(isEditMode && itemId ? `/item/${itemId}` : "/");
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
            {isEditMode && (
              <span className="inline-flex items-center rounded-full border border-border/70 bg-white px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                게시글 수정
              </span>
            )}
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight sm:text-[1.85rem]">
              {pageTitle}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {pageDescription}
            </p>
          </div>
        </div>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-5 min-w-0 xl:grid-cols-[380px_minmax(0,1fr)] xl:items-start"
        >
          <div className="space-y-4 min-w-0 xl:sticky xl:top-24">
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
                  사진을 올리면 AI가 물건 특징을 먼저 분석해 줍니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                />
                <div className="space-y-3">
                  <div className="rounded-[18px] border border-border/70 bg-secondary/30 p-3.5">
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-primary shadow-sm">
                        <Images className="h-3.5 w-3.5" />
                        {imagePreviews.length}/{MAX_ITEM_IMAGE_COUNT}
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        첫 번째 사진이 대표 이미지로 사용돼요.
                      </p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        정면이 잘 보이는 사진을 먼저 올리고, 다른 썸네일을
                        누르면 대표 이미지를 바로 바꿀 수 있어요.
                      </p>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "grid gap-3",
                      imagePreviews.length === 0
                        ? "grid-cols-1"
                        : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-2"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "group relative overflow-hidden rounded-[18px] border transition-all",
                        imagePreviews.length === 0
                          ? "aspect-[16/9] border-dashed border-primary/35 bg-[linear-gradient(180deg,hsl(var(--primary-light))_0%,white_100%)] hover:border-primary/55"
                          : "aspect-square border-border/70 bg-white hover:border-primary/45 hover:shadow-md"
                      )}
                    >
                      <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                        <div className="mb-2 rounded-full bg-[hsl(var(--primary-light))] p-2.5 text-primary shadow-sm transition-transform group-hover:scale-105">
                          <Upload className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {imagePreviews.length === 0
                            ? "사진 등록하기"
                            : "사진 추가"}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {imagePreviews.length === 0
                            ? "큰 빈 영역 없이 썸네일 카드로 정리돼요."
                            : "최대 10장까지 업로드할 수 있어요."}
                        </p>
                      </div>
                    </button>

                    {imagePreviews.map((imageUrl, index) => (
                      <div
                        key={`${imageUrl}-${index}`}
                        className="group relative aspect-square overflow-hidden rounded-[22px] border border-border/70 bg-white shadow-sm"
                      >
                        <button
                          type="button"
                          onClick={() => handleSetPrimaryImage(index)}
                          className="h-full w-full"
                          aria-label={
                            index === 0
                              ? "대표 이미지"
                              : `${index + 1}번 이미지를 대표 이미지로 설정`
                          }
                        >
                          <img
                            src={imageUrl}
                            alt={`업로드한 이미지 ${index + 1}`}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        </button>
                        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
                          {index === 0 ? (
                            <span className="rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white">
                              대표 이미지
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetPrimaryImage(index)}
                              className="rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              대표로 설정
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(index)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/92 text-foreground shadow-sm transition hover:bg-white"
                            aria-label={`${index + 1}번 이미지 제거`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs leading-5 text-muted-foreground">
                    이미지 비율은 썸네일 카드로 정리되고, 상세 보기에서는 원본
                    비율에 맞춰 표시돼요.
                  </p>

                  {isAnalyzing ? (
                    <div className="rounded-[22px] border border-primary/15 bg-background/90 px-4 py-6 text-center shadow-sm backdrop-blur-sm">
                      <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm font-semibold text-foreground">
                        AI가 사진을 분석하고 있어요.
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        카테고리와 색상 같은 정보를 자동으로 채우는 중입니다.
                      </p>
                    </div>
                  ) : null}
                </div>
                <div className="hidden">
                  {imagePreviews.length > 0 ? (
                    <div className="flex h-full flex-col">
                      <div className="relative flex-1 overflow-hidden">
                        <img
                          src={imagePreviews[activeImageIndex]}
                          alt={`업로드 미리보기 ${activeImageIndex + 1}`}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                        <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/65 px-3 py-1 text-xs font-medium text-white">
                          <Images className="h-3.5 w-3.5" />
                          {imagePreviews.length} / {MAX_ITEM_IMAGE_COUNT}
                        </div>
                        <div className="absolute bottom-3 right-3 rounded-full bg-black/65 px-3 py-1 text-xs font-medium text-white">
                          대표 사진은 첫 번째 이미지예요
                        </div>
                      </div>

                      <div
                        className="flex gap-2 overflow-x-auto border-t border-white/30 bg-black/15 p-3 backdrop-blur-sm"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {imagePreviews.map((imageUrl, index) => (
                          <div
                            key={`${imageUrl}-${index}`}
                            className="relative shrink-0"
                          >
                            <button
                              type="button"
                              onClick={() => setActiveImageIndex(index)}
                              className={cn(
                                "overflow-hidden rounded-2xl border-2 transition-all",
                                index === activeImageIndex
                                  ? "border-white shadow-lg"
                                  : "border-white/35 hover:border-white/70"
                              )}
                              aria-label={`${index + 1}번째 이미지 선택`}
                            >
                              <img
                                src={imageUrl}
                                alt={`썸네일 ${index + 1}`}
                                className="h-16 w-16 object-cover"
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(index)}
                              className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/60 bg-white/95 text-foreground shadow-sm hover:bg-white"
                              aria-label={`${index + 1}번째 이미지 삭제`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                            {index === 0 ? (
                              <span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                                대표
                              </span>
                            ) : null}
                          </div>
                        ))}

                        {imagePreviews.length < MAX_ITEM_IMAGE_COUNT ? (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-dashed border-white/60 bg-white/20 text-white transition-colors hover:bg-white/30"
                            aria-label="이미지 추가"
                          >
                            <Upload className="h-5 w-5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center py-7 text-center">
                      <div className="mb-1.5 rounded-full bg-background p-3 shadow-sm">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-semibold leading-none">
                        클릭해서 사진 업로드
                      </p>
                      <p className="mt-0.5 text-xs leading-[1.4] text-muted-foreground">
                        정면이 잘 보이는 사진일수록 분석이 더 정확해져요.
                      </p>
                    </div>
                  )}
                  {isAnalyzing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
                      <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" />
                      <p className="text-sm font-semibold">AI 분석 중...</p>
                      <p className="text-xs text-muted-foreground">
                        사진을 읽고 있어요.
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
                  지도에서 위치를 찍어 두면 AI 매칭에 도움이 됩니다.
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

          <div className="space-y-5 min-w-0">
            <Card className="border-primary/10 shadow-[0_18px_34px_-28px_rgba(27,31,59,0.16)]">
              <CardHeader className="border-b bg-secondary/45 px-5 py-2.5">
                <div className="mb-1 inline-flex w-fit rounded-full border border-primary/10 bg-accent px-2.5 py-1 text-[11px] font-semibold text-primary">
                  3단계
                </div>
                <CardTitle className="text-base font-semibold">
                  게시글 정보 입력
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-5 pt-3">
                <section className="space-y-4 rounded-[22px] border border-border/60 bg-white/72 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    물건 기본 정보
                  </p>

                  <div>
                    <Label htmlFor="title" className="text-sm font-semibold">
                      제목 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="title"
                      placeholder="예: 검은색 카드지갑"
                      className="mt-2 rounded-xl border-border/85 placeholder:text-slate-800/80 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/38 focus-visible:ring-offset-0"
                      {...form.register("title")}
                    />
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
                      placeholder="예: 카드 2장과 학생증이 들어 있는 작은 반지갑이에요."
                      className="min-h-[132px] resize-none rounded-xl border-border/85 px-4 py-3.5 placeholder:text-slate-800/80 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/38 focus-visible:ring-offset-0"
                      {...form.register("description")}
                    />
                    <p className="mt-1.5 text-xs text-slate-500">
                      특징이 자세할수록 찾기 쉬워져요.
                    </p>
                  </div>
                </section>

                <section className="space-y-4 rounded-[22px] border border-border/60 bg-white/72 px-4 pb-3.5 pt-4">
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
                        연락 가능한 번호를 남겨 주세요.
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
                    입력 내용을 확인해 주세요.
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    저장하면 마이페이지와 상세 페이지에서 바로 확인할 수 있어요.
                  </p>
                </div>
                <Button
                  type="submit"
                  className="h-[3.2rem] rounded-full px-9 text-base font-semibold shadow-[0_22px_32px_-18px_hsl(var(--primary)/0.54)] transition-all hover:-translate-y-0.5 hover:shadow-[0_26px_38px_-18px_hsl(var(--primary)/0.6)] disabled:translate-y-0 disabled:shadow-none disabled:opacity-60 sm:ml-6 sm:min-w-[240px]"
                  size="lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      처리 중...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {submitLabel}
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
