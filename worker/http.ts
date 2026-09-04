function allowedOrigins(configured: string | undefined) {
  return new Set((configured ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean));
}

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

/**
 * CORS belongs to the installation/platform boundary, not to an upstream owner.
 * Same-origin clients need no CORS header. Hosted installations inject their
 * allowed client origin(s); local development supplies localhost origins.
 */
export function withCors(request: Request, response: Response, configuredOrigins?: string) {
  const origin = request.headers.get("origin")?.replace(/\/+$/, "");
  if (!origin || !allowedOrigins(configuredOrigins).has(origin)) return response;
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  headers.set("access-control-allow-headers", "Authorization, Content-Type");
  headers.append("vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
