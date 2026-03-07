import { useMutation } from "@tanstack/react-query";
import { api, type AnalyzeImageInput, type SearchSimilarInput } from "@shared/routes";
import { z } from "zod";

function parseWithLogging<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

export function useAnalyzeImage() {
  return useMutation({
    mutationFn: async (data: AnalyzeImageInput) => {
      const validated = api.ai.analyzeImage.input.parse(data);
      const res = await fetch(api.ai.analyzeImage.path, {
        method: api.ai.analyzeImage.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      const resData = await res.json();
      
      if (!res.ok) {
        throw new Error(resData.message || "Failed to analyze image");
      }
      return parseWithLogging(api.ai.analyzeImage.responses[200], resData, "ai.analyzeImage");
    },
  });
}

export function useSearchSimilar() {
  return useMutation({
    mutationFn: async (data: SearchSimilarInput) => {
      const validated = api.ai.searchSimilar.input.parse(data);
      const res = await fetch(api.ai.searchSimilar.path, {
        method: api.ai.searchSimilar.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      const resData = await res.json();
      
      if (!res.ok) {
        throw new Error(resData.message || "Failed to search items");
      }
      return parseWithLogging(api.ai.searchSimilar.responses[200], resData, "ai.searchSimilar");
    },
  });
}
