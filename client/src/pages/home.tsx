import { useState } from "react";
import { Link } from "wouter";
import { Search, Plus, PackageOpen, Info } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ItemCard } from "@/components/item-card";
import { useItems } from "@/hooks/use-items";
import { motion } from "framer-motion";

export default function Home() {
  const [tab, setTab] = useState<'found' | 'lost'>('found');
  const { data: items, isLoading } = useItems({ type: tab });

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto"
          >
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-extrabold tracking-tight text-balance mb-6">
              사람들을 소중한 물건과 <span className="gradient-text">연결합니다.</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-10 text-balance leading-relaxed">
              우리의 AI 기반 플랫폼은 습득한 물건과 주인을 쉽게 연결합니다. 사진을 찍고 마법이 일어나도록 하세요.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/report" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto rounded-full h-14 px-8 text-lg font-semibold shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 transition-all">
                  <Plus className="mr-2 w-5 h-5" />
                  물건을 찾았어요
                </Button>
              </Link>
              <Link href="/search" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-full h-14 px-8 text-lg font-semibold border-2 hover:bg-secondary/50 transition-all">
                  <Search className="mr-2 w-5 h-5" />
                  물건을 찾고 있어요
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feed Section */}
      <section className="bg-white/50 backdrop-blur-xl border-t border-border/50 py-16 flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <h2 className="text-3xl font-display font-bold">최근 신고</h2>
            
            <Tabs value={tab} onValueChange={(v) => setTab(v as 'found' | 'lost')} className="w-full md:w-auto">
              <TabsList className="grid w-full grid-cols-2 h-12 rounded-full p-1 bg-secondary/50">
                <TabsTrigger value="found" className="rounded-full text-base">습득물</TabsTrigger>
                <TabsTrigger value="lost" className="rounded-full text-base">분실물</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-[400px] rounded-2xl bg-secondary/50 animate-pulse" />
              ))}
            </div>
          ) : !items || items.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
                <PackageOpen className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold mb-2">신고된 물건이 없습니다</h3>
              <p className="text-muted-foreground max-w-md">
                현재 {tab === 'found' ? '습득물' : '분실물'} 신고가 없습니다.
              </p>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ staggerChildren: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {items.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </motion.div>
          )}
        </div>
      </section>
    </Layout>
  );
}
