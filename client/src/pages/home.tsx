import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Search, Plus, PackageOpen, MapPin, Sparkles, Camera } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ItemCard } from "@/components/item-card";
import { useItems } from "@/hooks/use-items";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: MapPin,
    title: "주변 습득물 먼저 보기",
    description: "분실 장소 주변의 게시물을 먼저 살펴보고 가능성을 좁혀보세요.",
  },
  {
    icon: Camera,
    highlighted: true,
    title: "사진으로 바로 찾기",
    description: "사진 한 장으로 비슷한 분실물과 습득물을 빠르게 비교해보세요.",
  },
  {
    icon: Sparkles,
    title: "등록하면 자동 연결",
    description: "게시물 등록 후 새로 올라온 비슷한 글과 더 빠르게 이어질 수 있어요.",
  },
];

const actions = [
  {
    href: "/search",
    eyebrow: "잃어버렸어요",
    title: "분실물 바로 찾아보기",
    description: "설명이나 사진으로 등록된 습득물과 빠르게 비교해보세요.",
    support: "바로 검색 시작",
    icon: Search,
    primary: true,
    cta: "지금 찾기",
  },
  {
    href: "/report/found",
    eyebrow: "주웠어요",
    title: "습득물 바로 등록하기",
    description: "주운 장소와 물건 정보를 남겨 주인을 더 빨리 찾을 수 있어요.",
    support: "빠르게 등록 완료",
    icon: Plus,
    primary: false,
    cta: "등록하기",
  },
];

