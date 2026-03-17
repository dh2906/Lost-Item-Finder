import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "./use-toast";

export function useBookmarks() {
  return useQuery({
    queryKey: ["bookmarks"],
    queryFn: async () => {
      const res = await fetch("/api/bookmarks", { credentials: "include" });
      if (!res.ok) return [];
      return res.json() as Promise<{ id: number; itemId: number; createdAt: string }[]>;
    },
  });
}

export function useBookmarkToggle(itemId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: bookmarks } = useBookmarks();
  const isBookmarked = bookmarks?.some((b) => b.itemId === itemId) ?? false;

  const mutation = useMutation({
    mutationFn: async () => {
      const method = isBookmarked ? "DELETE" : "POST";
      const res = await fetch("/api/bookmarks", {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ itemId }),
      });
      if (!res.ok) throw new Error("북마크 처리에 실패했습니다");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast({ title: isBookmarked ? "북마크가 해제되었습니다" : "북마크에 추가되었습니다" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: err.message });
    },
  });

  return { isBookmarked, toggle: () => mutation.mutate(), isPending: mutation.isPending };
}
