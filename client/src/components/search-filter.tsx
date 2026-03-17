import { useState } from "react";
import { SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const CATEGORIES = ["전체", "지갑", "휴대폰", "열쇠", "가방", "카드", "이어폰", "안경", "우산", "의류", "기타"];

export interface FilterState {
  category: string;
  dateFrom: string;
  dateTo: string;
  sort: "latest" | "oldest";
}

export const DEFAULT_FILTER: FilterState = {
  category: "전체",
  dateFrom: "",
  dateTo: "",
  sort: "latest",
};

interface SearchFilterProps {
  value: FilterState;
  onChange: (v: FilterState) => void;
  className?: string;
}

export function SearchFilter({ value, onChange, className }: SearchFilterProps) {
  const [open, setOpen] = useState(false);

  const activeCount =
    (value.category !== "전체" ? 1 : 0) +
    (value.dateFrom ? 1 : 0) +
    (value.dateTo ? 1 : 0) +
    (value.sort !== "latest" ? 1 : 0);

  const handleReset = () => onChange(DEFAULT_FILTER);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-full border-border/60 bg-white gap-2 shadow-sm"
          onClick={() => setOpen(!open)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          필터
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
          {activeCount > 0 && (
            <Badge className="ml-0.5 h-5 min-w-5 rounded-full px-1 py-0 text-[11px] flex items-center justify-center">
              {activeCount}
            </Badge>
          )}
        </Button>

        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 rounded-full text-xs text-muted-foreground"
            onClick={handleReset}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            전체 초기화
          </Button>
        )}
      </div>

      {open && (
        <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm space-y-4">
          {/* Category */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">카테고리</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => onChange({ ...value, category: cat })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    value.category === cat
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/60 bg-white text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">시작 날짜</label>
              <input
                type="date"
                value={value.dateFrom}
                onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
                className="w-full rounded-xl border border-border/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">종료 날짜</label>
              <input
                type="date"
                value={value.dateTo}
                onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
                className="w-full rounded-xl border border-border/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Sort */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">정렬</p>
            <Select
              value={value.sort}
              onValueChange={(v) => onChange({ ...value, sort: v as FilterState["sort"] })}
            >
              <SelectTrigger className="h-9 w-36 rounded-full border-border/60 bg-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">최신순</SelectItem>
                <SelectItem value="oldest">오래된순</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}

export function applyFilters<T extends { itemCategory?: string | null; date?: Date | string | null }>(items: T[], filter: FilterState): T[] {
  return items
    .filter((item) => {
      if (filter.category !== "전체" && !item.itemCategory?.includes(filter.category)) return false;
      if (filter.dateFrom) {
        const d = item.date ? new Date(item.date) : null;
        if (!d || d < new Date(filter.dateFrom)) return false;
      }
      if (filter.dateTo) {
        const d = item.date ? new Date(item.date) : null;
        if (!d || d > new Date(filter.dateTo + "T23:59:59")) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return filter.sort === "latest" ? db - da : da - db;
    });
}
