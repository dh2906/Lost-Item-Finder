import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { MapPin, Calendar, Tag as TagIcon, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Item } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ItemCardProps {
  item: Item;
  score?: number;
  reasoning?: string;
  className?: string;
}

export function ItemCard({ item, score, reasoning, className }: ItemCardProps) {
  const reportLabel = item.reportType === "found" ? "습득" : "분실";

  return (
    <Link href={`/item/${item.id}`} className={cn("block h-full", className)}>
      <Card className="h-full overflow-hidden transition-colors hover:border-primary/50 hover:shadow-md">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <TagIcon className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}

          <div className="absolute left-3 top-3">
            <Badge
              variant={item.reportType === "found" ? "default" : "secondary"}
              className="font-medium"
            >
              {reportLabel}
            </Badge>
          </div>

          {score !== undefined && (
            <div className="absolute right-3 top-3">
              <Badge variant="outline" className="bg-white/90 font-medium">
                <Sparkles className="mr-1 h-3 w-3 text-primary" />
                {Math.round(score * 100)}% 일치
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="p-4 space-y-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <span>{item.itemCategory || "분류 미지정"}</span>
              {item.tags?.[0] && (
                <>
                  <span>·</span>
                  <span>{item.tags[0]}</span>
                </>
              )}
            </div>
            <h3 className="font-semibold line-clamp-2">{item.title}</h3>
          </div>

          <div className="space-y-1.5 text-sm text-muted-foreground">
            {item.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span className="truncate">{item.location}</span>
              </div>
            )}
            {item.date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>{format(new Date(item.date), "PPP", { locale: ko })}</span>
              </div>
            )}
          </div>

          {reasoning ? (
            <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 text-sm text-foreground/80">
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary mb-1">
                <Sparkles className="h-3 w-3" />
                일치 이유
              </div>
              <p className="line-clamp-2">{reasoning}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {item.description || "등록된 핵심 정보와 위치를 기반으로 확인할 수 있는 게시물입니다."}
            </p>
          )}

          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {item.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{item.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}