export default function Home() {
  const [tab, setTab] = useState<"found" | "lost">("found");
  const { data: items, isLoading } = useItems({ type: tab });
  const emptyLabel = tab === "found" ? "습득물" : "분실물";
  const sectionTitle = tab === "found" ? "방금 등록된 습득물을 확인해보세요" : "방금 등록된 분실물을 확인해보세요";
  const sectionDescription = "실제로 등록된 게시물을 바로 살펴보고 내 물건과 비슷한 글이 있는지 한눈에 확인해보세요.";

  return (
    <Layout>
      <section className="border-b border-border/70 bg-[linear-gradient(180deg,hsl(var(--primary-light))_0%,hsl(var(--background))_52%,hsl(var(--background))_100%)]">
        <div className="container py-12 md:py-14 lg:py-16">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-3xl">
              <div className="inline-flex items-center rounded-full border border-primary/12 bg-white/88 px-3 py-1 text-sm font-semibold text-primary shadow-[0_8px_18px_-18px_hsl(var(--primary)/0.28)]">
                AI 기반 분실물 연결 서비스
              </div>
              <h1 className="mt-5 max-w-3xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-[3.5rem] lg:leading-[1.04]">
                <span className="block">잃어버린 물건과 습득된 물건을</span>
                <span className="mt-1 block text-gradient">더 빠르게 연결해요</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-[1.0625rem] sm:leading-8">
                설명, 사진, 위치 정보로 주변 분실물과 습득물을 더 쉽게 찾고 연결할 수 있어요.
              </p>
              <p className="mt-4 text-sm font-semibold text-foreground sm:text-base">
                지금 필요한 작업을 아래에서 바로 시작하세요.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-2">
              {actions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={cn(
                    "group relative flex h-full min-h-[272px] cursor-pointer flex-col justify-between overflow-hidden rounded-[28px] border p-7 transition-all duration-250 hover:-translate-y-1.5 active:translate-y-[1px] md:p-8",
                    action.primary
                      ? "border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(270_68%_61%)_100%)] text-primary-foreground shadow-[0_22px_42px_-26px_hsl(var(--primary)/0.55)] hover:shadow-[0_28px_54px_-28px_hsl(var(--primary)/0.62)]"
                      : "border-primary/24 bg-[linear-gradient(180deg,hsl(var(--primary-light))_0%,white_100%)] text-foreground shadow-[0_20px_38px_-28px_rgba(67,56,202,0.22)] hover:border-primary/38 hover:shadow-[0_28px_54px_-32px_rgba(67,56,202,0.28)]"
                  )}
                >
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-250 group-hover:opacity-100",
                      action.primary
                        ? "bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_34%)]"
                        : "bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.10),transparent_34%)]"
                    )}
                  />
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={cn(
                           "text-sm font-semibold tracking-tight",
                           action.primary ? "text-primary-foreground/80" : "text-primary"
                         )}>
                          {action.eyebrow}
                        </p>
                        <span className={cn(
                           "inline-flex rounded-full border px-3 py-1 text-xs font-semibold shadow-sm",
                           action.primary
                             ? "border-white/18 bg-white/14 text-primary-foreground/92"
                             : "border-primary/15 bg-white/95 text-primary shadow-[0_10px_18px_-16px_hsl(var(--primary)/0.28)]"
                         )}>
                           {action.support}
                        </span>
                      </div>
                      <h2 className={cn(
                         "mt-3 text-[26px] font-bold leading-tight tracking-tight md:text-[28px]",
                         action.primary ? "text-primary-foreground" : "text-foreground"
                       )}>
                        {action.title}
                      </h2>
                      <p className={cn(
                        "mt-2 text-sm leading-6",
                        action.primary ? "text-primary-foreground/84" : "text-muted-foreground"
                      )}>
                        {action.description}
                      </p>
                    </div>
                    <div className={cn(
                       "flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border shadow-sm transition-all duration-250 group-hover:scale-105 group-hover:-translate-y-0.5",
                       action.primary
                         ? "border-white/18 bg-white/14 text-primary-foreground shadow-black/10"
                         : "border-primary/15 bg-white text-primary shadow-[0_14px_22px_-18px_hsl(var(--primary)/0.32)]"
                     )}>
                      <action.icon className="h-6 w-6" />
                    </div>
                  </div>
                   <div className={cn(
                      "mt-8 inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full border px-5 text-sm font-semibold transition-all duration-250 group-hover:-translate-y-0.5 group-active:translate-y-0 sm:w-full",
                      action.primary
                        ? "border-white/40 bg-white text-primary shadow-[0_16px_24px_-18px_rgba(15,23,42,0.38)] group-hover:bg-white/96 group-hover:shadow-[0_20px_28px_-18px_rgba(15,23,42,0.45)]"
                        : "border-primary/15 bg-primary text-primary-foreground shadow-[0_16px_26px_-18px_hsl(var(--primary)/0.45)] group-hover:bg-primary-hover group-hover:shadow-[0_22px_30px_-18px_hsl(var(--primary)/0.52)]"
                    )}>
                    <span>{action.cta}</span>
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full transition-all duration-250",
                        action.primary ? "bg-primary/10" : "bg-white/18"
                      )}
                    >
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-250 group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-7 space-y-4">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">지금 바로 사용할 수 있는 핵심 기능</p>
                <p className="text-sm text-muted-foreground">먼저 행동을 선택하고, 아래 기능으로 더 빠르게 찾고 연결해보세요.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className={cn(
                    "group rounded-[24px] border p-5 shadow-[0_10px_24px_-22px_rgba(27,31,59,0.14)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-[1px]",
                    feature.highlighted
                      ? "border-primary/18 bg-[linear-gradient(180deg,hsl(var(--primary-light))_0%,white_100%)] shadow-[0_18px_30px_-24px_hsl(var(--primary)/0.22)] hover:border-primary/24 hover:shadow-[0_24px_34px_-24px_hsl(var(--primary)/0.26)]"
                      : "border-border/70 bg-white/82 hover:border-primary/12 hover:bg-white hover:shadow-[0_18px_28px_-24px_rgba(27,31,59,0.16)]"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={cn(
                       "flex h-11 w-11 items-center justify-center rounded-2xl text-primary transition-all duration-200 group-hover:scale-[1.03]",
                       feature.highlighted ? "bg-white shadow-[0_12px_20px_-16px_hsl(var(--primary)/0.34)]" : "bg-primary/10"
                     )}>
                      <feature.icon className="h-5 w-5" />
                    </div>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                </div>
              ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background/80 py-10 md:py-12">
        <div className="container">
          <div className="rounded-[30px] border border-border/70 bg-white/84 p-6 shadow-[0_22px_42px_-34px_rgba(27,31,59,0.18)] backdrop-blur-sm md:p-8">
            <div className="mb-7 flex flex-col gap-5 border-b border-border/70 pb-6 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3.5">
                <div className="space-y-3">
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">{sectionTitle}</h2>
                  <Tabs value={tab} onValueChange={(value) => setTab(value as "found" | "lost")}>
                    <TabsList className="h-11 rounded-full border border-border/70 bg-muted/80 p-1 shadow-[0_10px_22px_-18px_rgba(27,31,59,0.14)]">
                      <TabsTrigger
                        value="found"
                        className="rounded-full px-4 text-sm font-medium text-muted-foreground transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_10px_18px_-14px_hsl(var(--primary)/0.32)]"
                      >
                        습득물
                      </TabsTrigger>
                      <TabsTrigger
                        value="lost"
                        className="rounded-full px-4 text-sm font-medium text-muted-foreground transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_10px_18px_-14px_hsl(var(--primary)/0.32)]"
                      >
                        분실물
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{sectionDescription}</p>
              </div>
              <div className="flex items-center gap-2 self-start pt-0.5">
                <Button variant="outline" size="sm" asChild className="rounded-full border-border/70 bg-white/92 px-4 shadow-sm hover:border-primary/20 hover:bg-accent hover:shadow-[0_12px_18px_-16px_hsl(var(--primary)/0.2)]">
                  <Link href={`/items?type=${tab}`}>전체 보기</Link>
                </Button>
              </div>
            </div>

            {isLoading ? (
               <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                 {[1, 2, 3, 4, 5].map((i) => (
                   <div key={i} className="h-[290px] animate-pulse rounded-[26px] bg-muted" />
                 ))}
               </div>
             ) : !items || items.length === 0 ? (
               <div className="flex flex-col items-center justify-center rounded-[28px] border border-border/70 bg-background px-6 py-16 text-center">
                 <div className="mb-5 rounded-[22px] bg-muted p-5">
                   <PackageOpen className="h-10 w-10 text-muted-foreground/50" />
                 </div>
                <p className="text-lg font-semibold">등록된 {emptyLabel}이 없어요</p>
                <p className="mt-2 text-base text-muted-foreground">첫 게시물을 작성해보세요</p>
                <Button className="mt-6 h-12 rounded-xl px-8 text-base" asChild>
                  <Link href={`/report?type=${tab}`}>
                    <Plus className="mr-2 h-5 w-5" />
                    작성하기
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {items.map((item) => (
                  <ItemCard key={item.id} item={item} variant="compact" showDateTime />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
