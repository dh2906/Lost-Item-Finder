import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  buildUrl,
  type MatchNotificationsResponse,
} from "@shared/routes";
import {
  AUTH_QUERY_KEY,
  MATCH_NOTIFICATIONS_QUERY_KEY,
} from "@/lib/query-keys";
import { useAuth } from "./use-auth";

export function useMatchNotifications() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  return useQuery<MatchNotificationsResponse>({
    queryKey: [...MATCH_NOTIFICATIONS_QUERY_KEY, user?.id ?? "guest"],
    queryFn: async () => {
      const res = await fetch(api.notifications.list.path, {
        credentials: "include",
      });

      if (res.status === 401) {
        void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
        return [];
      }

      if (!res.ok) {
        throw new Error("자동 매칭 알림을 불러오지 못했어요.");
      }

      return api.notifications.list.responses[200].parse(await res.json());
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useMarkMatchNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: number) => {
      const res = await fetch(
        buildUrl(api.notifications.markRead.path, { id: notificationId }),
        {
          method: api.notifications.markRead.method,
          credentials: "include",
        }
      );

      const responseData = await res.json();

      if (!res.ok) {
        if (res.status === 404) {
          const error = api.notifications.markRead.responses[404].parse(
            responseData
          );
          throw new Error(error.message);
        }

        throw new Error("알림을 읽음 처리하지 못했어요.");
      }

      return api.notifications.markRead.responses[200].parse(responseData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MATCH_NOTIFICATIONS_QUERY_KEY });
    },
  });
}
