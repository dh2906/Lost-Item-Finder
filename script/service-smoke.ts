type CheckResult = {
  name: string;
  status: "pass" | "fail";
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
  FINDY_BASE_URL=http://localhost:8080 npm run smoke
  FINDY_SESSION_COOKIE="connect.sid=..." npm run smoke -- --base-url=http://localhost:8080`);
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

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    printUsage();
    return;
  }

  const baseUrl = getArgValue("base-url") ?? process.env.FINDY_BASE_URL ?? "http://localhost:8080";
  const cookie = process.env.FINDY_SESSION_COOKIE;

  const checks: CheckResult[] = [];

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
      const { response, latencyMs } = await request(baseUrl, "/api/auth/me", { cookie });
      assertStatus(response.status, 200);
      return { detail: cookie ? "session cookie supplied" : "anonymous session", latencyMs };
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
