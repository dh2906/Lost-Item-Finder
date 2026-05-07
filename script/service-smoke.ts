import { insertItemSchema, updateItemSchema } from "../shared/schema";
import {
  MAX_ITEM_TAG_COUNT,
  MAX_ITEM_TAG_LENGTH,
  MAX_ITEM_TITLE_LENGTH,
} from "../shared/item-limits";
import { MAX_ITEM_IMAGE_URL_LENGTH } from "../shared/item-images";

type CheckResult = {
  name: string;
  status: "pass" | "fail" | "skip";
  detail: string;
  latencyMs: number;
};

type RequestOptions = {
  method?: string;
  body?: unknown;
  cookie?: string;
};

function getArgValue(name: string): string | undefined {
  const prefixed = `--${name}=`;
  const entry = process.argv.find((arg) => arg.startsWith(prefixed));
  return entry ? entry.slice(prefixed.length) : undefined;
}

function printUsage(): void {
  console.log(`Usage:
  npm run smoke -- --base-url=http://localhost:8080

Optional:
  npm run smoke -- --schema-only
  FINDY_BASE_URL=http://localhost:8080 npm run smoke
  FINDY_SESSION_COOKIE="connect.sid=..." npm run smoke -- --base-url=http://localhost:8080
  FINDY_SMOKE_EXPECT_AI_RATE_LIMIT=true AI_SEARCH_GUEST_RATE_LIMIT=1 npm run smoke
  FINDY_SMOKE_USERNAME=user FINDY_SMOKE_PASSWORD=pass npm run smoke -- --require-auth`);
}

async function request(baseUrl: string, path: string, options: RequestOptions = {}) {
  const startedAt = Date.now();
  const response = await fetch(new URL(path, baseUrl), {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  return {
    response,
    body,
    latencyMs: Date.now() - startedAt,
  };
}

function getCookieHeader(response: Response): string | undefined {
  const maybeGetSetCookie = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies = maybeGetSetCookie.getSetCookie?.() ?? [];
  const rawCookie = setCookies.length > 0 ? setCookies : [response.headers.get("set-cookie")].filter(Boolean);
  const cookiePairs = rawCookie
    .map((cookie) => cookie?.split(";", 1)[0])
    .filter((cookie): cookie is string => Boolean(cookie));

  return cookiePairs.length > 0 ? cookiePairs.join("; ") : undefined;
}

function assertObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("응답이 JSON 객체가 아닙니다.");
  }
  return value as Record<string, unknown>;
}

function assertStatus(actual: number, expected: number): void {
  if (actual !== expected) {
    throw new Error(`HTTP ${actual}, expected ${expected}`);
  }
}

async function runCheck(
  name: string,
  check: () => Promise<{ detail: string; latencyMs: number }>
): Promise<CheckResult> {
  try {
    const result = await check();
    return {
      name,
      status: "pass",
      detail: result.detail,
      latencyMs: result.latencyMs,
    };
  } catch (error) {
    return {
      name,
      status: "fail",
      detail: error instanceof Error ? error.message : String(error),
      latencyMs: 0,
    };
  }
}

