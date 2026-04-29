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
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPrimaryItemImageUrl } from "@shared/item-images";
import type { Item } from "@shared/schema";
import { cn } from "@/lib/utils";

const INTERNAL_TAGS = new Set(["lost112", "police", "경찰청"]);

interface ItemCardProps {
  item: Item;
  score?: number;
  reasoning?: string;
  distanceText?: string;
  className?: string;
  variant?: "default" | "compact" | "list";
  showDateTime?: boolean;
  imageLoading?: "eager" | "lazy";
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

function isPlaceholderImageUrl(imageUrl?: string): boolean {
  if (!imageUrl) {
    return false;
  }
  const normalized = imageUrl.toLowerCase();
  return (
    normalized.includes("noimage") ||
    normalized.includes("no_img") ||
    normalized.includes("no-image") ||
    normalized.includes("ready") ||
    normalized.includes("placeholder")
  );
}

function splitLocation(location?: string | null): {
  primary: string;
  secondary?: string;
} | null {
  if (!location) {
    return null;
  }
  const [primary, ...rest] = location.split(" - ").map((value) => value.trim());
  return {
    primary,
    secondary: rest.join(" - ") || undefined,
  };
}

export function ItemCard({
  item,
  score,
  reasoning,
  distanceText,
  className,
  variant = "default",
  showDateTime = false,
  imageLoading = "lazy",
}: ItemCardProps) {
  const [isReasonExpanded, setIsExpanded] = useState(false);
  const reportLabel = item.reportType === "found" ? "습득" : "분실";
  const statusLabel = item.status === "resolved" ? "해결 완료" : "진행 중";
  const isCompact = variant === "compact" || variant === "list";
  const displayTitle = getDisplayTitle(item);
  const isLost112Item = item.externalSource === "lost112";
  const primaryImageUrl = getPrimaryItemImageUrl(item);
  const shouldShowImage =
    primaryImageUrl && !(isLost112Item && isPlaceholderImageUrl(primaryImageUrl));
  const hasVisualImage = Boolean(shouldShowImage);
  const displayLocation = splitLocation(item.location);
  const visibleTags = (item.tags ?? []).filter((tag) => !INTERNAL_TAGS.has(tag));

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
        whileHover={{ y: -2 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="h-full"
      >
        <Card className="h-full overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-all duration-200 group-hover:border-primary/30 group-hover:shadow-md group-active:translate-y-0.5">
          <div
            className={cn(
              "relative overflow-hidden bg-[hsl(var(--primary-light))]",
              isCompact
                ? hasVisualImage
                  ? "aspect-[5/4]"
                  : "aspect-[4/3]"
                : hasVisualImage
                  ? "aspect-[4/3]"
                  : "aspect-[16/9]"
            )}
          >
            {shouldShowImage ? (
              <img
                src={primaryImageUrl}
                alt={displayTitle}
                loading={imageLoading}
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.045]"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-secondary text-center">
                <div className="rounded-xl border border-border bg-white p-3">
                  {isLost112Item ? (
                    <ShieldCheck className="h-7 w-7 text-sky-500/75" />
                  ) : (
                    <TagIcon className="h-7 w-7 text-primary/45" />
                  )}
                </div>
                {!isCompact ? (
                  <span className="text-xs font-medium text-muted-foreground">
                    {isLost112Item ? "경찰청 등록 데이터" : "사진 없음"}
                  </span>
                ) : null}
              </div>
            )}

            <div className="absolute left-3 top-3 flex flex-wrap gap-2">
              <Badge
                className={cn(
                  "rounded-lg border-0 font-medium",
                  item.reportType === "found"
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                    : "bg-rose-500 hover:bg-rose-600 text-white"
                )}
              >
                {reportLabel}
              </Badge>

              {item.status === "resolved" || !isLost112Item ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-lg border font-medium",
                    item.status === "resolved"
                      ? "border-slate-300 bg-white/95 text-slate-700"
                      : "border-amber-200 bg-amber-50/95 text-amber-700"
                  )}
                >
                  {statusLabel}
                </Badge>
              ) : null}

              {isLost112Item ? (
                <Badge
                  variant="outline"
                  className="rounded-lg border-sky-200 bg-sky-50/95 font-medium text-sky-700"
                >
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  경찰청
                </Badge>
              ) : null}

              {!isCompact && matchBadge ? (
                <Badge
                  variant="outline"
                  className={cn("rounded-lg border font-medium", matchBadge.className)}
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  {matchBadge.text}
                </Badge>
              ) : null}

              {!isCompact && distanceText ? (
                <Badge
                  variant="outline"
                  className="rounded-lg border-border bg-white/95 font-medium text-slate-700"
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
                {displayLocation ? (
                  <div className="flex items-start gap-2 leading-snug">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-primary/50" />
                    <span className="min-w-0 pt-px">
                      <span className="block truncate font-semibold text-slate-700">
                        {displayLocation.primary}
                      </span>
                      {displayLocation.secondary ? (
                        <span className="block truncate text-xs font-medium text-slate-500">
                          {displayLocation.secondary}
                        </span>
                      ) : null}
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

            {!isCompact && visibleTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {visibleTags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-primary"
                  >
                    {tag}
                  </span>
                ))}
                {visibleTags.length > 2 ? (
                  <span className="inline-flex items-center rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-primary">
                    +{visibleTags.length - 2}
                  </span>
                ) : null}
              </div>
            ) : null}

            {!isCompact && reasoning ? (
              <div className="mt-2 overflow-hidden rounded-xl border border-primary/10 bg-accent transition-colors">
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
