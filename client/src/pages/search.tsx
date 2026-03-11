import { useState, useRef, type KeyboardEvent } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles, Image as ImageIcon, Search as SearchIcon, X, Loader2, PlusCircle, MapPin } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ItemCard } from "@/components/item-card";
import { useSearchSimilar } from "@/hooks/use-ai";
import { optimizeImageForUpload, cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { LocationPicker } from "@/components/location-picker";

const searchSchema = z.object({
  prompt: z.string().optional(),
  imageUrl: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
}).refine(data => data.prompt || data.imageUrl, {
  message: "Please provide either a description or an image of the lost item.",
  path: ["prompt"]
});

type SearchFormValues = z.infer<typeof searchSchema>;

export default function SearchPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { toast } = useToast();
  
  const searchMutation = useSearchSimilar();

  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      prompt: "",
      imageUrl: "",
      latitude: "",
      longitude: "",
    },
  });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const base64 = await optimizeImageForUpload(file);
    setImagePreview(base64);
    form.setValue("imageUrl", base64);
    // Clear error if exists since we now have an image
    form.clearErrors("prompt"); 
  };

  const removeImage = () => {
    setImagePreview(null);
    form.setValue("imageUrl", "");
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLocationChange = (location: { latitude: string; longitude: string }) => {
    form.setValue("latitude", location.latitude);
    form.setValue("longitude", location.longitude);
  };
  const showSearchErrorToast = (error: unknown) => {
    const message = error instanceof Error ? error.message : "검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
    toast({
      variant: "destructive",
      title: "검색 실패",
      description: message,
      duration: 6000,
    });
  };

  const onSubmit = async (data: SearchFormValues) => {
    try {
      await searchMutation.mutateAsync(data);
    } catch (error) {
      showSearchErrorToast(error);
    }
  };

  const handlePromptKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) {
      return;
    }

    e.preventDefault();

    if (searchMutation.isPending) {
      return;
    }

    void form.handleSubmit(onSubmit)();
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-12 w-full flex flex-col items-center">
        
        <div className="text-center max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent font-medium text-sm mb-6 border border-accent/20">
            <Sparkles className="w-4 h-4" />
            AI 기반 매칭
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">분실물 찾기</h1>
          <p className="text-lg text-muted-foreground">
            잃어버린 물건을 설명하거나, 물건의 참고 사진(예: 예전 사진)을 업로드하세요. 우리의 AI가 모든 습득물 신고를 검색하여 매칭되는 물건을 찾아줍니다.
          </p>
        </div>

        <Card className="w-full max-w-3xl p-2 rounded-3xl shadow-xl shadow-black/5 border-border/50 bg-white/60 backdrop-blur-xl mb-8 relative z-10 overflow-hidden">
          <form onSubmit={form.handleSubmit(onSubmit)} className="relative">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>분실 위치 선택 (선택)</span>
              </div>
              <LocationPicker
                value={
                  form.watch("latitude") && form.watch("longitude")
                    ? { latitude: form.watch("latitude") || "", longitude: form.watch("longitude") || "" }
                    : undefined
                }
                onChange={handleLocationChange}
                height="200px"
              />
            </div>
            
            <div className="border-t border-border/50">
              <Textarea
                placeholder="물건을 자세히 설명하세요. 예: '검은색 가죽 Ridge 지갑, 은색 금속 클립이 있습니다. 운전면허증이 들어있었어요.'"
                className="min-h-[140px] resize-none border-0 focus-visible:ring-0 bg-transparent text-lg p-6 pb-20 placeholder:text-muted-foreground/60"
                onKeyDown={handlePromptKeyDown}
                {...form.register("prompt")}
              />
            </div>
            
            <AnimatePresence>
              {imagePreview && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className="absolute bottom-6 left-6 relative w-20 h-20 rounded-xl overflow-hidden shadow-md border border-border"
                >
                  <img src={imagePreview} alt="Reference" className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={removeImage}
                    className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-1 shadow-sm hover:scale-110 transition-transform"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute bottom-4 right-4 left-4 flex justify-between items-center bg-transparent mt-4">
              <div>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                />
                {!imagePreview && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="rounded-full border-dashed"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="w-4 h-4 mr-2 text-muted-foreground" />
                    참고 사진 추가
                  </Button>
                )}
              </div>
              
              <Button 
                type="submit" 
                size="lg" 
                className="rounded-full shadow-lg shadow-primary/25 h-12 px-8"
                disabled={searchMutation.isPending}
              >
                {searchMutation.isPending ? (
                  <><Loader2 className="mr-2 w-5 h-5 animate-spin" /> 검색 중...</>
                ) : (
                  <><SearchIcon className="mr-2 w-5 h-5" /> AI 검색</>
                )}
              </Button>
            </div>
          </form>
        </Card>
        
        {form.formState.errors.prompt && (
          <p className="text-destructive text-sm -mt-12 mb-12">{form.formState.errors.prompt.message === "Please provide either a description or an image of the lost item." ? "설명이나 이미지를 제공해주세요." : form.formState.errors.prompt.message}</p>
        )}

        {/* Results Section */}
        <div className="w-full relative">
          {searchMutation.isPending && (
            <div className="absolute inset-0 flex flex-col items-center justify-center py-20">
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 border-4 border-primary/20 rounded-full animate-ping" />
                <div className="absolute inset-2 bg-gradient-to-tr from-primary to-accent rounded-full animate-pulse flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-display font-bold">데이터베이스 검색 중...</h3>
              <p className="text-muted-foreground">수백 개의 물건과 귀하의 설명을 비교하고 있습니다.</p>
            </div>
          )}

          {searchMutation.isSuccess && searchMutation.data && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full"
            >
              <div className="flex items-center justify-between mb-8 border-b border-border pb-4">
                <h2 className="text-2xl font-display font-bold">검색 결과</h2>
                <span className="text-muted-foreground bg-secondary px-3 py-1 rounded-full text-sm font-medium">
                  {searchMutation.data.length}개 매칭 물건
                </span>
              </div>
              
              {searchMutation.data.length === 0 ? (
                <div className="text-center py-16 bg-secondary/30 rounded-3xl border border-border/50">
                  <SearchIcon className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">지금은 매칭 물건이 없습니다</h3>
                  <p className="text-muted-foreground mb-6">나중에 다시 확인하거나 설명을 조정해보세요.</p>
                  <Link href="/report?type=lost">
                    <Button size="lg" className="rounded-full gap-2">
                      <PlusCircle className="w-5 h-5" />
                      찾으시는 물건이 없나요? 분실물 신고하기
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {searchMutation.data.map((result, i) => (
                      <motion.div 
                        key={result.item.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <ItemCard 
                          item={result.item} 
                          score={result.score} 
                          reasoning={result.reasoning} 
                        />
                      </motion.div>
                    ))}
                  </div>
                  
                  {/* CTA for when results don't match what user is looking for */}
                  <div className="mt-12 text-center py-8 border-t border-border/50">
                    <p className="text-muted-foreground mb-4">찾으시는 물건이 위 결과에 없나요?</p>
                    <Link href="/report?type=lost">
                      <Button variant="outline" size="lg" className="rounded-full gap-2">
                        <PlusCircle className="w-5 h-5" />
                        분실물 신고하기
                      </Button>
                    </Link>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </Layout>
  );
}
