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
import { optimizeImageForUpload } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { LocationPicker } from "@/components/location-picker";

const searchSchema = z
  .object({
    prompt: z.string().optional(),
    imageUrl: z.string().optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
  })
  .refine((data) => data.prompt || data.imageUrl, {
    message: "설명이나 이미지를 제공해주세요.",
    path: ["prompt"],
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
    form.clearErrors("prompt");
  };

  const removeImage = () => {
    setImagePreview(null);
    form.setValue("imageUrl", "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleLocationChange = (location: { latitude: string; longitude: string }) => {
    form.setValue("latitude", location.latitude);
    form.setValue("longitude", location.longitude);
  };

  const onSubmit = async (data: SearchFormValues) => {
    try {
      await searchMutation.mutateAsync(data);
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
      <div className="section-container">
        <div className="container max-w-3xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-3">
              분실물 검색
            </h1>
            <p className="text-muted-foreground">
              설명이나 사진으로 잃어버린 물건을 찾아보세요
            </p>
          </div>

          <Card className="p-6">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  물건 설명
                </label>
                <Textarea
                  placeholder="예: 검은색 가죽 지갑, 은색 금속 클립, 신분증과 카드가 들어 있었어요."
                  className="min-h-[120px] resize-none"
                  onKeyDown={handlePromptKeyDown}
                  {...form.register("prompt")}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  참고 사진 (선택)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                />
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-24 w-24 rounded-lg object-cover border"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-white"
                      aria-label="이미지 제거"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    사진 추가
                  </Button>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  분실 위치 (선택)
                </label>
                <div className="rounded-lg border overflow-hidden">
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
              </div>

              {form.formState.errors.prompt && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.prompt.message}
                </p>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={searchMutation.isPending}>
                {searchMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    검색 중...
                  </>
                ) : (
                  <>
                    <SearchIcon className="mr-2 h-4 w-4" />
                    AI 검색
                  </>
                )}
              </Button>
            </form>
          </Card>
        </div>
      </div>

      <section className="pb-16">
        <div className="container">
          {searchMutation.isPending ? (
            <div className="text-center py-16">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-primary/10 p-4">
                  <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">검색 중입니다</h3>
              <p className="text-muted-foreground">
                설명, 이미지, 위치 정보를 분석하고 있습니다.
              </p>
            </div>
          ) : searchMutation.isSuccess && searchMutation.data ? (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">검색 결과</h2>
                <span className="text-sm text-muted-foreground">
                  {searchMutation.data.length}개 매칭
                </span>
              </div>

              {searchMutation.data.length === 0 ? (
                <div className="text-center py-16 px-4 rounded-lg border border-dashed">
                  <SearchIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">일치하는 물건이 없어요</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    위치 범위를 넓히거나 설명을 구체적으로 적어보세요.
                  </p>
                  <Button asChild>
                    <Link href="/report?type=lost">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      분실물 신고하기
                    </Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {searchMutation.data.map((result) => (
                      <ItemCard
                        key={result.item.id}
                        item={result.item}
                        score={result.score}
                        reasoning={result.reasoning}
                      />
                    ))}
                  </div>

                  <div className="text-center mt-8">
                    <p className="text-sm text-muted-foreground mb-3">
                      원하는 물건이 없나요?
                    </p>
                    <Button variant="outline" asChild>
                      <Link href="/report?type=lost">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        분실물 신고하기
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground">
                위에서 검색 조건을 입력하세요.
              </p>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}