async function runSchemaChecks(): Promise<CheckResult[]> {
  return [
    await runCheck("item title length schema", async () => {
      const shortTitle = insertItemSchema.safeParse({
        reportType: "lost",
        title: "ab",
      });
      const longTitle = insertItemSchema.safeParse({
        reportType: "lost",
        title: "가".repeat(MAX_ITEM_TITLE_LENGTH + 1),
      });
      const validTitle = insertItemSchema.safeParse({
        reportType: "lost",
        title: "민트색 텀블러",
      });

      if (shortTitle.success || longTitle.success || !validTitle.success) {
        throw new Error("제목 길이 제한이 예상대로 동작하지 않습니다.");
      }

      return {
        detail: `min/max enforced, max=${MAX_ITEM_TITLE_LENGTH}`,
        latencyMs: 0,
      };
    }),
    await runCheck("item tag limits schema", async () => {
      const longTag = insertItemSchema.safeParse({
        reportType: "lost",
        title: "민트색 텀블러",
        tags: ["가".repeat(MAX_ITEM_TAG_LENGTH + 1)],
      });
      const tooManyTags = insertItemSchema.safeParse({
        reportType: "lost",
        title: "민트색 텀블러",
        tags: Array.from({ length: MAX_ITEM_TAG_COUNT + 1 }, (_, index) => `tag-${index}`),
      });

      if (longTag.success || tooManyTags.success) {
        throw new Error("태그 길이/개수 제한이 예상대로 동작하지 않습니다.");
      }

      return {
        detail: `tagLength=${MAX_ITEM_TAG_LENGTH}, tagCount=${MAX_ITEM_TAG_COUNT}`,
        latencyMs: 0,
      };
    }),
    await runCheck("item image payload schema", async () => {
      const largeImage = insertItemSchema.safeParse({
        reportType: "found",
        title: "민트색 텀블러",
        imageUrls: [`data:image/jpeg;base64,${"a".repeat(MAX_ITEM_IMAGE_URL_LENGTH)}`],
      });

      if (largeImage.success) {
        throw new Error("이미지 URL 길이 제한이 예상대로 동작하지 않습니다.");
      }

      return {
        detail: `maxImageUrlLength=${MAX_ITEM_IMAGE_URL_LENGTH}`,
        latencyMs: 0,
      };
    }),
    await runCheck("item update empty body schema", async () => {
      const emptyUpdate = updateItemSchema.safeParse({});
      const validUpdate = updateItemSchema.safeParse({ title: "민트색 텀블러" });

      if (emptyUpdate.success || !validUpdate.success) {
        throw new Error("수정 입력 스키마가 예상대로 동작하지 않습니다.");
      }

      return { detail: "empty update rejected", latencyMs: 0 };
    }),
  ];
}

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    printUsage();
    return;
  }

  const schemaOnly = process.argv.includes("--schema-only");
  const baseUrl = getArgValue("base-url") ?? process.env.FINDY_BASE_URL ?? "http://localhost:8080";
  const configuredCookie = process.env.FINDY_SESSION_COOKIE;
  const smokeUsername = process.env.FINDY_SMOKE_USERNAME;
  const smokePassword = process.env.FINDY_SMOKE_PASSWORD;
  const requireAuthSmoke =
    process.argv.includes("--require-auth") || process.env.FINDY_SMOKE_REQUIRE_AUTH === "true";
  const expectAiRateLimit = process.env.FINDY_SMOKE_EXPECT_AI_RATE_LIMIT === "true";
  let authenticatedCookie = configuredCookie;

  const checks: CheckResult[] = [];
  checks.push(...await runSchemaChecks());

  if (schemaOnly) {
    console.table(
      checks.map((check) => ({
        check: check.name,
        status: check.status,
        detail: check.detail,
        latencyMs: check.latencyMs,
      }))
    );

    const failures = checks.filter((check) => check.status === "fail");
    if (failures.length > 0) {
      throw new Error(`스모크 검증 실패: ${failures.map((check) => check.name).join(", ")}`);
    }
    return;
  }

  checks.push(
    await runCheck("health", async () => {
      const { response, body, latencyMs } = await request(baseUrl, "/api/health");
      assertStatus(response.status, 200);
      const payload = assertObject(body);
      if (payload.status !== "ok" || payload.database !== "ok") {
        throw new Error(`비정상 헬스 상태: ${JSON.stringify(payload)}`);
      }
      return { detail: `databaseLatencyMs=${payload.databaseLatencyMs ?? "-"}`, latencyMs };
    })
  );

  checks.push(
    await runCheck("public item list", async () => {
      const { response, body, latencyMs } = await request(baseUrl, "/api/items?limit=1");
      assertStatus(response.status, 200);
      const payload = assertObject(body);
      if (!Array.isArray(payload.items)) {
        throw new Error("items 배열이 없습니다.");
      }
      return { detail: `items=${payload.items.length}`, latencyMs };
    })
  );

  checks.push(
    await runCheck("auth session endpoint", async () => {
      const { response, latencyMs } = await request(baseUrl, "/api/auth/me", {
        cookie: authenticatedCookie,
      });
      assertStatus(response.status, 200);
      return { detail: authenticatedCookie ? "session cookie supplied" : "anonymous session", latencyMs };
    })
  );

  checks.push(
    await runCheck("unauthenticated item create blocked", async () => {
      const { response, latencyMs } = await request(baseUrl, "/api/items", {
        method: "POST",
        body: {},
      });
      assertStatus(response.status, 401);
      return { detail: "401", latencyMs };
    })
  );

  checks.push(
    await runCheck("unauthenticated image analysis blocked", async () => {
      const { response, latencyMs } = await request(baseUrl, "/api/ai/analyze-image", {
        method: "POST",
        body: { imageUrl: "data:image/png;base64," },
      });
      assertStatus(response.status, 401);
      return { detail: "401", latencyMs };
    })
  );

  checks.push(
    await runCheck("unauthenticated image search blocked", async () => {
      const { response, latencyMs } = await request(baseUrl, "/api/ai/search", {
        method: "POST",
        body: { imageUrl: "data:image/png;base64," },
      });
      assertStatus(response.status, 401);
      return { detail: "401", latencyMs };
    })
  );

  checks.push(
    await runCheck("empty AI search rejected", async () => {
      const { response, latencyMs } = await request(baseUrl, "/api/ai/search", {
        method: "POST",
        body: {},
      });
      assertStatus(response.status, 400);
      return { detail: "400", latencyMs };
    })
  );

  if (expectAiRateLimit) {
    checks.push(
      await runCheck("AI search rate limit blocks repeated requests", async () => {
        const first = await request(baseUrl, "/api/ai/search", {
          method: "POST",
          body: {},
        });
        const second = await request(baseUrl, "/api/ai/search", {
          method: "POST",
          body: {},
        });

        if (first.response.status !== 400 && first.response.status !== 429) {
          throw new Error(`첫 요청 HTTP ${first.response.status}, expected 400 or 429`);
        }
        assertStatus(second.response.status, 429);

        const retryAfter = second.response.headers.get("retry-after");
        return {
          detail: `first=${first.response.status}, second=429, retryAfter=${retryAfter ?? "-"}`,
          latencyMs: first.latencyMs + second.latencyMs,
        };
      })
    );
  }

  if (!authenticatedCookie && smokeUsername && smokePassword) {
    checks.push(
      await runCheck("smoke user login", async () => {
        const { response, latencyMs } = await request(baseUrl, "/api/auth/login", {
          method: "POST",
          body: {
            username: smokeUsername,
            password: smokePassword,
          },
        });
        assertStatus(response.status, 200);
        authenticatedCookie = getCookieHeader(response);
        if (!authenticatedCookie) {
          throw new Error("로그인 응답에서 세션 쿠키를 찾지 못했습니다.");
        }
        return { detail: "session cookie captured", latencyMs };
      })
    );
  }

  if (authenticatedCookie) {
    let createdItemId: number | null = null;

    checks.push(
      await runCheck("authenticated item create", async () => {
        const { response, body, latencyMs } = await request(baseUrl, "/api/items", {
          method: "POST",
          cookie: authenticatedCookie,
          body: {
            reportType: "found",
            title: `Findy smoke check ${Date.now()}`,
            description: "서비스 스모크 검증용 게시글입니다.",
            itemCategory: "기타물품",
            color: "검정",
            size: "보통",
            tags: ["smoke-test"],
            location: "대전광역시 유성구 대학로 99",
            address: "대전광역시 유성구 대학로 99",
            placeName: "스모크 검증 위치",
            latitude: "36.3721",
            longitude: "127.3604",
            contactInfo: "01000000000",
          },
        });
        assertStatus(response.status, 201);
        const payload = assertObject(body);
        if (typeof payload.id !== "number") {
          throw new Error("등록 응답에 id가 없습니다.");
        }
        createdItemId = payload.id;
        return { detail: `itemId=${createdItemId}`, latencyMs };
      })
    );

    checks.push(
      await runCheck("authenticated item delete", async () => {
        if (createdItemId === null) {
          throw new Error("삭제할 스모크 게시글이 생성되지 않았습니다.");
        }
        const { response, latencyMs } = await request(baseUrl, `/api/items/${createdItemId}`, {
          method: "DELETE",
          cookie: authenticatedCookie,
        });
        assertStatus(response.status, 200);
        return { detail: `itemId=${createdItemId}`, latencyMs };
      })
    );
  } else {
    checks.push({
      name: "authenticated item create/delete",
      status: requireAuthSmoke ? "fail" : "skip",
      detail: requireAuthSmoke
        ? "FINDY_SESSION_COOKIE 또는 FINDY_SMOKE_USERNAME/FINDY_SMOKE_PASSWORD가 필요합니다."
        : "세션 쿠키나 스모크 로그인 계정이 없어 건너뜁니다.",
      latencyMs: 0,
    });
  }

  console.table(
    checks.map((check) => ({
      check: check.name,
      status: check.status,
      detail: check.detail,
      latencyMs: check.latencyMs,
    }))
  );

  const failures = checks.filter((check) => check.status === "fail");
  if (failures.length > 0) {
    throw new Error(`스모크 검증 실패: ${failures.map((check) => check.name).join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
