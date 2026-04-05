import { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  MapPin,
  Calendar,
  Tag as TagIcon,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Item } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ItemCardProps {
  item: Item;
  score?: number;
  reasoning?: string;
  distanceText?: string;
  className?: string;
  variant?: "default" | "compact" | "list";
  showDateTime?: boolean;
}

export function getDisplayTitle(item: Item) {
  const strippedTitle = item.title
    .replace(/^(습득|분실)\s*[:\-]\s*/i, "")
    .replace(/^(found|lost)\s*[:\-]\s*/i, "")
    .trim();

  if (strippedTitle.length > 0) {
    return strippedTitle
      .replace(/^black cap$/i, "검은색 모자")
      .replace(/^담요주웠어요$/i, "파란색 별무늬 담요")
      .replace(/\s+/g, " ")
      .trim();
  }

  return item.reportType === "found" ? "등록된 습득물" : "등록된 분실물";
}

export function ItemCard({
  item,
  score,
  reasoning,
  distanceText,
  className,
  variant = "default",
  showDateTime = false,
}: ItemCardProps) {
  const [isReasonExpanded, setIsExpanded] = useState(false);
  const reportLabel = item.reportType === "found" ? "습득" : "분실";
  const statusLabel = item.status === "resolved" ? "해결 완료" : "진행 중";
  const isCompact = variant === "compact" || variant === "list";
  const displayTitle = getDisplayTitle(item);

  const getMatchBadge = (scoreValue?: number) => {
    if (scoreValue === undefined) return null;
    const percentage = Math.round(scoreValue * 100);
    if (percentage >= 70) {
      return {
        text: `${percentage}%`,
        className:
          "bg-purple-600 hover:bg-purple-700 text-white border-purple-600",
      };
    }
    if (percentage >= 40) {
      return {
        text: `${percentage}%`,
        className: "bg-blue-500 hover:bg-blue-600 text-white border-blue-500",
      };
    }
    return {
      text: `${percentage}%`,
      className: "bg-gray-500 hover:bg-gray-600 text-white border-gray-500",
    };
  };

  const matchBadge = getMatchBadge(score);

  const toggleReason = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isReasonExpanded);
  };

  return (
    <Link
      href={`/item/${item.id}`}
      className={cn("group block h-full outline-none", className)}
    >
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="h-full"
      >
        <Card className="h-full overflow-hidden rounded-[24px] border border-border/70 bg-white/92 shadow-[0_14px_28px_-24px_rgba(27,31,59,0.16)] transition-all duration-300 group-hover:border-primary/20 group-hover:bg-white group-hover:shadow-[0_22px_36px_-28px_hsl(var(--primary)/0.2)] group-active:translate-y-0.5">
          <div
            className={cn(
              "relative overflow-hidden bg-[hsl(var(--primary-light))]",
              isCompact ? "aspect-[5/4]" : "aspect-[4/3]"
            )}
          >
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={displayTitle}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.045]"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <TagIcon className="h-10 w-10 text-primary/25" />
              </div>
            )}

            <div className="absolute left-3 top-3 flex flex-wrap gap-2">
              <Badge
                className={cn(
                  "border-0 font-medium shadow-sm",
                  item.reportType === "found"
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                    : "bg-rose-500 hover:bg-rose-600 text-white"
                )}
              >
                {reportLabel}
              </Badge>

              <Badge
                variant="outline"
                className={cn(
                  "border font-medium shadow-sm",
                  item.status === "resolved"
                    ? "border-slate-300 bg-white/95 text-slate-700"
                    : "border-amber-200 bg-amber-50/95 text-amber-700"
                )}
              >
                {statusLabel}
              </Badge>

              {!isCompact && matchBadge ? (
                <Badge
                  variant="outline"
                  className={cn("font-medium shadow-sm border", matchBadge.className)}
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  {matchBadge.text}
                </Badge>
              ) : null}

              {!isCompact && distanceText ? (
                <Badge
                  variant="outline"
                  className="border-border/70 bg-white/95 font-medium text-slate-700 shadow-sm"
                >
                  <MapPin className="mr-1 h-3 w-3 text-primary/70" />
                  {distanceText}
                </Badge>
              ) : null}
            </div>
          </div>

          <CardContent
            className={cn("flex flex-col p-4", isCompact ? "space-y-2.5" : "space-y-3")}
          >
            <div className="space-y-2">
              <h3
                className={cn(
                  "text-base font-semibold leading-6 text-foreground transition-colors group-hover:text-primary",
                  "line-clamp-2 min-h-[3rem]"
                )}
              >
                {displayTitle}
              </h3>

              <div className="flex flex-col gap-1.5 pt-0.5 text-sm text-slate-600">
                {item.location ? (
                  <div className="flex items-center gap-2 leading-none">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-primary/50" />
                    <span className="truncate pt-px font-medium text-slate-600">
                      {item.location}
                    </span>
                  </div>
                ) : null}
                {item.date ? (
                  <div className="flex items-center gap-2 leading-none">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-primary/50" />
                    <span className="pt-px font-medium text-slate-600">
                      {format(
                        new Date(item.date),
                        showDateTime ? "PPP p" : "PPP",
                        { locale: ko }
                      )}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {!isCompact && item.tags && item.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {item.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full bg-[hsl(var(--primary-light))] px-2.5 py-1 text-xs font-medium text-primary/80"
                  >
                    {tag}
                  </span>
                ))}
                {item.tags.length > 3 ? (
                  <span className="inline-flex items-center rounded-full bg-[hsl(var(--primary-light))] px-2.5 py-1 text-xs font-medium text-primary/80">
                    +{item.tags.length - 3}
                  </span>
                ) : null}
              </div>
            ) : null}

            {!isCompact && reasoning ? (
              <div className="mt-2 overflow-hidden rounded-[18px] border border-primary/10 bg-[hsl(var(--primary-light))/0.7] transition-colors hover:bg-[hsl(var(--primary-light))]">
                <button
                  type="button"
                  onClick={toggleReason}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    왜 이 게시물이 매칭되었나요?
                  </span>
                  {isReasonExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5 text-primary/70" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-primary/70" />
                  )}
                </button>
                <AnimatePresence>
                  {isReasonExpanded ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="border-t border-primary/10 px-3 pb-2.5 pt-2 text-xs leading-relaxed text-slate-600">
                        {reasoning}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </motion.div>
    </Link>
  );
}
