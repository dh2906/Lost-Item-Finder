import { z } from 'zod';
import { insertItemSchema, items, User } from './schema';

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
      method: 'POST' as const,
      path: '/api/auth/register' as const,
      input: z.object({
        username: z.string().min(3, '아이디는 3자 이상이어야 합니다'),
        password: z.string().min(4, '비밀번호는 4자 이상이어야 합니다'),
        name: z.string().optional(),
      }),
      responses: {
        201: z.custom<User>(),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
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
      method: 'POST' as const,
      path: '/api/auth/logout' as const,
      input: z.void(),
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me' as const,
      responses: {
        200: z.custom<User>().nullable(),
      },
    },
  },
  items: {
    list: {
      method: 'GET' as const,
      path: '/api/items' as const,
      input: z.object({
        type: z.enum(['lost', 'found']).optional(),
        search: z.string().optional()
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof items.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/items/:id' as const,
      responses: {
        200: z.custom<typeof items.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/items' as const,
      input: insertItemSchema,
      responses: {
        201: z.custom<typeof items.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  ai: {
    analyzeImage: {
      method: 'POST' as const,
      path: '/api/ai/analyze-image' as const,
      input: z.object({
        imageUrl: z.string() // base64 string
      }),
      responses: {
        200: z.object({
          itemCategory: z.string(),
          color: z.string(),
          size: z.string(),
          tags: z.array(z.string()),
          description: z.string()
        }),
        400: errorSchemas.validation,
        500: errorSchemas.internal
      }
    },
    searchSimilar: {
      method: 'POST' as const,
      path: '/api/ai/search' as const,
      input: z.object({
        prompt: z.string().optional(),
        imageUrl: z.string().optional() // base64 string
      }),
      responses: {
        200: z.array(z.object({
          item: z.custom<typeof items.$inferSelect>(),
          score: z.number(),
          reasoning: z.string()
        })),
        400: errorSchemas.validation,
        500: errorSchemas.internal
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
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
export type ItemResponse = z.infer<typeof api.items.create.responses[201]>;
export type ItemsListResponse = z.infer<typeof api.items.list.responses[200]>;
export type AnalyzeImageInput = z.infer<typeof api.ai.analyzeImage.input>;
export type AnalyzeImageResponse = z.infer<typeof api.ai.analyzeImage.responses[200]>;
export type SearchSimilarInput = z.infer<typeof api.ai.searchSimilar.input>;
export type SearchSimilarResponse = z.infer<typeof api.ai.searchSimilar.responses[200]>;
