import { z } from "zod";
import {
  insertItemSchema,
  items,
  itemMatchStatuses,
  itemStatuses,
  reportTypes,
  updateItemSchema,
  updateItemMatchStatusSchema,
  userRoles,
  userStatuses,
} from "./schema";

export const itemDateRanges = ["all", "7d", "30d", "90d"] as const;
export const itemSortOrders = ["latest", "oldest"] as const;
export const locationFilterScopes = ["radius", "dong", "sigungu", "sido"] as const;
export const locationRadiusOptions = [1, 3, 5, 10] as const;

const itemResponseSchema = z.custom<typeof items.$inferSelect>();

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
  lostItem: itemResponseSchema,
  foundItem: itemResponseSchema,
});

const matchNotificationResponseSchema = z.object({
  id: z.number(),
  userId: z.number(),
  lostItemId: z.number(),
  foundItemId: z.number(),
  score: z.number(),
  reasoning: z.string(),
  isRead: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lostItem: itemResponseSchema,
  foundItem: itemResponseSchema,
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
  reportType: z.enum(reportTypes),
  status: z.enum(itemStatuses),
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

function getFirstQueryValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

const optionalQueryStringSchema = z.preprocess((value) => {
  const normalizedValue = getFirstQueryValue(value);
  return typeof normalizedValue === "string" ? normalizedValue : undefined;
}, z.string().optional());

const optionalPositiveIntegerQuerySchema = z.preprocess((value) => {
  const normalizedValue = getFirstQueryValue(value);
  return normalizedValue === undefined ? undefined : normalizedValue;
}, z.coerce.number().int().positive().optional());

const optionalBooleanQuerySchema = z.preprocess((value) => {
  const normalizedValue = getFirstQueryValue(value);
  if (normalizedValue === undefined) {
    return undefined;
  }

  if (typeof normalizedValue === "boolean") {
    return normalizedValue;
  }

  if (typeof normalizedValue === "string") {
    const normalizedText = normalizedValue.trim().toLowerCase();
    if (normalizedText === "true") {
      return true;
    }
    if (normalizedText === "false") {
      return false;
    }
  }

  return undefined;
}, z.boolean().optional());
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
          type: z.enum(reportTypes).optional(),
          search: z.string().optional(),
          category: z.string().trim().min(1).optional(),
          color: z.string().trim().min(1).optional(),
          dateRange: z.enum(itemDateRanges).optional(),
          sort: z.enum(itemSortOrders).optional(),
          useLocationFilter: optionalBooleanQuerySchema,
          locationScope: z.enum(locationFilterScopes).optional(),
          locationText: z.string().trim().min(1).optional(),
          latitude: optionalQueryStringSchema,
          longitude: optionalQueryStringSchema,
          radiusKm: optionalPositiveIntegerQuerySchema,
        })
        .optional(),
      responses: {
        200: z.array(itemResponseSchema),
      },
    },
    mine: {
      method: "GET" as const,
      path: "/api/items/mine" as const,
      input: z
        .object({
          type: z.enum(reportTypes).optional(),
          status: z.enum(itemStatuses).optional(),
        })
        .optional(),
      responses: {
        200: z.array(itemResponseSchema),
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/items/:id" as const,
      responses: {
        200: itemResponseSchema,
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/items" as const,
      input: insertItemSchema,
      responses: {
        201: itemResponseSchema,
        400: errorSchemas.validation,
      },
    },
    update: {
      method: "PATCH" as const,
      path: "/api/items/:id" as const,
      input: updateItemSchema,
      responses: {
        200: itemResponseSchema,
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/items/:id" as const,
      responses: {
        200: z.object({ success: z.literal(true) }),
        404: errorSchemas.notFound,
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
  notifications: {
    list: {
      method: "GET" as const,
      path: "/api/notifications" as const,
      responses: {
        200: z.array(matchNotificationResponseSchema),
      },
    },
    markRead: {
      method: "POST" as const,
      path: "/api/notifications/:id/read" as const,
      responses: {
        200: matchNotificationResponseSchema,
        404: errorSchemas.notFound,
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
        useLocationFilter: z.boolean().optional(),
        locationScope: z.enum(locationFilterScopes).optional(),
        locationText: z.string().trim().min(1).optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        radiusKm: z.number().int().positive().optional(),
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
          message: "최소 한 개 이상의 필드를 입력해야 합니다.",
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
          type: z.enum(reportTypes).optional(),
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
export type ItemsListFilters = NonNullable<z.infer<typeof api.items.list.input>>;
export type MyItemsResponse = z.infer<(typeof api.items.mine.responses)[200]>;
export type UpdateItemInput = z.infer<typeof api.items.update.input>;
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
export type LocationFilterScope = (typeof locationFilterScopes)[number];
export type MatchNotificationsResponse = z.infer<
  (typeof api.notifications.list.responses)[200]
>;
export type MatchNotificationResponse = MatchNotificationsResponse[number];
export type AdminDashboardResponse = z.infer<
  (typeof api.admin.dashboard.responses)[200]
>;
export type AdminUsersResponse = z.infer<(typeof api.admin.users.responses)[200]>;
export type AdminUserResponse = AdminUsersResponse[number];
export type UpdateAdminUserInput = z.infer<typeof api.admin.updateUser.input>;
export type AdminItemsResponse = z.infer<(typeof api.admin.items.responses)[200]>;
export type AdminItemResponse = AdminItemsResponse[number];
