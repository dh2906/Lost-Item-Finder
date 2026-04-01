const AUTH_PAGE_PATHS = new Set(["/login", "/register"]);

function getPathname(value: string): string {
  return value.split(/[?#]/, 1)[0] || "/";
}

/**
 * redirect 쿼리 파라미터를 검증해 앱 내부의 안전한 경로만 허용합니다.
 * 외부 URL, protocol-relative URL, 인증 페이지 재진입 경로는 fallback으로 대체합니다.
 */
export function sanitizeRedirect(value: string | null, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  const pathname = getPathname(value);
  const normalizedPathname =
    pathname !== "/" ? pathname.replace(/\/+$/, "") || "/" : "/";

  if (AUTH_PAGE_PATHS.has(normalizedPathname)) {
    return fallback;
  }

  return value;
}
