import { useState, useRef, type ChangeEvent } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, Sparkles, Loader2 } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAnalyzeImage } from "@/hooks/use-ai";
import { optimizeImageForUpload, cn } from "@/lib/utils";
import { useCreateItem as useSaveItem } from "@/hooks/use-items";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
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
      (val) => !val || /^01[0-9]{8,9}$/.test(val.replace(/-/g, "")),
      { message: "올바른 전화번호 형식이 아닙니다 (예: 01012345678)" }
    ),
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
    submitText: "신고하기",
    requireImage: true,
  },
  lost: {
    locationLabel: "분실 장소",
    locationPlaceholder: "예: 지하철 2호선 강남역",
    submitText: "신고하기",
    requireImage: false,
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

      toast({ title: "AI 분석 완료", description: "정보를 자동으로 채웠습니다" });
    } catch (error: any) {
      toast({ title: "분석 실패", description: "직접 입력해주세요", variant: "destructive" });
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
      toast({ title: "신고 완료!" });
      setLocation(`/item/${result.id}`);
    } catch (error: any) {
      toast({ title: "제출 실패", description: error.message, variant: "destructive" });
    }
  };

  const currentConfig = config[reportType];

  return (
    <Layout>
      <div className="w-full px-8 py-8">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {/* 상단: 이미지 | 정보 기입 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            
            {/* 사진 업로드 */}
            <div>
              <div 
                className={cn(
                  "relative rounded-2xl border-2 border-dashed overflow-hidden cursor-pointer transition-all",
                  "hover:border-primary/50 hover:bg-secondary/20",
                  imagePreview ? "border-solid border-border" : "border-border/50"
                )}
                style={{ minHeight: "400px" }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                />
                
                <AnimatePresence mode="wait">
                  {imagePreview ? (
                    <motion.img 
                      key="preview"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      src={imagePreview} 
                      alt="Preview" 
                      className="w-full h-full object-cover absolute inset-0"
                    />
                  ) : (
                    <motion.div 
                      key="upload"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center"
                    >
                      <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                        <Upload className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <p className="text-lg text-muted-foreground font-medium">사진 업로드</p>
                      <p className="text-sm text-muted-foreground/60 mt-2">또는 드래그 앤 드롭</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {isAnalyzing && (
                  <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
                    <p className="text-base text-primary flex items-center gap-2">
                      <Sparkles className="w-5 h-5" /> AI 분석 중
                    </p>
                  </div>
                )}
              </div>
              
              {currentConfig.requireImage && (
                <p className="text-sm text-primary text-center font-medium mt-3">
                  * 사진은 필수입니다
                </p>
              )}
            </div>

            {/* 정보 기입 */}
            <div className="space-y-5">
              <div>
                <Input 
                  placeholder="제목을 입력하세요" 
                  className="h-14 text-xl bg-secondary/30 border border-border/50 px-4 rounded-xl focus-visible:ring-2 focus-visible:ring-primary placeholder:text-muted-foreground/50 font-semibold"
                  {...form.register("title")} 
                />
                {form.formState.errors.title && (
                  <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">카테고리</Label>
                  <Input 
                    placeholder="예: 지갑, 가방" 
                    className="h-12 bg-secondary/30 border border-border/50"
                    {...form.register("itemCategory")} 
                  />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">색상</Label>
                  <Input 
                    placeholder="예: 검정, 흰색" 
                    className="h-12 bg-secondary/30 border border-border/50"
                    {...form.register("color")} 
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">상세 설명</Label>
                <Textarea 
                  placeholder="브랜드, 모델명, 특징 등" 
                  className="min-h-[100px] resize-none bg-secondary/30 border border-border/50"
                  {...form.register("description")} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">{currentConfig.locationLabel}</Label>
                  <Input 
                    placeholder={currentConfig.locationPlaceholder} 
                    className="h-12 bg-secondary/30 border border-border/50"
                    {...form.register("location")} 
                  />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">연락처</Label>
                  <Input 
                    placeholder="010-1234-5678" 
                    className="h-12 bg-secondary/30 border border-border/50"
                    value={formatPhoneNumber(form.watch("contactInfo") || "")}
                    onChange={handlePhoneChange}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 하단: 지도 */}
          <div className="mb-8">
            <Label className="text-base text-foreground mb-3 block font-medium">위치 지정</Label>
            <div className="rounded-xl overflow-hidden border border-border/50">
              <LocationPicker
                value={
                  form.watch("latitude") && form.watch("longitude")
                    ? { latitude: form.watch("latitude") || "", longitude: form.watch("longitude") || "" }
                    : undefined
                }
                onChange={handleLocationChange}
                height="300px"
              />
            </div>
          </div>

          {/* 버튼 */}
          <Button 
            type="submit" 
            className="w-full h-14 text-lg rounded-xl font-semibold"
            disabled={createMutation.isPending || isAnalyzing}
          >
            {createMutation.isPending ? (
              <><Loader2 className="mr-2 w-5 h-5 animate-spin" /> 처리 중...</>
            ) : (
              currentConfig.submitText
            )}
          </Button>
        </form>
      </div>
    </Layout>
  );
}