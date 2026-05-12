import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import {
  api,
  type AnalyzeImageInput,
  type AnalyzeImageResponse,
  type SearchSimilarInput,
  type SearchSimilarResponse,
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

async function readJsonResponse(res: Response): Promise<unknown> {
  const responseText = await res.text();
  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText);
  } catch {
    const fallbackMessage = res.ok
      ? "서버 응답을 해석하지 못했습니다."
      : "서버에서 오류 페이지를 반환했습니다. 잠시 후 다시 시도해 주세요.";
    throw new Error(fallbackMessage);
  }
}

export function useAnalyzeImage(): UseMutationResult<AnalyzeImageResponse, Error, AnalyzeImageInput> {
  return useMutation({
    mutationFn: async (data: AnalyzeImageInput) => {
      const validated = api.ai.analyzeImage.input.parse(data);
      const res = await fetch(api.ai.analyzeImage.path, {
        method: api.ai.analyzeImage.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      const resData = await readJsonResponse(res);
      
      if (!res.ok) {
        const message =
          resData &&
          typeof resData === "object" &&
          "message" in resData &&
          typeof resData.message === "string"
            ? resData.message
            : "Failed to analyze image";
        throw new Error(message);
      }
      return parseWithLogging(api.ai.analyzeImage.responses[200], resData, "ai.analyzeImage");
    },
  });
}

export function useSearchSimilar(): UseMutationResult<SearchSimilarResponse, Error, SearchSimilarInput> {
  return useMutation({
    mutationFn: async (data: SearchSimilarInput) => {
      const validated = api.ai.searchSimilar.input.parse(data);
      const res = await fetch(api.ai.searchSimilar.path, {
        method: api.ai.searchSimilar.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      const resData = await readJsonResponse(res);
      
      if (!res.ok) {
        const message =
          resData &&
          typeof resData === "object" &&
          "message" in resData &&
          typeof resData.message === "string"
            ? resData.message
            : "Failed to search items";
        throw new Error(message);
      }
      return parseWithLogging(api.ai.searchSimilar.responses[200], resData, "ai.searchSimilar");
    },
  });
}
