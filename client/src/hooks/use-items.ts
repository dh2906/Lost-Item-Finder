import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  buildUrl,
  type ItemInput,
  type ItemResponse,
  type ItemsListFilters,
  type ItemsListResponse,
  type MyItemsResponse,
  type UpdateItemInput,
} from "@shared/routes";
import { z } from "zod";
import { MY_ITEMS_QUERY_KEY } from "@/lib/query-keys";

function parseWithLogging<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

export function useItems(filters?: Partial<ItemsListFilters>) {
  const queryParams = new URLSearchParams();
  if (filters?.type) queryParams.set("type", filters.type);
  if (filters?.search) queryParams.set("search", filters.search);
  if (filters?.category) queryParams.set("category", filters.category);
  if (filters?.color) queryParams.set("color", filters.color);
  if (filters?.location) queryParams.set("location", filters.location);
  if (filters?.source) queryParams.set("source", filters.source);
  if (filters?.latitude !== undefined) queryParams.set("latitude", String(filters.latitude));
  if (filters?.longitude !== undefined) queryParams.set("longitude", String(filters.longitude));
  if (filters?.radiusKm !== undefined) queryParams.set("radiusKm", String(filters.radiusKm));
  if (filters?.dateRange) queryParams.set("dateRange", filters.dateRange);
  if (filters?.sort) queryParams.set("sort", filters.sort);
  if (filters?.page) queryParams.set("page", String(filters.page));
  if (filters?.limit) queryParams.set("limit", String(filters.limit));
  
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
  const url = `${api.items.list.path}${queryString}`;

  return useQuery({
    queryKey: [api.items.list.path, filters],
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch items");
      const data = await res.json();
      return parseWithLogging(api.items.list.responses[200], data, "items.list");
    },
  });
}

export function useMyItems(filters?: {
  type?: "lost" | "found";
  status?: "active" | "resolved";
}) {
  const queryParams = new URLSearchParams();
  if (filters?.type) queryParams.set("type", filters.type);
  if (filters?.status) queryParams.set("status", filters.status);

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
  const url = `${api.items.mine.path}${queryString}`;

  return useQuery<MyItemsResponse>({
    queryKey: [...MY_ITEMS_QUERY_KEY, filters],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch my items");
      const data = await res.json();
      return parseWithLogging(api.items.mine.responses[200], data, "items.mine");
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
      queryClient.invalidateQueries({ queryKey: MY_ITEMS_QUERY_KEY });
    },
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      data,
    }: {
      itemId: number;
      data: UpdateItemInput;
    }) => {
      const validated = api.items.update.input.parse(data);
      const res = await fetch(buildUrl(api.items.update.path, { id: itemId }), {
        method: api.items.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      const resData = await res.json();

      if (!res.ok) {
        if (res.status === 400) {
          const error = parseWithLogging(
            api.items.update.responses[400],
            resData,
            "items.update.error"
          );
          throw new Error(error.message);
        }

        if (res.status === 404) {
          const error = parseWithLogging(
            api.items.update.responses[404],
            resData,
            "items.update.notFound"
          );
          throw new Error(error.message);
        }

        throw new Error("Failed to update item");
      }

      return parseWithLogging(api.items.update.responses[200], resData, "items.update");
    },
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: [api.items.list.path] });
      queryClient.invalidateQueries({ queryKey: MY_ITEMS_QUERY_KEY });
      queryClient.setQueryData([api.items.get.path, item.id], item);
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: number) => {
      const res = await fetch(buildUrl(api.items.delete.path, { id: itemId }), {
        method: api.items.delete.method,
        credentials: "include",
      });

      const resData = await res.json();

      if (!res.ok) {
        if (res.status === 404) {
          const error = parseWithLogging(
            api.items.delete.responses[404],
            resData,
            "items.delete.notFound"
          );
          throw new Error(error.message);
        }

        throw new Error("Failed to delete item");
      }

      return parseWithLogging(api.items.delete.responses[200], resData, "items.delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.items.list.path] });
      queryClient.invalidateQueries({ queryKey: MY_ITEMS_QUERY_KEY });
    },
  });
}
