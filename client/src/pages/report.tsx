import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UploadCloud, Sparkles, Loader2, Image as ImageIcon, CheckCircle2 } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useAnalyzeImage, useCreateItem } from "@/hooks/use-ai";
import { fileToBase64, cn } from "@/lib/utils";
import { useCreateItem as useSaveItem } from "@/hooks/use-items";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const formSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  itemCategory: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  location: z.string().optional(),
  contactInfo: z.string().optional(),
  tags: z.array(z.string()).optional(),
  imageUrl: z.string().optional(),
  reportType: z.enum(["found", "lost"]).default("found"),
});

type FormValues = z.infer<typeof formSchema>;

export default function ReportPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const analyzeMutation = useAnalyzeImage();
  const createMutation = useSaveItem();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reportType: "found",
      title: "",
      description: "",
      itemCategory: "",
      color: "",
      size: "",
      location: "",
      contactInfo: "",
      tags: [],
      imageUrl: "",
    },
  });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsAnalyzing(true);
      const base64 = await fileToBase64(file);
      setImagePreview(base64);
      form.setValue("imageUrl", base64);

      // Trigger AI Analysis
      const analysis = await analyzeMutation.mutateAsync({ imageUrl: base64 });
      
      // Auto-fill form
      form.setValue("itemCategory", analysis.itemCategory);
      form.setValue("color", analysis.color);
      form.setValue("size", analysis.size);
      form.setValue("description", analysis.description);
      form.setValue("tags", analysis.tags);
      
      // Generate a smart title if one isn't set
      if (!form.getValues("title")) {
        form.setValue("title", `습득: ${analysis.color} ${analysis.itemCategory}`);
      }

      toast({
        title: "AI 분석 완료",
        description: "이미지를 기반으로 세부 정보를 자동으로 채웠습니다.",
      });
    } catch (error: any) {
      toast({
        title: "분석 실패",
        description: error.message || "이미지 분석에 실패했습니다. 직접 작성할 수 있습니다.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const onSubmit = async (data: FormValues) => {
    try {
      const result = await createMutation.mutateAsync(data);
      toast({
        title: "신고 완료!",
        description: "커뮤니티에 도움을 주셔서 감사합니다.",
      });
      setLocation(`/item/${result.id}`);
    } catch (error: any) {
      toast({
        title: "제출 실패",
        description: error.message || "오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-12 w-full">
        <div className="mb-10">
          <h1 className="text-4xl font-display font-bold mb-3">습득물 신고</h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            찾은 물건의 사진을 올려주세요. 우리의 AI가 자동으로 카테고리, 색상, 크기 등 세부 사항을 추출하여 주인이 더 빨리 찾을 수 있도록 도와줍니다.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Image Upload & Preview */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="overflow-hidden border-2 border-dashed border-border/60 hover:border-primary/50 transition-colors bg-secondary/20">
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleImageSelect}
              />
              
              <div 
                className={cn(
                  "relative aspect-[4/5] flex flex-col items-center justify-center p-6 cursor-pointer",
                  imagePreview ? "p-0" : ""
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <AnimatePresence mode="wait">
                  {imagePreview ? (
                    <motion.div 
                      key="preview"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="w-full h-full relative group"
                    >
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button variant="secondary" className="rounded-full backdrop-blur-md">
                          이미지 변경
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="upload"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-center"
                    >
                      <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                        <UploadCloud className="w-8 h-8" />
                      </div>
                      <h3 className="font-semibold text-lg mb-1">사진 업로드</h3>
                      <p className="text-sm text-muted-foreground">기기에서 이미지를 선택하려면 탭하세요</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {isAnalyzing && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                    <p className="font-medium text-primary flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> AI가 분석 중입니다...
                    </p>
                  </div>
                )}
              </div>
            </Card>
            
            {!imagePreview && !isAnalyzing && (
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex gap-3 text-sm text-primary/80">
                <Sparkles className="w-5 h-5 shrink-0 mt-0.5" />
                <p>선명한 사진을 업로드하면 우리의 AI가 자동으로 물건을 설명하여 매칭 확률을 높일 수 있습니다!</p>
              </div>
            )}
          </div>

          {/* Right Column: Form */}
          <div className="lg:col-span-7">
            <Card className="p-6 md:p-8 shadow-xl shadow-black/5 border-border/50">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-base">제목 <span className="text-destructive">*</span></Label>
                  <Input 
                    id="title" 
                    placeholder="예: 검은색 가죽 지갑을 찾았습니다" 
                    className="h-12 text-lg bg-secondary/30"
                    {...form.register("title")} 
                  />
                  {form.formState.errors.title && (
                    <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="itemCategory">카테고리</Label>
                    <div className="relative">
                      <Input id="itemCategory" placeholder="예: 전자제품, 의류" className="bg-secondary/30" {...form.register("itemCategory")} />
                      {form.getValues("itemCategory") && <CheckCircle2 className="w-4 h-4 text-accent absolute right-3 top-3" />}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="color">색상</Label>
                    <div className="relative">
                      <Input id="color" placeholder="예: 검은색, 은색" className="bg-secondary/30" {...form.register("color")} />
                      {form.getValues("color") && <CheckCircle2 className="w-4 h-4 text-accent absolute right-3 top-3" />}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">상세 설명</Label>
                  <Textarea 
                    id="description" 
                    placeholder="특이한 표시, 브랜드명, 또는 구체적인 세부사항?" 
                    className="min-h-[120px] resize-y bg-secondary/30"
                    {...form.register("description")} 
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">어디서 찾았나요?</Label>
                    <Input id="location" placeholder="예: 중앙공원 분수 근처" className="bg-secondary/30" {...form.register("location")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactInfo">연락처</Label>
                    <Input id="contactInfo" placeholder="이메일 또는 전화번호 (선택)" className="bg-secondary/30" {...form.register("contactInfo")} />
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <Button 
                    type="submit" 
                    size="lg" 
                    className="w-full h-14 text-lg rounded-xl shadow-lg shadow-primary/20"
                    disabled={createMutation.isPending || isAnalyzing}
                  >
                    {createMutation.isPending ? (
                      <><Loader2 className="mr-2 w-5 h-5 animate-spin" /> 제출 중...</>
                    ) : (
                      "습득물 신고 발행"
                    )}
                  </Button>
                </div>

              </form>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
