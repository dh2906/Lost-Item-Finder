import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  buildUrl,
  type MatchListResponse,
  type MatchResponse,
  type UpdateMatchStatusInput,
} from "@shared/routes";
import { z } from "zod";

function parseWithLogging<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

export function useMatches(enabled = true) {
  return useQuery<MatchListResponse>({
    queryKey: [api.matches.list.path],
    queryFn: async () => {
      const res = await fetch(api.matches.list.path, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to fetch matches");
      }
      const data = await res.json();
      return parseWithLogging(api.matches.list.responses[200], data, "matches.list");
    },
    enabled,
  });
}

export function useItemMatches(itemId: number, enabled = true) {
  return useQuery<MatchListResponse>({
    queryKey: [api.matches.getByItem.path, itemId],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.matches.getByItem.path, { id: itemId }), {
        credentials: "include",
      });
      if (res.status === 404) {
        return [];
      }
      if (!res.ok) {
        throw new Error("Failed to fetch item matches");
      }
      const data = await res.json();
      return parseWithLogging(api.matches.getByItem.responses[200], data, "matches.getByItem");
    },
    enabled: enabled && itemId > 0,
  });
}

export function useUpdateMatchStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { matchId: number; status: UpdateMatchStatusInput["status"] }) => {
      const validated = api.matches.updateStatus.input.parse({ status: params.status });
      const res = await fetch(buildUrl(api.matches.updateStatus.path, { id: params.matchId }), {
        method: api.matches.updateStatus.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || "Failed to update match status");
      }

      return parseWithLogging(api.matches.updateStatus.responses[200], data, "matches.updateStatus");
    },
    onSuccess: (updatedMatch: MatchResponse) => {
      queryClient.invalidateQueries({ queryKey: [api.matches.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.matches.getByItem.path, updatedMatch.lostItemId] });
      queryClient.invalidateQueries({ queryKey: [api.matches.getByItem.path, updatedMatch.foundItemId] });
    },
  });
}
