import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@shared/routes";
import {
  AUTH_QUERY_KEY,
  FAVORITES_QUERY_KEY,
  MATCH_NOTIFICATIONS_QUERY_KEY,
} from "@/lib/query-keys";
import { useToast } from "./use-toast";

export interface User {
  id: number;
  username: string;
  name: string | null;
  role: "member" | "admin";
  status: "active" | "suspended";
  createdAt: string | null;
}

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
      queryClient.removeQueries({ queryKey: FAVORITES_QUERY_KEY });
      queryClient.removeQueries({ queryKey: MATCH_NOTIFICATIONS_QUERY_KEY });
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
