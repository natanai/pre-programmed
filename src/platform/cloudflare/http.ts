export const API_ORIGIN = "https://pre-programmed.natanai.workers.dev";

export function apiUrl(path: string) {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname === "terminal.local") {
    return path;
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
