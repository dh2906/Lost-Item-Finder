import { useState, useRef, type ChangeEvent } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, Sparkles, Loader2, MapPinned } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    .refine((value) => !value || /^01[0-9]{8,9}$/.test(value.replace(/-/g, "")), {
      message: "올바른 전화번호 형식이 아닙니다 (예: 01012345678)",
    }),
  tags: z.array(z.string()).optional(),
  imageUrl: z.string().optional(),
  reportType: z.enum(["found", "lost"]).default("found"),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;
type ReportType = "found" | "lost";

const config = {
  found: {
    locationLabel: "발견 장소",
    locationPlaceholder: "예: 중앙공원 분수대 앞",
    submitText: "습득물 신고하기",
    requireImage: true,
    title: "습득물 신고",
  },
  lost: {
    locationLabel: "분실 장소",
    locationPlaceholder: "예: 지하철 2호선 강남역",
    submitText: "분실물 신고하기",
    requireImage: false,
    title: "분실물 신고",
  },
};

export default function ReportPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getInitialReportType = (): ReportType => {
    const params = new URLSearchParams(window.location.search);
    return params.get("type") === "lost" ? "lost" : "found";
  };

  const [reportType] = useState<ReportType>(getInitialReportType);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

  const handleLocationChange = (location: { latitude: string; longitude: string }) => {
    form.setValue("latitude", location.latitude);
    form.setValue("longitude", location.longitude);
  };

  const processSelectedFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "이미지 파일만 업로드 가능합니다", variant: "destructive" });
      return;
    }

    try {
      setIsAnalyzing(true);
      const base64 = await optimizeImageForUpload(file);
      setImagePreview(base64);
      form.setValue("imageUrl", base64);

      const analysis = await analyzeMutation.mutateAsync({ imageUrl: base64 });

      form.setValue("itemCategory", analysis.itemCategory);
      form.setValue("color", analysis.color);
      form.setValue("size", analysis.size);
      form.setValue("description", analysis.description);
      form.setValue("tags", analysis.tags);

      if (!form.getValues("title")) {
        form.setValue("title", `${analysis.color} ${analysis.itemCategory}`);
      }

      toast({ title: "AI 분석 완료", description: "입력 가능한 정보를 먼저 채워 두었습니다." });
    } catch {
      toast({ title: "분석 실패", description: "직접 입력해도 괜찮습니다.", variant: "destructive" });
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

  const onSubmit = async (data: FormValues) => {
    if (reportType === "found" && !data.imageUrl) {
      toast({ title: "사진을 업로드해주세요", variant: "destructive" });
      return;
    }

    try {
      const result = await createMutation.mutateAsync({ ...data, reportType });
      toast({ title: "신고 완료", description: "게시물이 등록되었습니다." });
      setLocation(`/item/${result.id}`);
    } catch (error) {
      const description = error instanceof Error ? error.message : "제출 중 문제가 발생했습니다.";
      toast({ title: "제출 실패", description, variant: "destructive" });
    }
  };

  const currentConfig = config[reportType];

  return (
    <Layout>
      <div className="section-container">
        <div className="container max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-3">
              {currentConfig.title}
            </h1>
            <p className="text-muted-foreground">
              {currentConfig.requireImage
                ? "사진을 올리면 AI가 자동으로 정보를 채워드려요."
                : "설명과 위치만으로도 충분히 등록할 수 있어요."}
            </p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">사진 업로드</CardTitle>
                {currentConfig.requireImage && (
                  <p className="text-sm text-muted-foreground">
                    이 신고 유형은 사진이 필수입니다.
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                />
                <div
                  className={cn(
                    "relative min-h-[200px] rounded-lg border-2 border-dashed cursor-pointer transition-colors",
                    imagePreview ? "border-primary/50" : "border-muted-foreground/25 hover:border-muted-foreground/50"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="absolute inset-0 h-full w-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full py-8">
                      <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                      <p className="text-sm font-medium">클릭하여 사진 업로드</p>
                    </div>
                  )}
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center rounded-lg">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                      <p className="text-sm font-medium">AI 분석 중...</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">기본 정보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">제목 *</Label>
                  <Input
                    id="title"
                    placeholder="예: 검은색 가죽 지갑"
                    className="mt-1.5"
                    {...form.register("title")}
                  />
                  {form.formState.errors.title && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.title.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="itemCategory">카테고리</Label>
                    <Input
                      id="itemCategory"
                      placeholder="예: 지갑"
                      className="mt-1.5"
                      {...form.register("itemCategory")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="color">색상</Label>
                    <Input
                      id="color"
                      placeholder="예: 검정"
                      className="mt-1.5"
                      {...form.register("color")}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">상세 설명</Label>
                  <Textarea
                    id="description"
                    placeholder="브랜드, 모델명, 특징 등을 적어주세요"
                    className="mt-1.5 min-h-[100px]"
                    {...form.register("description")}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="location">{currentConfig.locationLabel}</Label>
                    <Input
                      id="location"
                      placeholder={currentConfig.locationPlaceholder}
                      className="mt-1.5"
                      {...form.register("location")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactInfo">연락처</Label>
                    <Input
                      id="contactInfo"
                      placeholder="010-1234-5678"
                      className="mt-1.5"
                      value={formatPhoneNumber(form.watch("contactInfo") || "")}
                      onChange={handlePhoneChange}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPinned className="h-5 w-5" />
                  위치 지정
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  지도를 클릭하여 위치를 지정하세요.
                </p>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <LocationPicker
                    value={
                      form.watch("latitude") && form.watch("longitude")
                        ? { latitude: form.watch("latitude") || "", longitude: form.watch("longitude") || "" }
                        : undefined
                    }
                    onChange={handleLocationChange}
                    height="250px"
                  />
                </div>
              </CardContent>
            </Card>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={createMutation.isPending || isAnalyzing}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  처리 중...
                </>
              ) : (
                currentConfig.submitText
              )}
            </Button>
          </form>
        </div>
      </div>
    </Layout>
  );
}