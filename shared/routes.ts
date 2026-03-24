import { z } from "zod";
import {
  insertItemSchema,
  items,
  itemMatchStatuses,
  updateItemMatchStatusSchema,
  User,
} from "./schema";

const matchResponseSchema = z.object({
  id: z.number(),
  lostItemId: z.number(),
  foundItemId: z.number(),
  score: z.number().min(0).max(1),
  matchReason: z.string(),
  status: z.enum(itemMatchStatuses),
  notifiedAt: z.union([z.string(), z.date()]).nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
  lostItem: z.custom<typeof items.$inferSelect>(),
  foundItem: z.custom<typeof items.$inferSelect>(),
});

const createdItemResponseSchema = z.object({
  id: z.number(),
  userId: z.number().nullable(),
  reportType: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  itemCategory: z.string().nullable(),
  color: z.string().nullable(),
  size: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  location: z.string().nullable(),
  latitude: z.string().nullable(),
  longitude: z.string().nullable(),
  date: z.union([z.string(), z.date()]).nullable(),
  contactInfo: z.string().nullable(),
  automaticMatchCount: z.number().optional(),
});

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    register: {
      method: "POST" as const,
      path: "/api/auth/register" as const,
      input: z.object({
        username: z.string().min(3, "아이디는 3자 이상이어야 합니다"),
        password: z.string().min(4, "비밀번호는 4자 이상이어야 합니다"),
        name: z.string().optional(),
      }),
      responses: {
        201: z.custom<User>(),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: "POST" as const,
      path: "/api/auth/login" as const,
      input: z.object({
        username: z.string(),
        password: z.string(),
      }),
      responses: {
        200: z.custom<User>(),
        401: errorSchemas.validation,
      },
    },
    logout: {
      method: "POST" as const,
      path: "/api/auth/logout" as const,
      input: z.void(),
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    me: {
      method: "GET" as const,
      path: "/api/auth/me" as const,
      responses: {
        200: z.custom<User>().nullable(),
      },
    },
  },
  items: {
    list: {
      method: "GET" as const,
      path: "/api/items" as const,
      input: z
        .object({
          type: z.enum(["lost", "found"]).optional(),
          search: z.string().optional(),
        })
        .optional(),
      responses: {
        200: z.array(z.custom<typeof items.$inferSelect>()),
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/items/:id" as const,
      responses: {
        200: z.custom<typeof items.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/items" as const,
      input: insertItemSchema,
      responses: {
        201: createdItemResponseSchema,
        400: errorSchemas.validation,
      },
    },
  },
  matches: {
    list: {
      method: "GET" as const,
      path: "/api/matches" as const,
      responses: {
        200: z.array(matchResponseSchema),
      },
    },
    getByItem: {
      method: "GET" as const,
      path: "/api/items/:id/matches" as const,
      responses: {
        200: z.array(matchResponseSchema),
        404: errorSchemas.notFound,
      },
    },
    updateStatus: {
      method: "PATCH" as const,
      path: "/api/matches/:id" as const,
      input: updateItemMatchStatusSchema,
      responses: {
        200: matchResponseSchema,
        404: errorSchemas.notFound,
        400: errorSchemas.validation,
      },
    },
  },
  ai: {
    analyzeImage: {
      method: "POST" as const,
      path: "/api/ai/analyze-image" as const,
      input: z.object({
        imageUrl: z.string(), // base64 string
      }),
      responses: {
        200: z.object({
          title: z.string(),
          itemCategory: z.string(),
          color: z.string(),
          size: z.string(),
          tags: z.array(z.string()),
          description: z.string(),
          maskedImage: z.string().optional(),
        }),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
    searchSimilar: {
      method: "POST" as const,
      path: "/api/ai/search" as const,
      input: z.object({
        prompt: z.string().optional(),
        imageUrl: z.string().optional(), // base64 string
        latitude: z.string().optional(),
        longitude: z.string().optional(),
      }),
      responses: {
        200: z.array(
          z.object({
            item: z.custom<typeof items.$inferSelect>(),
            score: z.number(),
            reasoning: z.string(),
            distanceKm: z.number().nullable().optional(),
          })
        ),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
  },
};

export function buildUrl(
  path: string,
  params?: Record<string, string | number>
): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type ItemInput = z.infer<typeof api.items.create.input>;
export type ItemResponse = z.infer<(typeof api.items.create.responses)[201]>;
export type ItemsListResponse = z.infer<(typeof api.items.list.responses)[200]>;
export type AnalyzeImageInput = z.infer<typeof api.ai.analyzeImage.input>;
export type AnalyzeImageResponse = z.infer<
  (typeof api.ai.analyzeImage.responses)[200]
>;
export type MatchListResponse = z.infer<(typeof api.matches.list.responses)[200]>;
export type MatchResponse = MatchListResponse[number];
export type UpdateMatchStatusInput = z.infer<typeof api.matches.updateStatus.input>;
export type SearchSimilarInput = z.infer<typeof api.ai.searchSimilar.input>;
export type SearchSimilarResponse = z.infer<
  (typeof api.ai.searchSimilar.responses)[200]
>;
