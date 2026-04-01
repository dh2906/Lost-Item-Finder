import { z } from "zod";
import { insertItemSchema, items, userRoles, userStatuses } from "./schema";

const favoriteItemSchema = z.object({
  item: z.custom<typeof items.$inferSelect>(),
  createdAt: z.string().datetime(),
});

const safeUserResponseSchema = z.object({
  id: z.number(),
  username: z.string(),
  name: z.string().nullable(),
  role: z.enum(userRoles),
  status: z.enum(userStatuses),
  createdAt: z.union([z.string(), z.date()]).nullable(),
});

const adminUserResponseSchema = z.object({
  id: z.number(),
  username: z.string(),
  name: z.string().nullable(),
  role: z.enum(userRoles),
  status: z.enum(userStatuses),
  createdAt: z.union([z.string(), z.date()]).nullable(),
  itemCount: z.number(),
});

const adminItemResponseSchema = z.object({
  id: z.number(),
  userId: z.number().nullable(),
  ownerName: z.string().nullable(),
  ownerUsername: z.string().nullable(),
  reportType: z.enum(["lost", "found"]),
  title: z.string(),
  description: z.string().nullable(),
  itemCategory: z.string().nullable(),
  location: z.string().nullable(),
  statusLabel: z.string(),
  date: z.union([z.string(), z.date()]).nullable(),
});

const adminDashboardResponseSchema = z.object({
  stats: z.object({
    totalUsers: z.number(),
    activeUsers: z.number(),
    suspendedUsers: z.number(),
    adminUsers: z.number(),
    totalItems: z.number(),
    lostItems: z.number(),
    foundItems: z.number(),
    recentItems: z.number(),
  }),
  recentUsers: z.array(adminUserResponseSchema),
  recentItems: z.array(adminItemResponseSchema),
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
        username: z.string().min(3, "아이디는 3자 이상이어야 합니다."),
        password: z.string().min(4, "비밀번호는 4자 이상이어야 합니다."),
        name: z.string().optional(),
      }),
      responses: {
        201: safeUserResponseSchema,
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
        200: safeUserResponseSchema,
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
        200: safeUserResponseSchema.nullable(),
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
        201: z.custom<typeof items.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  favorites: {
    list: {
      method: "GET" as const,
      path: "/api/favorites" as const,
      responses: {
        200: z.array(favoriteItemSchema),
      },
    },
    add: {
      method: "POST" as const,
      path: "/api/favorites" as const,
      input: z.object({
        itemId: z.number().int().positive(),
      }),
      responses: {
        201: z.object({
          message: z.string(),
        }),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    remove: {
      method: "DELETE" as const,
      path: "/api/favorites/:itemId" as const,
      responses: {
        200: z.object({
          message: z.string(),
        }),
      },
    },
  },
  ai: {
    analyzeImage: {
      method: "POST" as const,
      path: "/api/ai/analyze-image" as const,
      input: z.object({
        imageUrl: z.string(),
      }),
      responses: {
        200: z.object({
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
        imageUrl: z.string().optional(),
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
  admin: {
    dashboard: {
      method: "GET" as const,
      path: "/api/admin/dashboard" as const,
      responses: {
        200: adminDashboardResponseSchema,
      },
    },
    users: {
      method: "GET" as const,
      path: "/api/admin/users" as const,
      input: z
        .object({
          search: z.string().optional(),
          role: z.enum(userRoles).optional(),
          status: z.enum(userStatuses).optional(),
        })
        .optional(),
      responses: {
        200: z.array(adminUserResponseSchema),
      },
    },
    updateUser: {
      method: "PATCH" as const,
      path: "/api/admin/users/:id" as const,
      input: z
        .object({
          role: z.enum(userRoles).optional(),
          status: z.enum(userStatuses).optional(),
        })
        .refine((value) => value.role !== undefined || value.status !== undefined, {
          message: "At least one field must be provided",
        }),
      responses: {
        200: adminUserResponseSchema,
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    items: {
      method: "GET" as const,
      path: "/api/admin/items" as const,
      input: z
        .object({
          search: z.string().optional(),
          type: z.enum(["lost", "found"]).optional(),
        })
        .optional(),
      responses: {
        200: z.array(adminItemResponseSchema),
      },
    },
    deleteItem: {
      method: "DELETE" as const,
      path: "/api/admin/items/:id" as const,
      responses: {
        200: z.object({ success: z.literal(true) }),
        404: errorSchemas.notFound,
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
export type FavoriteItemsResponse = z.infer<
  (typeof api.favorites.list.responses)[200]
>;
export type FavoriteInput = z.infer<typeof api.favorites.add.input>;
export type SearchSimilarInput = z.infer<typeof api.ai.searchSimilar.input>;
export type SearchSimilarResponse = z.infer<
  (typeof api.ai.searchSimilar.responses)[200]
>;
export type AdminDashboardResponse = z.infer<
  (typeof api.admin.dashboard.responses)[200]
>;
export type AdminUsersResponse = z.infer<(typeof api.admin.users.responses)[200]>;
export type AdminUserResponse = AdminUsersResponse[number];
export type UpdateAdminUserInput = z.infer<typeof api.admin.updateUser.input>;
export type AdminItemsResponse = z.infer<(typeof api.admin.items.responses)[200]>;
export type AdminItemResponse = AdminItemsResponse[number];
