import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@shared/routes";
import { useToast } from "./use-toast";

export interface User {
  id: number;
  username: string;
  name: string | null;
  createdAt: string | null;
}

/** 전역 공유 queryKey — 모든 곳에서 이 상수를 사용해 일관성 유지 */
export const AUTH_QUERY_KEY = ["user"] as const;

export function useAuth() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user, isLoading, isError, error, refetch } = useQuery<User | null>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch(api.auth.me.path, { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) {
        throw new Error("사용자 정보를 불러오지 못했습니다.");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(api.auth.logout.path, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("로그아웃 실패");
      return res.json();
    },
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
      toast({ title: "로그아웃 되었습니다" });
      setLocation("/");
    },
    onError: () => {
      toast({ variant: "destructive", title: "로그아웃 실패" });
    },
  });

  return {
    user,
    isLoading,
    isError,
    error,
    isAuthenticated: !!user,
    refetch,
    logout: () => logoutMutation.mutate(),
  };
}
