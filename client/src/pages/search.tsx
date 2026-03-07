import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles, Image as ImageIcon, Search as SearchIcon, X, Loader2 } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ItemCard } from "@/components/item-card";
import { useSearchSimilar } from "@/hooks/use-ai";
import { fileToBase64, cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const searchSchema = z.object({
  prompt: z.string().optional(),
  imageUrl: z.string().optional(),
}).refine(data => data.prompt || data.imageUrl, {
  message: "Please provide either a description or an image of the lost item.",
  path: ["prompt"]
});

type SearchFormValues = z.infer<typeof searchSchema>;

export default function SearchPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const searchMutation = useSearchSimilar();

  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      prompt: "",
      imageUrl: "",
    },
  });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const base64 = await fileToBase64(file);
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

  const onSubmit = async (data: SearchFormValues) => {
    await searchMutation.mutateAsync(data);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-12 w-full flex flex-col items-center">
        
        <div className="text-center max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent font-medium text-sm mb-6 border border-accent/20">
            <Sparkles className="w-4 h-4" />
            AI-Powered Matching
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">Find Your Lost Item</h1>
          <p className="text-lg text-muted-foreground">
            Describe what you lost in plain English, or upload a reference picture (like an old photo of the item). Our AI will search through all found reports to find matches.
          </p>
        </div>

        <Card className="w-full max-w-3xl p-2 rounded-3xl shadow-xl shadow-black/5 border-border/50 bg-white/60 backdrop-blur-xl mb-16 relative z-10 overflow-hidden">
          <form onSubmit={form.handleSubmit(onSubmit)} className="relative">
            <Textarea
              placeholder="Describe your item in detail. E.g., 'A black leather Ridge wallet with a silver money clip. It had my driver's license inside.'"
              className="min-h-[140px] resize-none border-0 focus-visible:ring-0 bg-transparent text-lg p-6 pb-20 placeholder:text-muted-foreground/60"
              {...form.register("prompt")}
            />
            
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
                    Add Reference Photo
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
                  <><Loader2 className="mr-2 w-5 h-5 animate-spin" /> Searching...</>
                ) : (
                  <><SearchIcon className="mr-2 w-5 h-5" /> Search AI</>
                )}
              </Button>
            </div>
          </form>
        </Card>
        
        {form.formState.errors.prompt && (
          <p className="text-destructive text-sm -mt-12 mb-12">{form.formState.errors.prompt.message}</p>
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
              <h3 className="text-2xl font-display font-bold">Scanning database...</h3>
              <p className="text-muted-foreground">Comparing your description against hundreds of items.</p>
            </div>
          )}

          {searchMutation.isSuccess && searchMutation.data && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full"
            >
              <div className="flex items-center justify-between mb-8 border-b border-border pb-4">
                <h2 className="text-2xl font-display font-bold">Search Results</h2>
                <span className="text-muted-foreground bg-secondary px-3 py-1 rounded-full text-sm font-medium">
                  {searchMutation.data.length} potential matches
                </span>
              </div>
              
              {searchMutation.data.length === 0 ? (
                <div className="text-center py-16 bg-secondary/30 rounded-3xl border border-border/50">
                  <SearchIcon className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">No matches found right now</h3>
                  <p className="text-muted-foreground">Check back later or try adjusting your description.</p>
                </div>
              ) : (
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
              )}
            </motion.div>
          )}
        </div>
      </div>
    </Layout>
  );
}
