const configuredApiOrigin = import.meta.env.VITE_API_ORIGIN?.trim().replace(/\/+$/, "");

/**
 * Hosted API origin for this installation.
 *
 * Hosted builds must receive their own API origin through installation/deployment
 * configuration. Local development deliberately uses same-origin `/api` paths.
 * No reusable engine build may fall back to another installation's Worker.
 */
export const API_ORIGIN = configuredApiOrigin || "";

export function apiUrl(path: string) {
  if (typeof window !== "undefined"
    && (window.location.hostname === "localhost"
      || window.location.hostname === "127.0.0.1"
      || window.location.hostname === "terminal.local")) {
    return path;
  }
  if (!API_ORIGIN) {
    throw new Error("Hosted API origin is not configured for this installation.");
  }
  return `${API_ORIGIN}${path}`;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.text();
    let message = detail || `${response.status}`;
    try {
      const parsed = JSON.parse(detail) as { error?: unknown };
      if (typeof parsed.error === "string") message = parsed.error;
    } catch {
      // Preserve non-JSON response details for diagnostics.
    }
    throw new ApiError(response.status, message);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(`API returned ${contentType || "an unknown content type"}; expected JSON.`);
  }
  return response.json() as Promise<T>;
}
