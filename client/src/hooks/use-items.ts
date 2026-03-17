import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type ItemInput, type ItemResponse, type ItemsListResponse, type UpdateItemInput } from "@shared/routes";
import { z } from "zod";

function parseWithLogging<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

export function useItems(filters?: { type?: 'lost' | 'found', search?: string }) {
  const queryParams = new URLSearchParams();
  if (filters?.type) queryParams.set('type', filters.type);
  if (filters?.search) queryParams.set('search', filters.search);
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const url = `${api.items.list.path}${queryString}`;
  return useQuery({
    queryKey: [api.items.list.path, filters],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch items");
      const data = await res.json();
      return parseWithLogging(api.items.list.responses[200], data, "items.list");
    },
  });
}

export function useItem(id: number) {
  return useQuery({
    queryKey: [api.items.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.items.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch item");
      const data = await res.json();
      return parseWithLogging(api.items.get.responses[200], data, "items.get");
    },
    enabled: !!id,
  });
}

export function useMyItems() {
  return useQuery({
    queryKey: ['my-items'],
    queryFn: async () => {
      const res = await fetch(api.items.myItems.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch my items");
      return res.json() as Promise<ItemsListResponse>;
    },
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ItemInput) => {
      const validated = api.items.create.input.parse(data);
      const res = await fetch(api.items.create.path, {
        method: api.items.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      const resData = await res.json();
      if (!res.ok) {
        if (res.status === 400) {
          const error = parseWithLogging(api.items.create.responses[400], resData, "items.create.error");
          throw new Error(error.message);
        }
        throw new Error("Failed to create item");
      }
      return parseWithLogging(api.items.create.responses[201], resData, "items.create");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.items.list.path] });
      queryClient.invalidateQueries({ queryKey: ['my-items'] });
    },
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateItemInput }) => {
      const url = buildUrl(api.items.update.path, { id });
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? '수정에 실패했습니다');
      }
      return res.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [api.items.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.items.get.path, id] });
      queryClient.invalidateQueries({ queryKey: ['my-items'] });
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.items.delete.path, { id });
      const res = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? '삭제에 실패했습니다');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.items.list.path] });
      queryClient.invalidateQueries({ queryKey: ['my-items'] });
    },
  });
}
