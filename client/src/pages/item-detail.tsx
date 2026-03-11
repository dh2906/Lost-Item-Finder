import { useRoute } from "wouter";
import { Layout } from "@/components/layout";
import { useItem } from "@/hooks/use-items";
import { format } from "date-fns";
import { MapPin, Calendar, Tag, AlertCircle, ShieldCheck, Mail, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { LocationDisplay } from "@/components/location-display";

export default function ItemDetail() {
  const [, params] = useRoute("/item/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  
  const { data: item, isLoading, isError } = useItem(id);

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto px-4 py-12 w-full animate-pulse flex flex-col lg:flex-row gap-8">
          <div className="w-full lg:w-1/2 aspect-square bg-secondary/50 rounded-3xl" />
          <div className="w-full lg:w-1/2 space-y-4 pt-4">
            <div className="h-10 bg-secondary/50 rounded-lg w-3/4" />
            <div className="h-6 bg-secondary/50 rounded-lg w-1/4" />
            <div className="h-32 bg-secondary/50 rounded-lg w-full mt-8" />
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !item) {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 py-32 text-center">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">물건을 찾을 수 없습니다</h1>
          <p className="text-muted-foreground mb-8">이 물건은 삭제되었거나 URL이 잘못되었을 수 있습니다.</p>
          <Link href="/">
            <Button>홈으로 돌아가기</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8 lg:py-12 w-full">
        
        <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-8 group">
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> 목록으로 돌아가기
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
          {/* Image Section */}
          <div className="rounded-3xl overflow-hidden bg-secondary/30 border border-border/50 relative shadow-2xl shadow-black/5 h-fit">
            <Badge className={cn(
              "absolute top-4 left-4 z-10 text-sm py-1 px-4 shadow-lg backdrop-blur-md border-0 uppercase tracking-wider font-bold",
              item.reportType === 'found' ? "bg-primary/90 text-white" : "bg-orange-500/90 text-white"
            )}>
              {item.reportType === 'found' ? '습득물' : '분실물'}
            </Badge>
            
            {item.imageUrl ? (
              <img 
                src={item.imageUrl} 
                alt={item.title} 
                className="w-full aspect-[4/3] object-cover"
              />
            ) : (
              <div className="w-full aspect-[4/3] flex flex-col items-center justify-center text-muted-foreground/50">
                <Tag className="w-20 h-20 mb-4 opacity-50" />
                <p>이미지 없음</p>
              </div>
            )}
          </div>

          {/* Details Section */}
          <div className="flex flex-col">
            <h1 className="text-4xl md:text-5xl font-display font-extrabold mb-4 text-balance">
              {item.title}
            </h1>
            
            <div className="flex flex-wrap gap-4 text-muted-foreground mb-8 pb-8 border-b border-border/60">
              {item.location && (
                <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-full text-sm">
                  <MapPin className="w-4 h-4 text-primary" /> {item.location}
                </div>
              )}
              {item.date && (
                <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-full text-sm">
                  <Calendar className="w-4 h-4 text-primary" /> {format(new Date(item.date), 'MMMM d, yyyy')}
                </div>
              )}
            </div>

            <div className="space-y-8 flex-grow">
              {item.description && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    설명
                  </h3>
                  <p className="text-foreground/80 leading-relaxed text-lg">
                    {item.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {item.itemCategory && (
                  <div className="bg-secondary/30 p-4 rounded-2xl border border-border/50">
                    <span className="text-sm text-muted-foreground block mb-1">카테고리</span>
                    <span className="font-medium">{item.itemCategory}</span>
                  </div>
                )}
                {item.color && (
                  <div className="bg-secondary/30 p-4 rounded-2xl border border-border/50">
                    <span className="text-sm text-muted-foreground block mb-1">색상</span>
                    <span className="font-medium capitalize">{item.color}</span>
                  </div>
                )}
              </div>

              {item.tags && item.tags.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">AI 태그</h3>
                  <div className="flex flex-wrap gap-2">
                    {item.tags.map((tag, i) => (
                      <Badge key={i} variant="outline" className="bg-background text-sm py-1.5 px-3 border-border">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 지도 위치 표시 */}
            {(item.latitude && item.longitude) && (
              <div>
                <h3 className="text-lg font-semibold mb-3">위치</h3>
                <LocationDisplay 
                  latitude={item.latitude} 
                  longitude={item.longitude}
                  height="250px"
                />
              </div>
            )}

            {/* Contact Action */}

            {/* Contact Action */}
            <div className="mt-12 bg-primary/5 rounded-3xl p-6 sm:p-8 border border-primary/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <ShieldCheck className="w-32 h-32 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">이 물건이 당신의 것인가요?</h3>
              <p className="text-muted-foreground mb-6 max-w-md relative z-10">
                {item.contactInfo 
                  ? "습득자가 연락처를 남겼습니다. 물건을 찾기 위해 연락하세요." 
                  : "습득자가 공개 연락처를 남기지 않았습니다. 물건 ID와 함께 커뮤니티 관리자에게 문의하세요."}
              </p>
              
              {item.contactInfo ? (
                <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-border shadow-sm w-fit relative z-10">
                  <Mail className="w-5 h-5 text-primary" />
                  <span className="font-medium text-lg">{item.contactInfo}</span>
                </div>
              ) : (
                <Button size="lg" className="relative z-10 shadow-lg">
                  관리자에게 문의
                </Button>
              )}
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}
