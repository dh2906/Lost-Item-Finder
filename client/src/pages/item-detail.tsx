import { useRoute } from "wouter";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Layout } from "@/components/layout";
import { useItem } from "@/hooks/use-items";
import { MapPin, Calendar, Tag, AlertCircle, Mail, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function ItemDetail() {
  const [, params] = useRoute("/item/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;

  const { data: item, isLoading, isError } = useItem(id);

  if (isLoading) {
    return (
      <Layout>
        <div className="container max-w-4xl py-8">
          <div className="aspect-[4/3] rounded-lg bg-muted animate-pulse mb-6" />
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
        <div className="container max-w-lg py-16 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-semibold mb-2">물건을 찾을 수 없습니다</h1>
          <p className="text-muted-foreground mb-6">
            삭제되었거나 잘못된 주소일 수 있습니다.
          </p>
          <Button asChild>
            <Link href="/">홈으로 돌아가기</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-4xl py-8">
        <Button variant="ghost" size="sm" asChild className="mb-6">
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-1" />
            목록으로
          </Link>
        </Button>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="relative rounded-lg overflow-hidden bg-muted mb-6">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="aspect-[4/3] flex items-center justify-center">
                  <Tag className="h-12 w-12 text-muted-foreground/30" />
                </div>
              )}
              <Badge
                className={cn(
                  "absolute left-3 top-3",
                  item.reportType === "found" ? "" : "bg-secondary"
                )}
              >
                {item.reportType === "found" ? "습득" : "분실"}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">장소</p>
                <p className="text-sm font-medium truncate">{item.location || "-"}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">날짜</p>
                <p className="text-sm font-medium">
                  {item.date ? format(new Date(item.date), "MM/dd", { locale: ko }) : "-"}
                </p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">카테고리</p>
                <p className="text-sm font-medium">{item.itemCategory || "-"}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 text-sm">
                  {item.location && (
                    <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {item.location}
                    </div>
                  )}
                  {item.date && (
                    <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(item.date), "PPP", { locale: ko })}
                    </div>
                  )}
                </div>

                {item.description && (
                  <div>
                    <p className="text-sm font-medium mb-2">설명</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {item.itemCategory && (
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground mb-1">카테고리</p>
                      <p className="font-medium">{item.itemCategory}</p>
                    </div>
                  )}
                  {item.color && (
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground mb-1">색상</p>
                      <p className="font-medium capitalize">{item.color}</p>
                    </div>
                  )}
                </div>

                {item.tags && item.tags.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">태그</p>
                    <div className="flex flex-wrap gap-1.5">
                      {item.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg">이 물건이 당신의 것인가요?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  상세 정보를 확인하고 연락해 주세요.
                </p>
                {item.contactInfo ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg border bg-background">
                    <Mail className="h-4 w-4 text-primary" />
                    <span className="font-medium">{item.contactInfo}</span>
                  </div>
                ) : (
                  <Button>관리자에게 문의</Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}