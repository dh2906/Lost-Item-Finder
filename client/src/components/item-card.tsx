import { format } from "date-fns";
import { MapPin, Calendar, Tag as TagIcon, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
  return (
    <Link href={`/item/${item.id}`} className={cn("block group h-full", className)}>
      <Card className="h-full overflow-hidden border-border/50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-card/50 backdrop-blur-sm flex flex-col">
        <div className="relative aspect-video overflow-hidden bg-muted flex-shrink-0">
          {item.imageUrl ? (
            <img 
              src={item.imageUrl} 
              alt={item.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <TagIcon className="w-12 h-12 opacity-20" />
            </div>
          )}
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            <Badge className={cn(
              "font-semibold uppercase tracking-wider backdrop-blur-md shadow-sm border-0",
              item.reportType === 'found' 
                ? "bg-primary/90 hover:bg-primary text-white" 
                : "bg-orange-500/90 hover:bg-orange-500 text-white"
            )}>
              {item.reportType}
            </Badge>
          </div>
          
          {score !== undefined && (
            <div className="absolute top-3 right-3">
              <Badge className="bg-accent text-accent-foreground font-bold shadow-lg flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {Math.round(score * 100)}% Match
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="p-5 flex-grow">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-display font-bold text-lg leading-tight line-clamp-1 group-hover:text-primary transition-colors">
              {item.title}
            </h3>
          </div>
          
          <div className="space-y-2 text-sm text-muted-foreground mb-4">
            {item.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary/70 shrink-0" />
                <span className="truncate">{item.location}</span>
              </div>
            )}
            {item.date && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary/70 shrink-0" />
                <span>{format(new Date(item.date), 'MMM d, yyyy')}</span>
              </div>
            )}
          </div>

          {reasoning && (
            <div className="mt-4 p-3 bg-accent/10 border border-accent/20 rounded-xl text-sm text-foreground/80 leading-relaxed relative">
              <Sparkles className="w-4 h-4 text-accent absolute -top-2 -left-2 bg-background rounded-full" />
              {reasoning}
            </div>
          )}
        </CardContent>

        {item.tags && item.tags.length > 0 && (
          <CardFooter className="px-5 pb-5 pt-0 mt-auto">
            <div className="flex flex-wrap gap-1.5">
              {item.tags.slice(0, 3).map((tag, i) => (
                <Badge key={i} variant="secondary" className="bg-secondary/50 text-xs font-normal">
                  {tag}
                </Badge>
              ))}
              {item.tags.length > 3 && (
                <Badge variant="secondary" className="bg-secondary/50 text-xs font-normal">
                  +{item.tags.length - 3}
                </Badge>
              )}
            </div>
          </CardFooter>
        )}
      </Card>
    </Link>
  );
}
