const ALLOWED_ORIGINS = new Set([
  "https://natanai.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function withCors(request: Request, response: Response) {
  const origin = request.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return response;
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-methods", "GET, POST, PATCH, OPTIONS");
  headers.set("access-control-allow-headers", "Authorization, Content-Type");
  headers.append("vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
