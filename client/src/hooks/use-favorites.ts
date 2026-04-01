import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  buildUrl,
  type FavoriteInput,
  type FavoriteItemsResponse,
} from "@shared/routes";
import { useAuth } from "./use-auth";
import { useToast } from "./use-toast";

export const FAVORITES_QUERY_KEY = ["favorites"] as const;

export function useFavoriteItems() {
  const { user, isAuthenticated } = useAuth();

  return useQuery<FavoriteItemsResponse>({
    queryKey: [...FAVORITES_QUERY_KEY, user?.id ?? "guest"],
    queryFn: async () => {
      const res = await fetch(api.favorites.list.path, {
        credentials: "include",
      });

      if (res.status === 401) {
        return [];
      }

      if (!res.ok) {
        throw new Error("관심 게시물을 불러오지 못했습니다.");
      }

      return api.favorites.list.responses[200].parse(await res.json());
    },
    enabled: isAuthenticated,
  });
}

export function useAddFavorite() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: FavoriteInput) => {
      const validated = api.favorites.add.input.parse(data);
      const res = await fetch(api.favorites.add.path, {
        method: api.favorites.add.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(validated),
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(
          typeof responseData?.message === "string"
            ? responseData.message
            : "관심 게시물 등록에 실패했습니다."
        );
      }

      return api.favorites.add.responses[201].parse(responseData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FAVORITES_QUERY_KEY });
      toast({ title: "관심 게시물에 저장했습니다." });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title:
          error instanceof Error
            ? error.message
            : "관심 게시물 등록에 실패했습니다.",
      });
    },
  });
}

export function useRemoveFavorite() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (itemId: number) => {
      const res = await fetch(buildUrl(api.favorites.remove.path, { itemId }), {
        method: api.favorites.remove.method,
        credentials: "include",
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(
          typeof responseData?.message === "string"
            ? responseData.message
            : "관심 게시물 제거에 실패했습니다."
        );
      }

      return api.favorites.remove.responses[200].parse(responseData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FAVORITES_QUERY_KEY });
      toast({ title: "관심 게시물에서 제거했습니다." });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title:
          error instanceof Error
            ? error.message
            : "관심 게시물 제거에 실패했습니다.",
      });
    },
  });
}
