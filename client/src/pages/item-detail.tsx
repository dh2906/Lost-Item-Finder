import { useRoute } from "wouter";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Layout } from "@/components/layout";
import { useItem } from "@/hooks/use-items";
import { MapPin, Calendar, Tag, AlertCircle, Mail, ArrowLeft, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocationDisplay } from "@/components/location-display";
import { cn } from "@/lib/utils";

export default function ItemDetail() {
  const [, params] = useRoute("/item/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;

  const { data: item, isLoading, isError } = useItem(id);

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-8 xl:max-w-[1440px]">
          <div className="mb-6 aspect-[4/3] rounded-[28px] bg-muted animate-pulse" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 rounded bg-muted animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !item) {
    return (
      <Layout>
        <div className="container max-w-lg py-16 text-center xl:max-w-[1440px]">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="mb-2 text-2xl font-semibold">물건을 찾을 수 없습니다</h1>
          <p className="mb-6 text-muted-foreground">삭제되었거나 잘못된 주소일 수 있습니다.</p>
          <Button asChild>
            <Link href="/">홈으로 돌아가기</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const hasLocation = !!(item.latitude && item.longitude);

  return (
    <Layout>
      <div className="container py-8 sm:py-10 xl:max-w-[1440px]">
        <Button variant="ghost" size="sm" asChild className="mb-5 rounded-full">
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-1" />
            목록으로
          </Link>
        </Button>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px] xl:gap-8">
          <div className="space-y-5">
            {/* Image */}
            <div className="relative mb-5 overflow-hidden rounded-[28px] border border-border/70 bg-muted/70 shadow-card">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="max-h-[540px] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center">
                  <Tag className="h-12 w-12 text-muted-foreground/30" />
                </div>
              )}
              <Badge
                className={cn(
                  "absolute left-3 top-3",
                  item.reportType === "found"
                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border border-emerald-200"
                    : "bg-red-50 text-red-600 hover:bg-red-50 border border-red-200"
                )}
              >
                {item.reportType === "found" ? "습득" : "분실"}
              </Badge>
            </div>

            {/* Quick info */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-[24px] border border-border/70 bg-white/88 p-4 shadow-sm">
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">장소</p>
                <p className="truncate text-sm font-medium">{item.location || "-"}</p>
              </div>
              <div className="rounded-[24px] border border-border/70 bg-white/88 p-4 shadow-sm">
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">날짜</p>
                <p className="text-sm font-medium">
                  {item.date ? format(new Date(item.date), "MM/dd", { locale: ko }) : "-"}
                </p>
              </div>
              <div className="rounded-[24px] border border-border/70 bg-white/88 p-4 shadow-sm">
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">카테고리</p>
                <p className="text-sm font-medium">{item.itemCategory || "-"}</p>
              </div>
            </div>

            {/* Map */}
            {hasLocation && (
              <Card className="border-border/70 bg-white/90">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MapPin className="h-5 w-5 text-primary" />
                    습득/분실 위치
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <LocationDisplay
                    latitude={item.latitude}
                    longitude={item.longitude}
                    height="260px"
                  />
                </CardContent>
              </Card>
            )}

            {/* Description */}
            {item.description && (
              <Card className="border-border/70 bg-white/90">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">상세 설명</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-7 text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Extra */}
            {(item.itemCategory || item.color || (item.tags && item.tags.length > 0)) && (
              <Card className="border-border/70 bg-white/90">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">추가 정보</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {item.itemCategory && (
                      <div className="rounded-[22px] border border-border/70 bg-secondary/40 p-4">
                        <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">카테고리</p>
                        <p className="font-medium">{item.itemCategory}</p>
                      </div>
                    )}
                    {item.color && (
                      <div className="rounded-[22px] border border-border/70 bg-secondary/40 p-4">
                        <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">색상</p>
                        <p className="font-medium capitalize">{item.color}</p>
                      </div>
                    )}
                  </div>
                  {item.tags && item.tags.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-medium">태그</p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="rounded-full border border-border/70 bg-muted/70 px-2.5">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5 xl:sticky xl:top-24">
            <Card className="border-border/70 bg-white/90">
              <CardHeader className="space-y-3 pb-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    {item.reportType === "found" ? "습득물" : "분실물"}
                  </p>
                  <CardTitle className="text-2xl leading-tight">{item.title}</CardTitle>
                </div>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  {item.location && (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {item.location}
                    </div>
                  )}
                  {item.date && (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(item.date), "PPP", { locale: ko })}
                    </div>
                  )}
                </div>
              </CardHeader>
            </Card>

            <Card className="border-border/70 bg-white/90">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">이 물건이 당신의 것인가요?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm leading-6 text-muted-foreground">상세 정보를 확인하고 연락해 주세요.</p>
                {item.contactInfo ? (
                  <div className="flex items-center gap-2 rounded-[22px] border border-border/70 bg-secondary/40 p-4">
                    <Mail className="h-4 w-4 text-primary" />
                    <span className="font-medium">{item.contactInfo}</span>
                  </div>
                ) : (
                  <Button className="w-full">관리자에게 문의</Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
