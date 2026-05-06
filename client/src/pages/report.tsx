import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Redirect, useLocation } from "wouter";
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
  PencilLine,
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
  MAX_ITEM_CONTACT_INFO_LENGTH,
  MAX_ITEM_COORDINATE_TEXT_LENGTH,
  MAX_ITEM_DESCRIPTION_LENGTH,
  MAX_ITEM_LOCATION_TEXT_LENGTH,
  MAX_ITEM_SHORT_TEXT_LENGTH,
  MAX_ITEM_TAG_COUNT,
  MAX_ITEM_TAG_LENGTH,
  MAX_ITEM_TITLE_LENGTH,
  MIN_ITEM_TITLE_LENGTH,
} from "@shared/item-limits";
import {
  MAX_ITEM_IMAGE_COUNT,
  MAX_ITEM_IMAGE_URL_LENGTH,
  normalizeItemImageUrls,
} from "@shared/item-images";

const formSchema = z.object({
  title: z
    .string()
    .min(MIN_ITEM_TITLE_LENGTH, `제목은 ${MIN_ITEM_TITLE_LENGTH}자 이상이어야 합니다.`)
    .max(MAX_ITEM_TITLE_LENGTH, `제목은 ${MAX_ITEM_TITLE_LENGTH}자 이내로 입력해 주세요.`),
  description: z.string().max(MAX_ITEM_DESCRIPTION_LENGTH).optional(),
  itemCategory: z.string().max(MAX_ITEM_SHORT_TEXT_LENGTH).optional(),
  color: z.string().max(MAX_ITEM_SHORT_TEXT_LENGTH).optional(),
  size: z.string().max(MAX_ITEM_SHORT_TEXT_LENGTH).optional(),
  location: z.string().max(MAX_ITEM_LOCATION_TEXT_LENGTH).optional(),
  contactInfo: z
    .string()
    .max(MAX_ITEM_CONTACT_INFO_LENGTH)
    .optional()
    .refine(
      (value) => !value || /^01[0-9]{8,9}$/.test(value.replace(/-/g, "")),
      {
        message: "올바른 전화번호 형식이 아닙니다. 예: 01012345678",
      }
    ),
  tags: z
    .array(z.string().max(MAX_ITEM_TAG_LENGTH))
    .max(MAX_ITEM_TAG_COUNT)
    .optional(),
  imageUrls: z
    .array(
      z
        .string()
        .max(
          MAX_ITEM_IMAGE_URL_LENGTH,
          "이미지 용량이 너무 큽니다. 더 작은 사진을 선택해 주세요."
        )
    )
    .max(MAX_ITEM_IMAGE_COUNT)
    .optional(),
  reportType: z.enum(["found", "lost"]).default("found"),
  address: z.string().max(MAX_ITEM_LOCATION_TEXT_LENGTH).optional(),
  placeName: z.string().max(MAX_ITEM_LOCATION_TEXT_LENGTH).optional(),
  latitude: z.string().max(MAX_ITEM_COORDINATE_TEXT_LENGTH).optional(),
  longitude: z.string().max(MAX_ITEM_COORDINATE_TEXT_LENGTH).optional(),
});

type FormValues = z.infer<typeof formSchema>;
type ReportType = "found" | "lost";
type ReportStep = 1 | 2 | 3 | 4;
type ReportPageProps = {
  forcedType?: ReportType;
  itemId?: number;
};
const reportStepSlugs: Record<ReportStep, string> = {
  1: "photo",
  2: "info",
  3: "location",
  4: "confirm",
};
const reportStepBySlug = Object.entries(reportStepSlugs).reduce(
  (acc, [step, slug]) => {
    acc[slug] = Number(step) as ReportStep;
    return acc;
  },
  {} as Record<string, ReportStep>
);

