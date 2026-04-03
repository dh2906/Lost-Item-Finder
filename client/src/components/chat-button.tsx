import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface ChatButtonProps {
  itemId: number;
  receiverId: number;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function ChatButton({
  itemId,
  receiverId,
  variant = "default",
  size = "default",
  className,
}: ChatButtonProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const createRoomMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/chat/rooms", {
        itemId,
        receiverId,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setLocation(`/chat/${data.id}`);
    },
    onError: (error: Error) => {
      if (error.message.includes("401") || error.message.includes("로그인")) {
        toast({
          variant: "destructive",
          title: "로그인이 필요합니다",
          description: "채팅을 시작하려면 먼저 로그인해주세요.",
        });
        setLocation("/login");
      } else {
        toast({
          variant: "destructive",
          title: "오류가 발생했습니다",
          description: error.message,
        });
      }
    },
  });

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => createRoomMutation.mutate()}
      disabled={createRoomMutation.isPending}
    >
      <MessageCircle className="mr-2 h-4 w-4" />
      {createRoomMutation.isPending ? "연락 준비 중..." : "연락하기"}
    </Button>
  );
}
