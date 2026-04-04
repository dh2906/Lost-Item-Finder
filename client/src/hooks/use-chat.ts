import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface ChatUser {
  id: number;
  username: string;
  name: string | null;
}

export interface ChatItem {
  id: number;
  title: string;
  reportType: string;
}

export interface ChatRoom {
  id: number;
  itemId: number;
  senderId: number;
  receiverId: number;
  createdAt: string | null;
  updatedAt: string | null;
  hasUnread?: boolean;
  latestMessage?: {
    content: string;
    senderId: number;
  } | null;
  item?: ChatItem;
  sender?: ChatUser;
  receiver?: ChatUser;
  otherUser?: ChatUser;
}

export interface ChatMessage {
  id: number;
  roomId: number;
  senderId: number;
  content: string;
  isRead: number | null;
  createdAt: string | null;
  sender?: ChatUser;
}

export function useChatRooms(enabled = true) {
  return useQuery<ChatRoom[]>({
    queryKey: ["/api/chat/rooms"],
    queryFn: async () => {
      const res = await fetch("/api/chat/rooms", { credentials: "include" });
      if (res.status === 401) {
        return [];
      }
      if (!res.ok) {
        throw new Error("채팅 목록을 불러오지 못했습니다");
      }
      return res.json();
    },
    enabled,
    refetchInterval: enabled ? 1000 : false,
  });
}

export function useChatMessages(roomId: number) {
  return useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/rooms", roomId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/chat/rooms/${roomId}/messages`, { credentials: "include" });
      if (!res.ok) {
        throw new Error("채팅 메시지를 불러오지 못했습니다");
      }
      return res.json();
    },
    enabled: Number.isFinite(roomId) && roomId > 0,
    refetchInterval: 3000,
  });
}

export function useSendChatMessage(roomId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/chat/rooms/${roomId}/messages`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/rooms", roomId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/rooms"] });
    },
  });
}