const config = {
  found: {
    locationLabel: "발견 장소",
    locationPlaceholder: "예: 중앙도서관 1층 앞",
    submitText: "주운 물건 등록하기",
    requireImage: true,
    title: "주운 물건 등록",
    description:
      "사진과 위치를 함께 등록하면 잃어버린 사람이 더 빨리 확인할 수 있어요.",
    gradient: "from-primary to-primary/80",
    badge: "bg-emerald-100 text-emerald-700",
  },
  lost: {
    locationLabel: "분실 장소",
    locationPlaceholder: "예: 학생회관 2층 복도",
    submitText: "잃어버린 물건 등록하기",
    requireImage: false,
    title: "잃어버린 물건 등록",
    description: "찾고 싶은 물건의 특징과 잃어버린 위치를 자세히 적어 주세요.",
    gradient: "from-primary to-primary/80",
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

function getInitialReportType(
  forcedType?: ReportType,
  pathname = window.location.pathname,
  search = window.location.search
): ReportType {
  if (forcedType) {
    return forcedType;
  }

  if (pathname === "/report/lost" || pathname.startsWith("/report/lost/")) {
    return "lost";
  }

  if (pathname === "/report/found" || pathname.startsWith("/report/found/")) {
    return "found";
  }

  const params = new URLSearchParams(search);
  return params.get("type") === "lost" ? "lost" : "found";
}

function getStepFromPath(pathname: string): ReportStep {
  const slug = pathname.split("/").filter(Boolean).at(-1) ?? "";
  return reportStepBySlug[slug] ?? 1;
}

function isReportFlowPath(pathname: string): boolean {
  return (
    pathname === "/report" ||
    pathname.startsWith("/report/") ||
    /^\/item\/\d+\/edit(?:\/|$)/.test(pathname)
  );
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

function ReviewField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-lg border border-border/65 bg-white px-3 py-2.5">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 break-keep text-sm font-semibold leading-6 text-foreground [word-break:keep-all]">
        {value?.trim() || "입력 안 함"}
      </p>
    </div>
  );
}

export default function ReportPage({ forcedType, itemId }: ReportPageProps) {
  const isEditMode = typeof itemId === "number" && itemId > 0;
  const [location, setLocation] = useLocation();
  const [pathname, search = ""] = location.split("?");
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: existingItem, isLoading: isItemLoading } = useItem(itemId ?? 0);
  const analyzeMutation = useAnalyzeImage();
  const createMutation = useCreateItem();
  const updateMutation = useUpdateItem();

  const [reportType, setReportType] = useState<ReportType>(() =>
    getInitialReportType(forcedType, pathname, search)
  );
  const [currentStep, setCurrentStep] = useState<ReportStep>(() =>
    getStepFromPath(pathname)
  );
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [completedItemId, setCompletedItemId] = useState<number | null>(null);
  const isFinalSubmitInFlightRef = useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reportType: getInitialReportType(forcedType, pathname, search),
      title: "",
      description: "",
      itemCategory: "",
      color: "",
      size: "",
      location: "",
      contactInfo: "",
      tags: [],
      imageUrls: [],
      address: "",
      placeName: "",
      latitude: "",
      longitude: "",
    },
  });

  const getReportStepPath = useCallback((step: ReportStep, targetType = reportType) => {
    const slug = reportStepSlugs[step];

    if (isEditMode && itemId) {
      return `/item/${itemId}/edit/${slug}`;
    }

    const basePath = forcedType ? `/report/${targetType}` : "/report";
    const queryString =
      !forcedType && targetType === "lost" ? "?type=lost" : "";
    return `${basePath}/${slug}${queryString}`;
  }, [forcedType, isEditMode, itemId, reportType]);

  const navigateToStep = (step: ReportStep) => {
    setCurrentStep(step);
    setLocation(getReportStepPath(step));
  };

  useEffect(() => {
    if (completedItemId !== null) {
      return;
    }

    const nextStep = getStepFromPath(location.split("?")[0]);
    setCurrentStep(nextStep);
  }, [completedItemId, location]);

  useEffect(() => {
    if (completedItemId !== null) {
      return;
    }

    const path = location.split("?")[0];
    if (!isReportFlowPath(path)) {
      return;
    }

    const hasExplicitStep =
      path.split("/").some((segment) => reportStepBySlug[segment] !== undefined);

    if (!hasExplicitStep) {
      setLocation(getReportStepPath(currentStep));
    }
  }, [completedItemId, currentStep, getReportStepPath, location, setLocation]);

  useEffect(() => {
    if (isEditMode) {
      return;
    }

    const nextReportType = getInitialReportType(forcedType, pathname, search);
    setReportType(nextReportType);
    form.setValue("reportType", nextReportType, {
      shouldDirty: false,
      shouldTouch: false,
    });
  }, [forcedType, form, isEditMode, pathname, search]);

  useEffect(() => {
    if (!isEditMode || !existingItem) {
      return;
    }

    const nextType = existingItem.reportType as ReportType;
    const nextImageUrls = normalizeItemImageUrls(existingItem);
    setReportType(nextType);
    setImagePreviews(nextImageUrls);
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
      address: existingItem.address ?? "",
      placeName: existingItem.placeName ?? "",
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
    address?: string;
    placeName?: string;
  }) => {
    form.setValue("latitude", nextLocation.latitude, {
      shouldDirty: true,
      shouldTouch: true,
    });
    form.setValue("longitude", nextLocation.longitude, {
      shouldDirty: true,
      shouldTouch: true,
    });

    if (nextLocation.address) {
      form.setValue("address", nextLocation.address, {
        shouldDirty: true,
        shouldTouch: true,
      });
      form.setValue("placeName", nextLocation.placeName ?? nextLocation.address, {
        shouldDirty: true,
        shouldTouch: true,
      });

      const currentLocationText = form.getValues("location")?.trim();
      if (!currentLocationText) {
        form.setValue("location", nextLocation.address, {
          shouldDirty: true,
          shouldTouch: true,
        });
      }
    }
  };

  const syncImagePreviews = (nextImages: string[]) => {
    setImagePreviews(nextImages);
    form.setValue("imageUrls", nextImages, {
      shouldDirty: true,
      shouldTouch: true,
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

  const analyzeUploadedImage = async (
    imageUrl: string,
    imageIndex: number,
    skippedCount: number,
    truncatedCount: number
  ) => {
    try {
      setIsAnalyzing(true);
      const analysis = await analyzeMutation.mutateAsync({ imageUrl });

      if (analysis.maskedImage) {
        const currentImages = form.getValues("imageUrls") ?? [];
        const nextImages = currentImages.map((currentImage, index) =>
          index === imageIndex ? analysis.maskedImage! : currentImage
        );
        syncImagePreviews(nextImages);
      }

      setFieldIfEmpty("itemCategory", analysis.itemCategory);
      setFieldIfEmpty("color", analysis.color);
      setFieldIfEmpty("size", analysis.size);
      setFieldIfEmpty("description", analysis.description);
      setFieldIfEmpty("tags", analysis.tags);

      if (!form.getValues("title")) {
        form.setValue(
          "title",
          `${analysis.color} ${analysis.itemCategory}`.trim(),
          { shouldDirty: true, shouldTouch: true }
        );
      }

      toast({
        title: "AI 분석 완료",
        description: "입력 가능한 정보를 먼저 채워 두었어요.",
      });

      if (skippedCount > 0 || truncatedCount > 0) {
        toast({
          title: "사진 업로드 일부가 제외됐어요.",
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
    const truncatedCount = imageFiles.length - filesToAdd.length;

    try {
      const optimizedImages = await Promise.all(
        filesToAdd.map((file) => optimizeImageForUpload(file))
      );
      const nextImages = [...currentImages, ...optimizedImages];
      syncImagePreviews(nextImages);

      toast({
        title: "사진을 추가했어요.",
        description: "다음 단계로 이동해도 AI 분석은 계속 진행됩니다.",
      });

      void analyzeUploadedImage(
        optimizedImages[0],
        firstAddedIndex,
        skippedCount,
        truncatedCount
      );
    } catch {
      toast({
        title: "이미지 처리에 실패했어요.",
        description: "다른 사진으로 다시 시도해 주세요.",
        variant: "destructive",
      });
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
    syncImagePreviews(nextImages);
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
    if (completedItemId !== null || isFinalSubmitInFlightRef.current) {
      return;
    }

    if (currentStep !== 4) {
      navigateToStep(4);
      return;
    }

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

    const isValid = await form.trigger();
    if (!isValid) {
      navigateToStep(2);
      return;
    }

    try {
      isFinalSubmitInFlightRef.current = true;

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
            address: data.address,
            placeName: data.placeName,
            latitude: data.latitude,
            longitude: data.longitude,
          },
        });

        toast({
          title: "게시글이 수정되었어요.",
          description: "변경 내용이 바로 반영되었어요.",
        });
        setCompletedItemId(itemId);
        setLocation(`/item/${itemId}`);
        return;
      }

      const createdItem = await createMutation.mutateAsync({
        ...data,
        reportType,
      });

      toast({
        title: "물건 정보가 등록되었어요.",
        description: "상세 페이지로 이동합니다.",
      });
      setCompletedItemId(createdItem.id);
      setLocation(`/item/${createdItem.id}`);
    } catch (error) {
      isFinalSubmitInFlightRef.current = false;
      const description =
        error instanceof Error ? error.message : "처리 중 문제가 발생했습니다.";

      toast({
        title: isEditMode ? "수정에 실패했어요." : "등록에 실패했어요.",
        description,
        variant: "destructive",
      });
    }
  };

  const goToNextStep = async () => {
    if (currentStep === 1) {
      if (reportType === "found" && imagePreviews.length === 0) {
        toast({
          title: "습득물 등록에는 사진이 필요해요.",
          description: "사진을 먼저 올린 뒤 다음 단계로 이동해 주세요.",
          variant: "destructive",
        });
        return;
      }
      navigateToStep(2);
      return;
    }

    if (currentStep === 2) {
      const isValid = await form.trigger("title");
      if (!isValid) {
        return;
      }
      navigateToStep(3);
      return;
    }

    if (currentStep === 3) {
      navigateToStep(4);
    }
  };

  const goToPreviousStep = () => {
    navigateToStep(Math.max(1, currentStep - 1) as ReportStep);
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

  if (completedItemId !== null) {
    return <Redirect to={`/item/${completedItemId}`} />;
  }

  const currentConfig = config[reportType];
  const isSubmitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    isAnalyzing ||
    isFinalSubmitInFlightRef.current ||
    completedItemId !== null;
  const pageTitle = isEditMode
    ? reportType === "found"
      ? "주운 물건 정보 수정"
      : "잃어버린 물건 정보 수정"
    : currentConfig.title;
  const pageDescription = isEditMode
    ? "기존 물건 정보를 수정하고 다시 저장할 수 있어요."
    : currentConfig.description;
  const submitLabel = isEditMode
    ? "수정 내용 저장하기"
    : currentConfig.submitText;
  const stepItems = [
    { step: 1 as const, label: "사진 업로드" },
    { step: 2 as const, label: "정보 입력" },
    { step: 3 as const, label: "위치 지정" },
    { step: 4 as const, label: "확인" },
  ];
  const currentStepLabel = stepItems.find((item) => item.step === currentStep)?.label;
  const reviewValues = form.watch();
  const reviewLocationText =
    [
      reviewValues.location,
      reviewValues.address,
      reviewValues.placeName,
    ]
      .filter((value) => value && value.trim().length > 0)
      .join(" / ") || "";
  const reviewCoordinateText =
    reviewValues.latitude && reviewValues.longitude
      ? `${reviewValues.latitude}, ${reviewValues.longitude}`
      : "";
  const reviewTagsText =
    reviewValues.tags && reviewValues.tags.length > 0
      ? reviewValues.tags.join(", ")
      : "";

  return (
    <Layout>
      <div className="container pb-28 pt-6 sm:pb-6 xl:max-w-[1440px]">
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
          className="space-y-5"
        >
          <div className="rounded-xl border border-border bg-white p-2 shadow-sm">
            <div className="grid grid-cols-4 gap-2">
              {stepItems.map((item) => (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => navigateToStep(item.step)}
                  className={cn(
                    "min-h-11 rounded-lg px-2 text-xs font-semibold transition-colors sm:text-sm",
                    currentStep === item.step
                      ? "bg-primary text-primary-foreground"
                      : item.step < currentStep
                        ? "bg-accent text-primary"
                        : "bg-secondary/60 text-muted-foreground"
                  )}
                >
                  <span className="block">STEP {item.step}</span>
                  <span className="mt-0.5 block truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {currentStep === 1 ? (
            <div className="mx-auto max-w-3xl min-w-0">
            <Card className="overflow-hidden">
              <CardHeader
                className={cn(
                  "border-b bg-gradient-to-br px-5 py-3 text-white",
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
                  사진을 올리면 카테고리와 색상을 자동으로 채울 수 있어요.
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
                            ? "정면이 잘 보이는 사진을 추천해요."
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
              </CardContent>
            </Card>
            </div>
          ) : null}

          {currentStep === 3 ? (
            <div className="mx-auto max-w-4xl min-w-0">
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-secondary/45 px-5 py-2.5">
                <div className="mb-1 inline-flex w-fit rounded-full border border-primary/10 bg-accent px-2.5 py-1 text-[11px] font-semibold text-primary">
                  3단계
                </div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <MapPinned className="h-4 w-4 text-primary" />
                  위치 지정
                </CardTitle>
                <CardDescription>
                  지도에서 위치를 찍어 두면 가까운 후보를 더 잘 찾습니다.
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
          ) : null}

          {currentStep === 2 ? (
          <div className="mx-auto max-w-4xl space-y-5 min-w-0">
            <Card className="border-primary/10 shadow-[0_18px_34px_-28px_rgba(27,31,59,0.16)]">
              <CardHeader className="border-b bg-secondary/45 px-5 py-2.5">
                <div className="mb-1 inline-flex w-fit rounded-full border border-primary/10 bg-accent px-2.5 py-1 text-[11px] font-semibold text-primary">
                  2단계
                </div>
                <CardTitle className="text-base font-semibold">
                  물건 정보 입력
                </CardTitle>
                {isAnalyzing ? (
                  <CardDescription className="flex items-center gap-2 text-primary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    사진 분석 중이에요. 입력하는 동안 자동으로 채워집니다.
                  </CardDescription>
                ) : null}
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
                    {reportType === "found" ? "습득 정보" : "분실 정보"}
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
                        연락처 <span className="text-muted-foreground">(선택)</span>
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
                        기본 연락은 채팅으로 이어지고, 전화번호는 필요할 때만 남겨 주세요.
                      </p>
                    </div>
                  </div>
                </section>
              </CardContent>
            </Card>

          </div>
          ) : null}

          {currentStep === 4 ? (
            <div className="mx-auto max-w-4xl min-w-0 space-y-5">
              <Card className="border-primary/14 bg-[linear-gradient(180deg,hsl(var(--primary-light))_0%,white_100%)] shadow-[0_22px_38px_-30px_hsl(var(--primary)/0.18)]">
                <CardHeader className="border-b border-primary/10 px-5 py-4">
                  <div className="mb-1 inline-flex w-fit rounded-full border border-primary/12 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-primary shadow-sm">
                    4단계
                  </div>
                  <CardTitle className="text-base font-semibold">
                    등록 전 마지막 확인
                  </CardTitle>
                  <CardDescription className="break-keep leading-6 [word-break:keep-all]">
                    아직 게시글은 등록되지 않았어요. 아래 내용이 맞으면 마지막 등록 버튼을 눌러 주세요.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 p-5">
                  <section className="space-y-3 rounded-xl border border-border/65 bg-white/82 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">
                        사진
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-lg"
                        onClick={() => navigateToStep(1)}
                      >
                        <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                        수정
                      </Button>
                    </div>
                    {imagePreviews.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {imagePreviews.map((imageUrl, index) => (
                          <div
                            key={`review-${imageUrl}-${index}`}
                            className="relative aspect-square overflow-hidden rounded-lg border border-border/70 bg-secondary"
                          >
                            <img
                              src={imageUrl}
                              alt={`등록 예정 이미지 ${index + 1}`}
                              className="h-full w-full object-cover"
                            />
                            {index === 0 ? (
                              <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                                대표
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-6 text-center text-sm text-muted-foreground">
                        등록할 사진이 없습니다.
                      </div>
                    )}
                  </section>

                  <section className="space-y-3 rounded-xl border border-border/65 bg-white/82 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">
                        물건 정보
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-lg"
                        onClick={() => navigateToStep(2)}
                      >
                        <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                        수정
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <ReviewField label="제목" value={reviewValues.title} />
                      <ReviewField
                        label="카테고리"
                        value={reviewValues.itemCategory}
                      />
                      <ReviewField label="색상" value={reviewValues.color} />
                      <ReviewField label="크기" value={reviewValues.size} />
                      <ReviewField
                        label="연락처"
                        value={
                          reviewValues.contactInfo
                            ? formatPhoneNumber(reviewValues.contactInfo)
                            : ""
                        }
                      />
                      <ReviewField label="태그" value={reviewTagsText} />
                    </div>
                    <ReviewField
                      label="상세 설명"
                      value={reviewValues.description}
                    />
                  </section>

                  <section className="space-y-3 rounded-xl border border-border/65 bg-white/82 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">
                        위치
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-lg"
                        onClick={() => navigateToStep(3)}
                      >
                        <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                        수정
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <ReviewField
                        label={currentConfig.locationLabel}
                        value={reviewLocationText}
                      />
                      <ReviewField
                        label="지도 좌표"
                        value={reviewCoordinateText}
                      />
                    </div>
                  </section>
                </CardContent>
              </Card>
            </div>
          ) : null}

          <div className="mx-auto flex max-w-4xl flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-lg px-5"
              onClick={goToPreviousStep}
              disabled={currentStep === 1 || isSubmitting}
            >
              이전
            </Button>
            <div className="flex items-center justify-end gap-3">
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {currentStep}단계: {currentStepLabel}
              </span>
              {currentStep < 4 ? (
                <Button
                  type="button"
                  className="h-11 min-w-[140px] rounded-lg px-5 font-semibold"
                  onClick={() => void goToNextStep()}
                >
                  다음
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="h-11 min-w-[180px] rounded-lg px-5 font-semibold"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
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
              )}
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
}
