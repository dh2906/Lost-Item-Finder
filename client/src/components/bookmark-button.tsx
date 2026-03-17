import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBookmarkToggle } from "@/hooks/use-bookmark";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface BookmarkButtonProps {
  itemId: number;
  className?: string;
  size?: "sm" | "default" | "icon";
}

export function BookmarkButton({ itemId, className, size = "sm" }: BookmarkButtonProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { isBookmarked, toggle, isPending } = useBookmarkToggle(itemId);

  const handleClick = () => {
    if (!isAuthenticated) {
      toast({ variant: "destructive", title: "로그인이 필요합니다", description: "북마크를 사용하려면 로그인해 주세요." });
      return;
    }
    toggle();
  };

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        "gap-1.5 rounded-full transition-colors",
        isBookmarked && "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
        className
      )}
      aria-label={isBookmarked ? "북마크 해제" : "북마크 추가"}
    >
      <Bookmark
        className={cn(
          "h-4 w-4 transition-all",
          isBookmarked && "fill-amber-500 text-amber-500"
        )}
      />
      {size !== "icon" && (isBookmarked ? "저장됨" : "저장")}
    </Button>
  );
}
