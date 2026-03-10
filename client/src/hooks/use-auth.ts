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

export function useAuth() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["user"],
    queryFn: async () => {
      const res = await fetch(api.auth.me.path, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
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
      queryClient.setQueryData(["user"], null);
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
    isAuthenticated: !!user,
    logout: () => logoutMutation.mutate(),
  };
}