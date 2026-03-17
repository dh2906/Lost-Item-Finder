import { useState } from "react";
import { Share2, Copy, Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface ShareButtonProps {
  itemId: number;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
}

export function ShareButton({ itemId, title, description, imageUrl }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const itemUrl = `${window.location.origin}/item/${itemId}`;
  const shareText = `[ReturnIt] ${title}${description ? `\n${description.slice(0, 60)}` : ""}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(itemUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "링크가 복사되었습니다" });
    } catch {
      toast({ variant: "destructive", title: "클립보드 접근에 실패했습니다" });
    }
  };

  const handleKakao = () => {
    const kakaoKey = import.meta.env.VITE_KAKAO_JS_KEY;
    if (kakaoKey && window.Kakao) {
      if (!window.Kakao.isInitialized()) {
        window.Kakao.init(kakaoKey);
      }
      window.Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title,
          description: description ?? "롌턴잏에서 확인하세요",
          imageUrl: imageUrl ?? `${window.location.origin}/og-default.png`,
          link: { mobileWebUrl: itemUrl, webUrl: itemUrl },
        },
        buttons: [
          { title: "게시물 보기", link: { mobileWebUrl: itemUrl, webUrl: itemUrl } },
        ],
      });
    } else {
      // 폴백: URL 쿠에리 방식
      window.open(
        `https://sharer.kakao.com/talk/friends/picker/link?url=${encodeURIComponent(itemUrl)}`,
        "_blank",
        "width=500,height=600"
      );
    }
  };

  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url: itemUrl });
      } catch {
        // 사용자 취소
      }
    } else {
      await handleCopy();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-full">
          <Share2 className="h-4 w-4" />
          공유
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={handleCopy} className="gap-2">
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          링크 복사
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleKakao} className="gap-2">
          <MessageCircle className="h-4 w-4 text-yellow-500" />
          카카오톡 공유
        </DropdownMenuItem>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <DropdownMenuItem onClick={handleWebShare} className="gap-2">
            <Share2 className="h-4 w-4" />
            더 보기...
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// 커스텀 Window 타입 확장
declare global {
  interface Window {
    Kakao?: {
      init: (key: string) => void;
      isInitialized: () => boolean;
      Share: {
        sendDefault: (params: object) => void;
      };
    };
  }
}
